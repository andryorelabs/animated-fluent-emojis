import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { Manifest } from '../../packages/animated-fluent-emojis/src/utils/types.js'
import {
  DOWNLOAD_CONCURRENCY,
  fileExists,
  getConversionConcurrency,
  readState,
  type BuildOptions,
} from './build-context.js'
import { buildAssets } from './build.js'
import { hashHdEtag, PIPELINE_VERSION } from './catalog.js'
import { applyAnimations, applyHd, diffManifests } from './manifest-ops.js'
import { buildLiveSpriteUrl } from './seed.js'
import { toSlimManifest } from './slim-manifest.js'
import type { ConvertedSprite } from './sprites.js'
import { needsRebuild } from './sync.js'
import { buildManifestUrl, buildSpriteUrl } from './teams.js'
import {
  createFakeFetch,
  createSpritePng,
  createTeamsManifest,
} from './test-support.js'

const SHA = 'f'.repeat(40)
const HASH = 'c'.repeat(32)
const API = 'https://api.github.com/repos/microsoft/fluentui-emoji-animated'
const RAW = `https://raw.githubusercontent.com/microsoft/fluentui-emoji-animated/${SHA}`

const SMILEY_PNG = await createSpritePng(72)
const WAVE_PNG = await createSpritePng(21)
const FLAG_PNG = await createSpritePng(40)

const hdSheet = (framesCount: number): Promise<Buffer> =>
  createSpritePng(framesCount, { frameSize: 200 })

const createConvert =
  (hdFramesCount = 40) =>
  (_png: Buffer, frameSizes: readonly number[]): Promise<ConvertedSprite[]> =>
    Promise.all(
      frameSizes.map(async (frameSize): Promise<ConvertedSprite> =>
        frameSize === 200
          ? {
              png: await hdSheet(hdFramesCount),
              framesCount: hdFramesCount,
              fps: 24,
            }
          : { png: FLAG_PNG, framesCount: 40, fps: 24 },
      ),
    )

const context = { workDirectory: '' }

beforeEach(async () => {
  context.workDirectory = await mkdtemp(
    path.join(tmpdir(), 'build-assets-test-'),
  )
})
afterEach(async () => {
  await rm(context.workDirectory, { recursive: true, force: true })
})

const spriteRoutes = () => {
  const manifest = createTeamsManifest()
  const routes: Record<
    string,
    { body: string } | { body: object } | { body: Uint8Array }
  > = {
    [`GET ${buildManifestUrl(HASH)}`]: { body: manifest },
    [`GET ${API}/commits/main`]: { body: { sha: SHA } },
    [`GET ${API}/git/trees/${SHA}?recursive=1`]: {
      body: {
        truncated: false,
        tree: [
          {
            path: 'assets/Chequered flag/metadata.json',
            type: 'blob',
            sha: 'm1',
          },
          {
            path: 'assets/Chequered flag/animated/chequered_flag_animated.png',
            type: 'blob',
            sha: 'abcdef123456',
          },
        ],
      },
    },
    [`GET ${RAW}/assets/Chequered%20flag/metadata.json`]: {
      body: {
        cldr: 'chequered flag',
        glyph: '🏁',
        group: 'Flags',
        keywords: ['flag'],
        unicode: '1f3c1',
      },
    },
    [`GET ${RAW}/LICENSE`]: { body: 'MIT License' },
    [`GET https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/${SHA}/assets/Chequered%20flag/animated/chequered_flag_animated.png`]:
      { body: 'apng-bytes' },
  }
  for (const category of manifest.categories) {
    for (const emoticon of category.emoticons) {
      const suffixes = emoticon.diverse
        ? ['', '_s2', '_s3', '_s4', '_s5', '_s6']
        : ['']
      for (const suffix of suffixes) {
        routes[`GET ${buildSpriteUrl(emoticon.id, suffix)}`] = {
          body: emoticon.diverse ? WAVE_PNG : SMILEY_PNG,
        }
      }
    }
  }
  return routes
}

const baseOptions = (
  fakeFetch: ReturnType<typeof createFakeFetch>,
): BuildOptions => ({
  fetchImplementation: fakeFetch.fetch,
  teamsVersion: { hash: HASH, lastModified: '2025-10-16T22:08:15.000Z' },
  outputDirectory: path.join(context.workDirectory, 'out'),
  cacheDirectory: path.join(context.workDirectory, 'cache'),
  convert: createConvert(),
  now: () => new Date('2026-10-05T00:00:00.000Z'),
})

test('builds the manifest, sprites, version marker, headers and license', async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())
  const options = baseOptions(fakeFetch)

  const result = await buildAssets(options)

  const out = options.outputDirectory
  const manifest = JSON.parse(
    await readFile(path.join(out, 'manifest.json'), 'utf8'),
  ) as typeof result.manifest
  const ids = manifest.categories.flatMap((category) =>
    category.emoticons.map((emoticon) => emoticon.id),
  )
  expect(ids).toEqual([
    '1f603_grinningfacewithbigeyes',
    '1f44b_wavinghand',
    '1f3c1_chequeredflag',
  ])
  const flag = manifest.categories
    .flatMap((category) => category.emoticons)
    .find((emoticon) => emoticon.id === '1f3c1_chequeredflag')
  expect(flag?.animation).toEqual({ fps: 24, framesCount: 40, firstFrame: 1 })

  expect(result.spriteCount).toBe(8)
  expect(
    await readFile(
      path.join(out, 'sprites/Smilies/1f603_grinningfacewithbigeyes.png'),
    ),
  ).toEqual(SMILEY_PNG)
  expect(
    await readFile(
      path.join(out, 'sprites/Hand gestures/1f44b_wavinghand_s6.png'),
    ),
  ).toEqual(WAVE_PNG)
  expect(
    await readFile(path.join(out, 'sprites/Symbols/1f3c1_chequeredflag.png')),
  ).toEqual(FLAG_PNG)
  const version: unknown = JSON.parse(
    await readFile(path.join(out, 'version.json'), 'utf8'),
  )
  expect(version).toEqual({
    teamsHash: HASH,
    teamsLastModified: '2025-10-16T22:08:15.000Z',
    mitSha: SHA,
    builtAt: '2026-10-05T00:00:00.000Z',
    pipelineVersion: PIPELINE_VERSION,
    layouts: ['v1'],
  })
  const slim = JSON.parse(
    await readFile(path.join(out, 'manifest.slim.json'), 'utf8'),
  ) as typeof result.manifest
  expect(
    slim.categories.flatMap((category) =>
      category.emoticons.map((emoticon) => emoticon.id),
    ),
  ).toEqual(ids)
  expect(slim.categories[0]?.emoticons[0]).not.toHaveProperty('keywords')
  const headers = await readFile(path.join(out, '_headers'), 'utf8')
  expect(headers).toContain('immutable')
  expect(headers.split('\n\n', 1)[0]).not.toContain('immutable')
  expect(headers).toContain('/manifest.slim.json\n  Cache-Control')
  expect(
    await readFile(
      path.join(out, 'LICENSE-fluentui-emoji-animated.txt'),
      'utf8',
    ),
  ).toBe('MIT License')
})

test('calls onPlanned with the planned catalog before any conversion', async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())
  const convert = vi.fn(createConvert())
  const planned: string[] = []

  await expect(
    buildAssets({
      ...baseOptions(fakeFetch),
      convert,
      onPlanned: (manifest) => {
        planned.push(
          ...manifest.categories.flatMap((category) =>
            category.emoticons.map((emoticon) => emoticon.id),
          ),
        )
        throw new Error('stop')
      },
    }),
  ).rejects.toThrow('stop')

  expect(planned).toContain('1f44b_wavinghand')
  expect(convert).not.toHaveBeenCalled()
})

test('reuses cached sprites by etag on the next build', async () => {
  const firstFetch = createFakeFetch(spriteRoutes())
  const first = await buildAssets(baseOptions(firstFetch))
  const secondFetch = createFakeFetch(spriteRoutes())

  const second = await buildAssets(baseOptions(secondFetch))

  expect(first.downloaded).toBe(8)
  expect(second.downloaded).toBe(0)
  expect(second.reused).toBe(8)
  expect(
    secondFetch.requests.some((request) => request.includes('100_anim_f')),
  ).toBe(false)
  const flag = second.manifest.categories
    .flatMap((category) => category.emoticons)
    .find((emoticon) => emoticon.id === '1f3c1_chequeredflag')
  expect(flag?.animation.framesCount).toBe(40)
})

test('limits the build to the first emojis', async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())

  const result = await buildAssets({ ...baseOptions(fakeFetch), limit: 1 })

  expect(result.spriteCount).toBe(1)
  expect(result.version.limited).toBe(true)
  expect(
    result.manifest.categories.flatMap((category) => category.emoticons),
  ).toHaveLength(1)
  await expect(
    stat(path.join(context.workDirectory, 'out/sprites/Hand gestures')),
  ).rejects.toThrow()
})

test('skips an official emoji whose sprite fails and reports it', async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())
  const options = baseOptions(fakeFetch)
  const summaryPath = path.join(context.workDirectory, 'summary.md')

  const result = await buildAssets({
    ...options,
    stepSummaryPath: summaryPath,
    convert: () => Promise.reject(new Error('bad apng')),
  })

  expect(result.skipped).toHaveLength(1)
  expect(result.skipped[0]?.id).toBe('1f3c1_chequeredflag')
  expect(result.version.skippedIds).toEqual(['1f3c1_chequeredflag'])
  expect(result.version.limited).toBeUndefined()
  expect(result.spriteCount).toBe(7)
  const ids = result.manifest.categories.flatMap((category) =>
    category.emoticons.map((emoticon) => emoticon.id),
  )
  expect(ids).not.toContain('1f3c1_chequeredflag')
  await expect(
    stat(path.join(options.outputDirectory, 'sprites/Symbols')),
  ).rejects.toThrow()
  expect(await readFile(summaryPath, 'utf8')).toContain('1f3c1_chequeredflag')
  const state = JSON.parse(
    await readFile(path.join(options.cacheDirectory, 'state.json'), 'utf8'),
  ) as Record<string, unknown>
  expect(Object.keys(state)).toHaveLength(7)
})

test('fails the build when a pinned official emoji fails', async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())
  const previousManifest = createTeamsManifest()
  previousManifest.categories[0]?.emoticons.push({
    id: '1f3c1_chequeredflag',
    description: 'Chequered flag',
    shortcuts: [],
    unicode: '🏁',
    etag: 'old',
    diverse: false,
    animation: { fps: 24, framesCount: 40, firstFrame: 1 },
    keywords: [],
    origin: 'official',
  })

  await expect(
    buildAssets({
      ...baseOptions(fakeFetch),
      previousManifest,
      convert: () => Promise.reject(new Error('bad apng')),
    }),
  ).rejects.toThrow('1f3c1_chequeredflag')
})

test('fails the build when a Teams sprite fails', async () => {
  const missingUrl = `GET ${buildSpriteUrl('1f603_grinningfacewithbigeyes', '')}`
  const routes = Object.fromEntries(
    Object.entries(spriteRoutes()).filter(([route]) => route !== missingUrl),
  )
  const fakeFetch = createFakeFetch(routes)

  await expect(buildAssets(baseOptions(fakeFetch))).rejects.toThrow()
})

test('reports every failed Teams sprite, not just the first', async () => {
  const dropped = new Set([
    `GET ${buildSpriteUrl('1f603_grinningfacewithbigeyes', '')}`,
    `GET ${buildSpriteUrl('1f44b_wavinghand', '')}`,
  ])
  const routes = Object.fromEntries(
    Object.entries(spriteRoutes()).filter(([route]) => !dropped.has(route)),
  )
  const fakeFetch = createFakeFetch(routes)

  let error: unknown
  try {
    await buildAssets(baseOptions(fakeFetch))
  } catch (error_: unknown) {
    error = error_
  }

  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).errors).toHaveLength(2)
  expect((error as Error).message).toContain(
    '2 Teams sprite download(s) failed',
  )
  expect((error as Error).message).toContain('1f603_grinningfacewithbigeyes')
  expect((error as Error).message).toContain('1f44b_wavinghand')
})

test('state helpers treat a missing file as absent and propagate other errors', async () => {
  const cache = path.join(context.workDirectory, 'state-cache')
  await expect(readState(cache)).resolves.toEqual({})
  await expect(fileExists(path.join(cache, 'nope'))).resolves.toBe(false)

  await mkdir(cache, { recursive: true })
  await writeFile(path.join(cache, 'state.json'), '{broken')
  await expect(readState(cache)).rejects.toThrow(SyntaxError)

  await rm(path.join(cache, 'state.json'))
  await mkdir(path.join(cache, 'state.json'))
  await expect(readState(cache)).rejects.toMatchObject({ code: 'EISDIR' })

  const blocker = path.join(cache, 'file')
  await writeFile(blocker, 'x')
  await expect(fileExists(path.join(blocker, 'child'))).rejects.toMatchObject({
    code: 'ENOTDIR',
  })
})

test('writes nothing when the catalog fails validation', async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())
  const options = {
    ...baseOptions(fakeFetch),
    convert: () =>
      Promise.resolve([
        {
          png: Buffer.from('converted'),
          framesCount: 0,
          fps: 0,
        },
      ]),
  }

  await expect(buildAssets(options)).rejects.toThrow(
    'Catalog validation failed',
  )

  await expect(stat(options.outputDirectory)).rejects.toThrow()
})

test('diffManifests reports added, removed and changed ids', () => {
  const previous = createTeamsManifest()
  const next = createTeamsManifest()
  const [smilies, hands] = next.categories
  if (!smilies || !hands) throw new Error('fixture changed')
  const [wave] = hands.emoticons
  const [grin] = smilies.emoticons
  if (!wave || !grin) throw new Error('fixture changed')
  hands.emoticons = [{ ...wave, etag: 'v6' }]
  smilies.emoticons = [{ ...grin, id: 'new-one' }]

  expect(diffManifests(previous, next)).toEqual({
    added: ['new-one'],
    removed: ['1f603_grinningfacewithbigeyes'],
    changed: ['1f44b_wavinghand'],
  })
})

test('applyAnimations only touches emojis with converted animations', () => {
  const manifest = createTeamsManifest()

  const result = applyAnimations(
    manifest,
    new Map([['1f44b_wavinghand', { fps: 30, framesCount: 60 }]]),
  )

  const emoticons = result.categories.flatMap((category) => category.emoticons)
  expect(emoticons[1]?.animation).toEqual({
    fps: 30,
    framesCount: 60,
    firstFrame: 1,
  })
  expect(emoticons[0]?.animation).toEqual({
    fps: 24,
    framesCount: 72,
    firstFrame: 1,
  })
})

const OFFICIAL_SMILEY_DIRECTORY = 'assets/Grinning face with big eyes'
const ENCODED_SMILEY_DIRECTORY = OFFICIAL_SMILEY_DIRECTORY.replaceAll(
  ' ',
  '%20',
)

const withOfficialSmiley = (
  routes: ReturnType<typeof spriteRoutes>,
  blobSha = 'smiley-sha',
) => {
  const treeKey = `GET ${API}/git/trees/${SHA}?recursive=1`
  const tree = routes[treeKey]?.body as { tree: object[] }
  tree.tree.push(
    {
      path: `${OFFICIAL_SMILEY_DIRECTORY}/metadata.json`,
      type: 'blob',
      sha: 'm2',
    },
    {
      path: `${OFFICIAL_SMILEY_DIRECTORY}/animated/smiley_animated.png`,
      type: 'blob',
      sha: blobSha,
    },
  )
  routes[`GET ${RAW}/${ENCODED_SMILEY_DIRECTORY}/metadata.json`] = {
    body: {
      cldr: 'grinning face with big eyes',
      glyph: '😃',
      group: 'Smileys & Emotion',
      keywords: ['grinning'],
      unicode: '1f603',
    },
  }
  routes[
    `GET https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/${SHA}/${ENCODED_SMILEY_DIRECTORY}/animated/smiley_animated.png`
  ] = { body: 'smiley-apng' }
  return routes
}

interface HdEmoticon {
  id: string
  etag: string
  hd?: boolean
}

const findEmoticon = (manifest: Manifest, id: string): HdEmoticon | undefined =>
  manifest.categories
    .flatMap((category) => category.emoticons as HdEmoticon[])
    .find((emoticon) => emoticon.id === id)

const SMILEY_ID = '1f603_grinningfacewithbigeyes'

test('publishes HD sheets for Teams emojis that match an official one', async () => {
  const fakeFetch = createFakeFetch(withOfficialSmiley(spriteRoutes()))
  const options = baseOptions(fakeFetch)

  const result = await buildAssets({ ...options, convert: createConvert(72) })

  const smiley = findEmoticon(result.manifest, SMILEY_ID)
  expect(smiley?.hd).toBe(true)
  expect(smiley?.etag).toBe(
    hashHdEtag('v11', [{ toneSuffix: '', blobSha: 'smiley-sha' }]),
  )
  expect(
    await readFile(
      path.join(options.outputDirectory, `sprites/Smilies/${SMILEY_ID}@2x.png`),
    ),
  ).toEqual(await hdSheet(72))
  const wave = findEmoticon(result.manifest, '1f44b_wavinghand')
  expect(wave?.hd).toBeUndefined()
  expect(wave?.etag).toBe('v5')
  await expect(
    stat(
      path.join(
        options.outputDirectory,
        'sprites/Hand gestures/1f44b_wavinghand@2x.png',
      ),
    ),
  ).rejects.toThrow()
  expect(result.hdCount).toBe(1)
  const slim = JSON.parse(
    await readFile(
      path.join(options.outputDirectory, 'manifest.slim.json'),
      'utf8',
    ),
  ) as Manifest
  expect(findEmoticon(slim, SMILEY_ID)?.hd).toBe(true)
  expect(findEmoticon(slim, '1f44b_wavinghand')?.hd).toBeUndefined()
})

test('plans no HD sheet for an emoji above the HD frame cap', async () => {
  const routes = withOfficialSmiley(spriteRoutes())
  routes[`GET ${buildSpriteUrl(SMILEY_ID, '')}`] = {
    body: await createSpritePng(121),
  }
  const teamsManifest = createTeamsManifest()
  const teamsSmiley = teamsManifest.categories[0]?.emoticons[0]
  if (teamsSmiley) teamsSmiley.animation.framesCount = 121
  routes[`GET ${buildManifestUrl(HASH)}`] = { body: teamsManifest }
  const options = baseOptions(createFakeFetch(routes))

  const result = await buildAssets({ ...options, convert: createConvert(121) })

  const smiley = findEmoticon(result.manifest, SMILEY_ID)
  expect(smiley?.hd).toBeUndefined()
  expect(
    result.manifest.categories[0]?.emoticons[0]?.animation.framesCount,
  ).toBe(121)
  await expect(
    stat(
      path.join(options.outputDirectory, `sprites/Smilies/${SMILEY_ID}@2x.png`),
    ),
  ).rejects.toThrow()
})

test('publishes HD for an official-only emoji whose HD frame count matches', async () => {
  const options = baseOptions(createFakeFetch(spriteRoutes()))

  const result = await buildAssets(options)

  expect(findEmoticon(result.manifest, '1f3c1_chequeredflag')?.hd).toBe(true)
  await expect(
    stat(
      path.join(
        options.outputDirectory,
        'sprites/Symbols/1f3c1_chequeredflag@2x.png',
      ),
    ),
  ).resolves.toBeDefined()
})

test('skips HD and logs it when the frame count differs from the standard sheet', async () => {
  const fakeFetch = createFakeFetch(withOfficialSmiley(spriteRoutes()))
  const options = baseOptions(fakeFetch)

  const result = await buildAssets({ ...options, convert: createConvert(70) })

  const smiley = findEmoticon(result.manifest, SMILEY_ID)
  expect(smiley?.hd).toBeUndefined()
  expect(smiley?.etag).toBe('v11')
  expect(
    result.hdSkipped.find((entry) => entry.id === SMILEY_ID)?.reason,
  ).toContain('70 frames')
  expect(result.version.skippedIds).toBeUndefined()
  expect(
    needsRebuild(
      result.version,
      result.version,
      {
        teamsHash: result.version.teamsHash,
        mitSha: result.version.mitSha,
      },
      false,
    ),
  ).toBe(false)
  await expect(
    stat(
      path.join(options.outputDirectory, `sprites/Smilies/${SMILEY_ID}@2x.png`),
    ),
  ).rejects.toThrow()
})

test('records an HD conversion error in skippedIds and keeps the site stale', async () => {
  const fakeFetch = createFakeFetch(withOfficialSmiley(spriteRoutes()))
  const options = baseOptions(fakeFetch)
  const standardConvert = createConvert(72)

  const result = await buildAssets({
    ...options,
    convert: (png, frameSizes) => {
      return frameSizes.includes(200)
        ? Promise.reject(new Error('boom'))
        : standardConvert(png, frameSizes)
    },
  })

  expect(findEmoticon(result.manifest, SMILEY_ID)?.hd).toBeUndefined()
  expect(
    result.hdSkipped.find((entry) => entry.id === SMILEY_ID)?.reason,
  ).toContain('boom')
  expect(result.version.skippedIds).toContain(SMILEY_ID)
  expect(
    needsRebuild(
      result.version,
      result.version,
      {
        teamsHash: result.version.teamsHash,
        mitSha: result.version.mitSha,
      },
      false,
    ),
  ).toBe(true)
})

test('changes the etag with the HD source and reuses HD sheets otherwise', async () => {
  const smileyFetch = () => createFakeFetch(withOfficialSmiley(spriteRoutes()))
  const first = await buildAssets({
    ...baseOptions(smileyFetch()),
    convert: createConvert(72),
  })
  let hdConversions = 0
  const countingConvert = createConvert(72)
  const second = await buildAssets({
    ...baseOptions(smileyFetch()),
    convert: (png, frameSizes) => {
      if (frameSizes.includes(200)) hdConversions += 1
      return countingConvert(png, frameSizes)
    },
  })
  const changedRoutes = withOfficialSmiley(spriteRoutes(), 'smiley-sha-2')
  const changed = await buildAssets({
    ...baseOptions(createFakeFetch(changedRoutes)),
    convert: createConvert(72),
  })

  expect(hdConversions).toBe(0)
  expect(findEmoticon(second.manifest, SMILEY_ID)?.etag).toBe(
    findEmoticon(first.manifest, SMILEY_ID)?.etag,
  )
  expect(findEmoticon(changed.manifest, SMILEY_ID)?.etag).not.toBe(
    findEmoticon(first.manifest, SMILEY_ID)?.etag,
  )
})

test('applyHd flags only the given emojis and swaps their etag', () => {
  const manifest = applyHd(
    createTeamsManifest(),
    new Map([['1f44b_wavinghand', 'hd-etag']]),
  )

  expect(findEmoticon(manifest, '1f44b_wavinghand')).toMatchObject({
    hd: true,
    etag: 'hd-etag',
  })
  expect(findEmoticon(manifest, SMILEY_ID)?.hd).toBeUndefined()
})

const FLAG_APNG_URL = `https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/${SHA}/assets/Chequered%20flag/animated/chequered_flag_animated.png`

test('fetches an official source once and decodes it once for both sheets', async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())
  const conversions: (readonly number[])[] = []

  const result = await buildAssets({
    ...baseOptions(fakeFetch),
    convert: (png, frameSizes) => {
      conversions.push(frameSizes)
      return createConvert(40)(png, frameSizes)
    },
  })

  expect(findEmoticon(result.manifest, '1f3c1_chequeredflag')?.hd).toBe(true)
  expect(
    fakeFetch.requests.filter((key) => key.endsWith(FLAG_APNG_URL)),
  ).toHaveLength(1)
  expect(conversions).toEqual([[100, 200]])
})

test('limits conversions independently from downloads', () => {
  expect(DOWNLOAD_CONCURRENCY).toBe(24)
  expect(getConversionConcurrency()).toBe(availableParallelism())
})

const LEGACY_HEADERS = `/sprites/*
  Cache-Control: public, max-age=86400
  Access-Control-Allow-Origin: *

/manifest.json
  Cache-Control: public, max-age=3600
  Access-Control-Allow-Origin: *

/manifest.slim.json
  Cache-Control: public, max-age=3600
  Access-Control-Allow-Origin: *

/version.json
  Cache-Control: no-cache
  Access-Control-Allow-Origin: *
`

test('publishes the versioned layout next to the legacy one', async () => {
  const options = baseOptions(createFakeFetch(spriteRoutes()))
  const result = await buildAssets(options)
  const out = options.outputDirectory

  const v1Manifest = JSON.parse(
    await readFile(path.join(out, 'v1/manifest.slim.json'), 'utf8'),
  ) as { categories: { emoticons: { id: string; unicode: string }[] }[] }
  const entries = v1Manifest.categories.flatMap(
    (category) => category.emoticons,
  )
  expect(entries.length).toBe(3)
  for (const entry of entries) expect(entry.unicode.length).toBeGreaterThan(0)
  const v1Version: unknown = JSON.parse(
    await readFile(path.join(out, 'v1/version.json'), 'utf8'),
  )
  expect(v1Version).toEqual(result.version)

  const wave = result.manifest.categories
    .flatMap((category) => category.emoticons)
    .find((emoticon) => emoticon.id === '1f44b_wavinghand')
  expect(
    await readFile(
      path.join(
        out,
        `v1/sprites/Hand gestures/1f44b_wavinghand_s6.${wave?.etag ?? ''}.png`,
      ),
    ),
  ).toEqual(WAVE_PNG)
  expect(
    await fileExists(path.join(out, 'sprites/Symbols/1f3c1_chequeredflag.png')),
  ).toBe(true)
})

test('writes versioned headers and keeps the legacy ones first', async () => {
  const options = baseOptions(createFakeFetch(spriteRoutes()))
  await buildAssets(options)
  const headers = await readFile(
    path.join(options.outputDirectory, '_headers'),
    'utf8',
  )

  expect(headers.startsWith(LEGACY_HEADERS)).toBe(true)
  expect(headers).toContain(
    '/v1/sprites/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *',
  )
  expect(headers).toContain(
    '/v1/manifest.slim.json\n  Cache-Control: public, max-age=3600\n  Access-Control-Allow-Origin: *',
  )
  expect(headers).toContain(
    '/v1/version.json\n  Cache-Control: no-cache\n  Access-Control-Allow-Origin: *',
  )
})

test('leaves the legacy output byte-for-byte unchanged', async () => {
  const options = baseOptions(createFakeFetch(spriteRoutes()))
  const result = await buildAssets(options)
  const out = options.outputDirectory

  expect(await readFile(path.join(out, 'manifest.json'), 'utf8')).toBe(
    JSON.stringify(result.manifest),
  )
  const legacySlim = await readFile(
    path.join(out, 'manifest.slim.json'),
    'utf8',
  )
  expect(legacySlim).toBe(JSON.stringify(toSlimManifest(result.manifest)))
  expect(legacySlim).not.toContain('"unicode"')
  expect(await readFile(path.join(out, 'version.json'), 'utf8')).toBe(
    JSON.stringify(result.version, null, 2),
  )
  expect(
    await readFile(
      path.join(out, 'sprites/Smilies/1f603_grinningfacewithbigeyes.png'),
    ),
  ).toEqual(SMILEY_PNG)
})

const LIVE_URL = 'https://live.example'

const listV1Sprites = async (directory: string): Promise<string[]> => {
  const entries = await readdir(path.join(directory, 'v1/sprites'), {
    recursive: true,
    withFileTypes: true,
  })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(directory, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/'),
    )
}

type LiveRoutes = Record<string, { body: Uint8Array }>

const readLiveRoute = async (
  directory: string,
  v1Path: string,
  rename: (v1Path: string) => string,
): Promise<[string, { body: Uint8Array }]> => [
  `GET ${buildLiveSpriteUrl(LIVE_URL, rename(v1Path))}`,
  { body: new Uint8Array(await readFile(path.join(directory, v1Path))) },
]

const buildLiveRoutes = async (
  directory: string,
  rename: (v1Path: string) => string = (v1Path) => v1Path,
): Promise<LiveRoutes> => {
  const v1Paths = await listV1Sprites(directory)
  const entries = await Promise.all(
    v1Paths.map((v1Path) => readLiveRoute(directory, v1Path, rename)),
  )
  return Object.fromEntries(entries)
}

const hasOldEtag = (file: string): boolean => file.includes('.old1.')

const isSourceHostRequest = (request: string): boolean =>
  new URL(request.slice(request.indexOf(' ') + 1)).hostname ===
  'media.githubusercontent.com'

const isSourceSpriteRequest = (request: string): boolean =>
  request.includes('100_anim_f') || isSourceHostRequest(request)

const withoutSourceSprites = (routes: ReturnType<typeof spriteRoutes>) =>
  Object.fromEntries(
    Object.entries(routes).filter(([route]) => !isSourceSpriteRequest(route)),
  )

const seedOptions = (
  fakeFetch: ReturnType<typeof createFakeFetch>,
  previousManifest: Manifest,
): BuildOptions => ({
  ...baseOptions(fakeFetch),
  outputDirectory: path.join(context.workDirectory, 'out-next'),
  cacheDirectory: path.join(context.workDirectory, 'cache-next'),
  previousManifest,
  liveUrl: LIVE_URL,
})

const publishFirstGeneration = async () => {
  const fakeFetch = createFakeFetch(spriteRoutes())
  const first = await buildAssets(baseOptions(fakeFetch))
  return {
    manifest: first.manifest,
    liveRoutes: await buildLiveRoutes(path.join(context.workDirectory, 'out')),
  }
}

test('seeds an unchanged emoji from the live site without touching the source', async () => {
  const { manifest, liveRoutes } = await publishFirstGeneration()
  const sourceRoutes = withoutSourceSprites(spriteRoutes())
  const fakeFetch = createFakeFetch({ ...sourceRoutes, ...liveRoutes })
  const liveFileCount = Object.keys(liveRoutes).length

  const result = await buildAssets({
    ...seedOptions(fakeFetch, manifest),
    convert: () => Promise.reject(new Error('must not convert')),
  })

  expect(result.seeded).toBe(3)
  expect(result.downloaded).toBe(0)
  expect(result.skipped).toEqual([])
  expect(
    fakeFetch.requests.some((request) => isSourceSpriteRequest(request)),
  ).toBe(false)
  const liveRequests = fakeFetch.requests.filter((request) =>
    request.startsWith(`GET ${LIVE_URL}/v1/sprites/`),
  )
  expect(liveRequests).toHaveLength(liveFileCount)
  expect(new Set(liveRequests).size).toBe(liveFileCount)
  expect(result.manifest).toEqual(manifest)
  expect(
    await listV1Sprites(path.join(context.workDirectory, 'out-next')),
  ).toEqual(await listV1Sprites(path.join(context.workDirectory, 'out')))
})

test('seeds an emoji above the HD frame cap from the live site', async () => {
  const routes = withOfficialSmiley(spriteRoutes())
  routes[`GET ${buildSpriteUrl(SMILEY_ID, '')}`] = {
    body: await createSpritePng(121),
  }
  const teamsManifest = createTeamsManifest()
  const teamsSmiley = teamsManifest.categories[0]?.emoticons[0]
  if (teamsSmiley) teamsSmiley.animation.framesCount = 121
  routes[`GET ${buildManifestUrl(HASH)}`] = { body: teamsManifest }
  const convertAboveCap = (
    _png: Buffer,
    frameSizes: readonly number[],
  ): Promise<ConvertedSprite[]> =>
    Promise.all(
      frameSizes.map(async (frameSize): Promise<ConvertedSprite> => ({
        png: await createSpritePng(121, { frameSize }),
        framesCount: 121,
        fps: 24,
      })),
    )
  const first = await buildAssets({
    ...baseOptions(createFakeFetch(routes)),
    convert: convertAboveCap,
  })
  const liveRoutes = await buildLiveRoutes(
    path.join(context.workDirectory, 'out'),
  )
  const fakeFetch = createFakeFetch({
    ...withoutSourceSprites(routes),
    ...liveRoutes,
  })

  const result = await buildAssets({
    ...seedOptions(fakeFetch, first.manifest),
    convert: () => Promise.reject(new Error('must not convert')),
  })

  expect(findEmoticon(result.manifest, SMILEY_ID)?.hd).toBeUndefined()
  expect(result.seeded).toBe(3)
  expect(result.skipped).toEqual([])
})

test('keeps the previous etag file of a changed emoji next to the new one', async () => {
  const { manifest, liveRoutes } = await publishFirstGeneration()
  const previousManifest: Manifest = {
    categories: manifest.categories.map((category) => ({
      ...category,
      emoticons: category.emoticons.map((emoticon) =>
        emoticon.id === '1f44b_wavinghand'
          ? { ...emoticon, etag: 'old1' }
          : emoticon,
      ),
    })),
  }
  const renamedLiveRoutes = await buildLiveRoutes(
    path.join(context.workDirectory, 'out'),
    (v1Path) => v1Path.replace('.v5.png', '.old1.png'),
  )
  const fakeFetch = createFakeFetch({
    ...spriteRoutes(),
    ...liveRoutes,
    ...renamedLiveRoutes,
  })

  const result = await buildAssets(seedOptions(fakeFetch, previousManifest))

  const out = path.join(context.workDirectory, 'out-next')
  const files = await listV1Sprites(out)
  expect(result.retained).toBe(1)
  expect(result.seeded).toBe(2)
  for (const suffix of ['', '_s2', '_s3', '_s4', '_s5', '_s6']) {
    expect(files).toContain(
      `v1/sprites/Hand gestures/1f44b_wavinghand${suffix}.v5.png`,
    )
    expect(files).toContain(
      `v1/sprites/Hand gestures/1f44b_wavinghand${suffix}.old1.png`,
    )
  }
})

test('does not retain the previous generation beyond the file cap', async () => {
  const { manifest, liveRoutes } = await publishFirstGeneration()
  const previousManifest: Manifest = {
    categories: manifest.categories.map((category) => ({
      ...category,
      emoticons: category.emoticons.map((emoticon) =>
        emoticon.id === '1f44b_wavinghand'
          ? { ...emoticon, etag: 'old1' }
          : emoticon,
      ),
    })),
  }
  const renamedLiveRoutes = await buildLiveRoutes(
    path.join(context.workDirectory, 'out'),
    (v1Path) => v1Path.replace('.v5.png', '.old1.png'),
  )
  const fakeFetch = createFakeFetch({
    ...spriteRoutes(),
    ...liveRoutes,
    ...renamedLiveRoutes,
  })

  const result = await buildAssets({
    ...seedOptions(fakeFetch, previousManifest),
    maxOutputFiles: 1,
  })

  expect(result.retained).toBe(0)
  const files = await listV1Sprites(
    path.join(context.workDirectory, 'out-next'),
  )
  expect(files.some((file) => hasOldEtag(file))).toBe(false)
})

test('falls back to the source when no v1 layout is live', async () => {
  const { manifest } = await publishFirstGeneration()
  const fakeFetch = createFakeFetch(spriteRoutes())

  const result = await buildAssets(seedOptions(fakeFetch, manifest))

  expect(result.seeded).toBe(0)
  expect(result.retained).toBe(0)
  expect(result.downloaded).toBe(8)
  expect(result.skipped).toEqual([])
})

test('rebuilds an emoji from the source when its live file is corrupt', async () => {
  const { manifest, liveRoutes } = await publishFirstGeneration()
  const corruptRoute = Object.keys(liveRoutes).find((route) =>
    route.includes('chequeredflag'),
  )
  expect(corruptRoute).toBeDefined()
  const fakeFetch = createFakeFetch({
    ...spriteRoutes(),
    ...liveRoutes,
    [corruptRoute ?? '']: { body: new Uint8Array([1, 2, 3]) },
  })

  const result = await buildAssets(seedOptions(fakeFetch, manifest))

  expect(result.seeded).toBe(2)
  expect(result.downloaded).toBe(1)
  expect(
    fakeFetch.requests.some((request) => isSourceHostRequest(request)),
  ).toBe(true)
})

const withGhostEmoji = (manifest: Manifest): Manifest => ({
  categories: manifest.categories.map((category) => ({
    ...category,
    emoticons: category.emoticons.map((emoticon) => {
      if (emoticon.id !== '1f3c1_chequeredflag') return emoticon
      const unofficial = { ...emoticon, id: 'ghost' }
      delete unofficial.origin
      return unofficial
    }),
  })),
})

const ghostRoutes = async () => {
  const { manifest } = await publishFirstGeneration()
  return {
    previousManifest: withGhostEmoji(manifest),
    liveRoutes: await buildLiveRoutes(
      path.join(context.workDirectory, 'out'),
      (v1Path) => v1Path.replace('1f3c1_chequeredflag', 'ghost'),
    ),
  }
}

test('retains the previous generation of an emoji removed in the sync', async () => {
  const { previousManifest, liveRoutes } = await ghostRoutes()
  const fakeFetch = createFakeFetch({ ...spriteRoutes(), ...liveRoutes })

  const result = await buildAssets(seedOptions(fakeFetch, previousManifest))

  expect(result.retained).toBe(1)
  const files = await listV1Sprites(
    path.join(context.workDirectory, 'out-next'),
  )
  expect(files.some((file) => file.includes('/ghost.'))).toBe(true)
})

test('reports when removed emoji retention is cut by the file budget', async () => {
  const { previousManifest, liveRoutes } = await ghostRoutes()
  const fakeFetch = createFakeFetch({ ...spriteRoutes(), ...liveRoutes })
  const summaryPath = path.join(context.workDirectory, 'summary.md')

  const result = await buildAssets({
    ...seedOptions(fakeFetch, previousManifest),
    maxOutputFiles: 1,
    stepSummaryPath: summaryPath,
  })

  expect(result.retained).toBe(0)
  expect(await readFile(summaryPath, 'utf8')).toContain('retention truncated')
})

test('drops a retained sheet whose image data is corrupt', async () => {
  const { previousManifest, liveRoutes } = await ghostRoutes()
  const ghostRoute = Object.keys(liveRoutes).find((route) =>
    route.includes('/ghost.'),
  )
  const original = liveRoutes[ghostRoute ?? '']?.body
  if (!(original instanceof Uint8Array))
    throw new TypeError('missing ghost sprite')
  const fakeFetch = createFakeFetch({
    ...spriteRoutes(),
    ...liveRoutes,
    [ghostRoute ?? '']: {
      body: original.subarray(0, -60),
    },
  })

  const result = await buildAssets(seedOptions(fakeFetch, previousManifest))

  expect(result.retained).toBe(0)
})
