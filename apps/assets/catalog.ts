import { createHash } from 'node:crypto'

import type { Manifest } from '../../packages/animated-fluent-emojis/src/utils/types.js'
import { glyphToCodepoints } from './codepoints.js'
import { indexEmoticons, TONE_SUFFIXES, type Emoticon } from './constants.js'
import type { MitEmoji } from './mit.js'
import { buildSpriteUrl } from './teams.js'

const CATEGORY_BY_MIT_GROUP: Readonly<Record<string, string>> = {
  'Smileys & Emotion': 'Smilies',
  'People & Body': 'People',
  'Animals & Nature': 'Animals',
  'Food & Drink': 'Food',
  'Travel & Places': 'Travel and places',
  Activities: 'Activities',
  Objects: 'Objects',
  Symbols: 'Symbols',
  Flags: 'Symbols',
}

const CATEGORY_OVERRIDES_BY_CODEPOINTS: Readonly<Record<string, string>> = {
  '1f595': 'Hand gestures',
}

/**
 * Bump whenever the sprite converter changes its output, so every etag, and
 * with it the year-long `?v=` cache, changes.
 */
export const PIPELINE_VERSION = 1

const ETAG_LENGTH = 8

const PLACEHOLDER_ANIMATION = { fps: 0, framesCount: 0, firstFrame: 1 }

/**
 * Where a sprite comes from and where it is published.
 */
export interface SpriteTask {
  readonly source: 'teams' | 'mit'
  readonly id: string
  readonly category: string
  readonly toneSuffix: string
  readonly etag: string
  readonly sourceUrl?: string | undefined
  readonly mitPath?: string | undefined
  readonly outputPath: string
  readonly hdOutputPath?: string | undefined
  readonly hdMitPath?: string | undefined
  readonly hdBlobSha?: string | undefined
}

/**
 * An emoji that has an official HD source for some tones but not all, so it
 * is published without HD sheets. `transient` marks a failure that a retry
 * can fix, which keeps the site stale until a build clears it.
 */
export interface HdSkippedEmoji {
  readonly id: string
  readonly reason: string
  readonly transient?: true
}

/**
 * The merged emoji catalog and the sprites needed to serve it.
 */
export interface Catalog {
  readonly manifest: Manifest
  readonly tasks: readonly SpriteTask[]
  readonly mitEmojiIds: ReadonlySet<string>
  readonly hdSkipped: readonly HdSkippedEmoji[]
}

/**
 * Builds the published path of a sprite.
 * @param category The category folder.
 * @param id The emoji id.
 * @param toneSuffix The skin tone suffix.
 * @returns A path like `sprites/Smilies/1f603_grinningfacewithbigeyes.png`.
 */
export function buildOutputPath(
  category: string,
  id: string,
  toneSuffix: string,
): string {
  return `sprites/${category}/${id}${toneSuffix}.png`
}

/**
 * Builds the published path of an HD sprite, next to the standard one.
 * @param category The category folder.
 * @param id The emoji id.
 * @param toneSuffix The skin tone suffix.
 * @returns A path like `sprites/Smilies/1f603_grinningfacewithbigeyes@2x.png`.
 */
export function buildHdOutputPath(
  category: string,
  id: string,
  toneSuffix: string,
): string {
  return `sprites/${category}/${id}${toneSuffix}@2x.png`
}

/**
 * Derives the etag of an emoji that is published with HD sheets. It is the
 * `?v=` of both the 1x and the 2x URL, so it changes with the HD sources too.
 * @param baseEtag The etag the emoji has without HD.
 * @param hdSources The official source SHA of every tone's HD sheet.
 * @returns A short hex etag that changes with the base etag or any HD source.
 */
export function hashHdEtag(
  baseEtag: string,
  hdSources: readonly { toneSuffix: string; blobSha: string }[],
): string {
  return hashEtag([
    `base:${baseEtag}`,
    ...hdSources
      .toSorted((left, right) =>
        left.toneSuffix.localeCompare(right.toneSuffix),
      )
      .map((source) => `hd:${source.toneSuffix}:${source.blobSha}`),
  ])
}

/**
 * Hashes source identifiers and the pipeline version into a short etag.
 * @param sourceIdentifiers Every source file SHA the output depends on.
 * @returns A short hex etag that changes with any identifier or the version.
 */
export function hashEtag(sourceIdentifiers: readonly string[]): string {
  return createHash('sha256')
    .update(JSON.stringify([PIPELINE_VERSION, ...sourceIdentifiers]))
    .digest('hex')
    .slice(0, ETAG_LENGTH)
}

function slugify(text: string): string {
  return text.toLowerCase().replaceAll(/[^\da-z]/g, '')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Maps an official emoji to the category folder it is published under.
 * @param emoji The official emoji.
 * @returns The Teams-style category title.
 */
export function resolveCategory(emoji: MitEmoji): string {
  const override = CATEGORY_OVERRIDES_BY_CODEPOINTS[emoji.codepoints]
  if (override) return override
  const category = CATEGORY_BY_MIT_GROUP[emoji.group]
  if (!category) {
    throw new Error(
      `Unmapped official emoji group "${emoji.group}" (${emoji.cldr})`,
    )
  }
  return category
}

function dedupeKeepingLast(manifest: Manifest): Manifest {
  const lastCategoryById = new Map<string, number>()
  for (const [categoryIndex, category] of manifest.categories.entries()) {
    for (const emoticon of category.emoticons) {
      lastCategoryById.set(emoticon.id, categoryIndex)
    }
  }
  return {
    categories: manifest.categories.map((category, categoryIndex) => ({
      ...category,
      emoticons: category.emoticons.filter(
        (emoticon) => lastCategoryById.get(emoticon.id) === categoryIndex,
      ),
    })),
  }
}

function buildTeamsTasks(manifest: Manifest): SpriteTask[] {
  return manifest.categories.flatMap((category) =>
    category.emoticons.flatMap((emoticon) => {
      const suffixes = emoticon.diverse ? ['', ...TONE_SUFFIXES] : ['']
      return suffixes.map((toneSuffix): SpriteTask => ({
        source: 'teams',
        id: emoticon.id,
        category: category.title,
        toneSuffix,
        etag: emoticon.etag,
        sourceUrl: buildSpriteUrl(emoticon.id, toneSuffix),
        outputPath: buildOutputPath(category.title, emoticon.id, toneSuffix),
      }))
    }),
  )
}

function collectPinnedOfficialIds(
  previousManifest: Manifest | undefined,
  mitEmojis: readonly MitEmoji[],
  teamsIds: ReadonlySet<string>,
): Map<string, string> {
  const pinnedIdByCodepoints = new Map<string, string>()
  const officialCodepoints = new Set(mitEmojis.map((emoji) => emoji.codepoints))
  const previousCategories = previousManifest?.categories ?? []
  for (const category of previousCategories) {
    for (const emoticon of category.emoticons) {
      if (emoticon.origin !== 'official') continue
      const codepoints = glyphToCodepoints(emoticon.unicode)
      if (!officialCodepoints.has(codepoints)) {
        throw new Error(
          `Pinned official emoji "${emoticon.id}" no longer exists in the official repository`,
        )
      }
      if (!teamsIds.has(emoticon.id)) {
        pinnedIdByCodepoints.set(codepoints, emoticon.id)
      }
    }
  }
  return pinnedIdByCodepoints
}

function buildMitEmoticon(emoji: MitEmoji, id: string, etag: string): Emoticon {
  return {
    id,
    description: capitalize(emoji.cldr),
    shortcuts: [],
    unicode: emoji.glyph,
    etag,
    diverse: emoji.sprites.some((sprite) => sprite.toneSuffix !== ''),
    animation: PLACEHOLDER_ANIMATION,
    keywords: [...emoji.keywords],
    origin: 'official',
  }
}

/**
 * Merges the Teams manifest with the official emojis Teams does not have.
 * @param teamsManifest The Teams emoticon manifest.
 * Official ids published before are pinned: they stay in the catalog, sourced
 * from the official repository, even when Teams now has the emoji.
 * @param mitEmojis The official repository emojis.
 * @param previousManifest The previously published manifest, if any.
 * @returns The final manifest and the sprites to produce.
 */
export function buildCatalog(
  teamsManifest: Manifest,
  mitEmojis: readonly MitEmoji[],
  previousManifest?: Manifest,
): Catalog {
  const teams = dedupeKeepingLast(teamsManifest)
  const teamsCodepoints = new Set(
    teams.categories.flatMap((category) =>
      category.emoticons.map((emoticon) => glyphToCodepoints(emoticon.unicode)),
    ),
  )
  const usedIds = new Set(
    teams.categories.flatMap((category) =>
      category.emoticons.map((emoticon) => emoticon.id),
    ),
  )

  const pinnedIdByCodepoints = collectPinnedOfficialIds(
    previousManifest,
    mitEmojis,
    usedIds,
  )
  for (const pinnedId of pinnedIdByCodepoints.values()) usedIds.add(pinnedId)

  const missing = mitEmojis.filter(
    (emoji) =>
      !teamsCodepoints.has(emoji.codepoints) ||
      pinnedIdByCodepoints.has(emoji.codepoints),
  )
  const tasks = buildTeamsTasks(teams)
  const codepointsById = new Map(
    indexEmoticons(teams)
      .values()
      .map(
        (emoticon) =>
          [emoticon.id, glyphToCodepoints(emoticon.unicode)] as const,
      ),
  )
  const additionsByCategory = new Map<string, Emoticon[]>()
  const mitEmojiIds = new Set<string>()

  for (const emoji of missing) {
    const baseId = `${emoji.codepoints.replaceAll('-', '_')}_${slugify(emoji.cldr)}`
    const id =
      pinnedIdByCodepoints.get(emoji.codepoints) ??
      (usedIds.has(baseId) ? `${baseId}_mit` : baseId)
    usedIds.add(id)
    mitEmojiIds.add(id)
    codepointsById.set(id, emoji.codepoints)
    const category = resolveCategory(emoji)
    const etag = hashEtag(
      emoji.sprites.map((sprite) => `${sprite.toneSuffix}:${sprite.blobSha}`),
    )
    additionsByCategory.set(category, [
      ...(additionsByCategory.get(category) ?? []),
      buildMitEmoticon(emoji, id, etag),
    ])
    for (const sprite of emoji.sprites) {
      tasks.push({
        source: 'mit',
        id,
        category,
        toneSuffix: sprite.toneSuffix,
        etag: hashEtag([`${sprite.toneSuffix}:${sprite.blobSha}`]),
        mitPath: sprite.path,
        outputPath: buildOutputPath(category, id, sprite.toneSuffix),
      })
    }
  }

  const knownTitles = new Set(
    teams.categories.map((category) => category.title),
  )
  for (const category of additionsByCategory.keys()) {
    if (!knownTitles.has(category)) {
      throw new Error(`Category "${category}" is not in the Teams manifest`)
    }
  }

  const manifest: Manifest = {
    categories: teams.categories.map((category) => ({
      ...category,
      emoticons: [
        ...category.emoticons.map((emoticon) => clampPosterFrame(emoticon)),
        ...(additionsByCategory.get(category.title) ?? []),
      ],
    })),
  }
  const hd = planHdTasks(tasks, codepointsById, mitEmojis)
  return {
    manifest,
    tasks: hd.tasks,
    mitEmojiIds,
    hdSkipped: hd.skipped,
  }
}

/**
 * The most frames an emoji may have and still get an HD sheet: 81 frames of
 * 200 px is 16,200 px, under Chromium's 16,384 px texture limit.
 */
export const HD_MAX_FRAMES = 81

/**
 * The tallest image Chromium uploads as a texture, in pixels.
 */
export const MAX_TEXTURE_HEIGHT = 16_384

function planHdTasks(
  tasks: readonly SpriteTask[],
  codepointsById: ReadonlyMap<string, string>,
  mitEmojis: readonly MitEmoji[],
): { tasks: SpriteTask[]; skipped: HdSkippedEmoji[] } {
  const officialByCodepoints = new Map(
    mitEmojis.map((emoji) => [emoji.codepoints, emoji] as const),
  )
  const tasksById = Map.groupBy(tasks, (task) => task.id)
  const skipped: HdSkippedEmoji[] = []
  const planned = [...tasksById].flatMap(([id, emojiTasks]) => {
    const codepoints = codepointsById.get(id)
    const official =
      codepoints === undefined
        ? undefined
        : officialByCodepoints.get(codepoints)
    if (!official) return emojiTasks
    const sourceByTone = new Map(
      official.sprites.map((sprite) => [sprite.toneSuffix, sprite] as const),
    )
    const missingTones = emojiTasks
      .filter((task) => !sourceByTone.has(task.toneSuffix))
      .map((task) => task.toneSuffix || 'default')
    if (missingTones.length > 0) {
      skipped.push({
        id,
        reason: `official source has no HD sprite for ${missingTones.join(', ')}`,
      })
      return emojiTasks
    }
    return emojiTasks.map((task): SpriteTask => {
      const source = sourceByTone.get(task.toneSuffix)
      if (!source) return task
      return {
        ...task,
        hdOutputPath: buildHdOutputPath(task.category, id, task.toneSuffix),
        hdMitPath: source.path,
        hdBlobSha: source.blobSha,
      }
    })
  })
  return { tasks: planned, skipped }
}

/**
 * Keeps an emoticon's poster frame inside its sprite sheet. Teams ships a few
 * single-frame emojis whose `firstFrame` points past the only frame, which
 * would render as an empty box at rest.
 * @param emoticon The emoticon as published by Teams.
 * @returns The emoticon with `firstFrame` clamped to `[1, framesCount]`, or the
 * same emoticon when `framesCount` is not yet known or already valid.
 */
function clampPosterFrame(emoticon: Emoticon): Emoticon {
  const { framesCount, firstFrame } = emoticon.animation
  if (framesCount < 1 || firstFrame <= framesCount) return emoticon
  return {
    ...emoticon,
    animation: { ...emoticon.animation, firstFrame: framesCount },
  }
}
