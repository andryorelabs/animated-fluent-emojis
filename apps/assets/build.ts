import { rm } from 'node:fs/promises'
import path from 'node:path'

import type { Manifest } from '../../packages/animated-fluent-emojis/src/utils/types.js'
import {
  DOWNLOAD_CONCURRENCY,
  fileExists,
  getConversionConcurrency,
  readState,
  writeBytes,
  writeState,
  type BuildContext,
  type BuildOptions,
  type ConvertSprite,
} from './build-context.js'
import {
  buildCatalog,
  PIPELINE_VERSION,
  type HdSkippedEmoji,
  type SpriteTask,
} from './catalog.js'
import { HD_FRAME_SIZE, SPRITE_FRAME_SIZE } from './constants.js'
import { appendStepSummary, countFiles, MAX_OUTPUT_FILES } from './guards.js'
import { buildHdSheets, needsHdFromSameSource, storeHdSprite } from './hd.js'
import { fetchOk, mapWithConcurrency } from './http.js'
import { V1_DIRECTORY, validateV1Layout } from './layout-v1.js'
import { createLimiter } from './limiter.js'
import {
  applyAnimations,
  applyHd,
  diffManifests,
  pruneManifest,
  type AnimationState,
  type ManifestDiff,
} from './manifest-ops.js'
import { buildMitMediaUrl, loadMitIndex, type MitIndex } from './mit.js'
import { retainPreviousGeneration, seedUnchangedEmojis } from './seed.js'
import {
  copySpriteTrees,
  fetchLicenseText,
  LICENSE_FILE_COUNT,
  writeLicense,
  writeSiteFiles,
  type PublishedVersion,
} from './site-writer.js'
import { convertAnimatedPng } from './sprites.js'
import { fetchTeamsManifest } from './teams.js'
import { validateCatalog } from './validate.js'

/**
 * An official-repository emoji dropped from the build because one of its
 * sprites could not be produced.
 */
interface SkippedEmoji {
  readonly id: string
  readonly reason: string
}

/**
 * The outcome of a build.
 */
export interface BuildResult {
  readonly manifest: Manifest
  readonly version: PublishedVersion
  readonly spriteCount: number
  readonly downloaded: number
  readonly reused: number
  readonly skipped: readonly SkippedEmoji[]
  readonly hdSkipped: readonly HdSkippedEmoji[]
  readonly hdCount: number
  readonly seeded: number
  readonly retained: number
  readonly diff: ManifestDiff | undefined
}

type SpriteOutcome =
  | {
      status: 'ok'
      task: SpriteTask
      animation?: AnimationState | undefined
      reused: boolean
    }
  | { status: 'failed'; task: SpriteTask; error: Error }

async function produceSprite(
  task: SpriteTask,
  context: BuildContext,
): Promise<{
  task: SpriteTask
  animation?: AnimationState | undefined
  reused: boolean
}> {
  const { options, mitSha, state, convert } = context
  const target = path.join(options.cacheDirectory, task.outputPath)
  const cached = state[task.outputPath]
  if (cached?.etag === task.etag && (await fileExists(target))) {
    return { task, animation: cached.animation, reused: true }
  }

  if (task.source === 'teams' && task.sourceUrl) {
    const response = await fetchOk(options.fetchImplementation, task.sourceUrl)
    await writeBytes(target, new Uint8Array(await response.arrayBuffer()))
    state[task.outputPath] = { etag: task.etag }
    return { task, reused: false }
  }

  if (task.source === 'mit' && task.mitPath) {
    const response = await fetchOk(
      options.fetchImplementation,
      buildMitMediaUrl(mitSha, task.mitPath),
    )
    const includeHd = await needsHdFromSameSource(task, context)
    const [converted, hdConverted] = await convert(
      Buffer.from(await response.arrayBuffer()),
      includeHd ? [SPRITE_FRAME_SIZE, HD_FRAME_SIZE] : [SPRITE_FRAME_SIZE],
    )
    if (!converted) throw new Error('Converter returned no sprite')
    await writeBytes(target, converted.png)
    const animation = { fps: converted.fps, framesCount: converted.framesCount }
    state[task.outputPath] = { etag: task.etag, animation }
    if (includeHd && hdConverted)
      await storeHdSprite(task, hdConverted, context)
    return { task, animation, reused: false }
  }
  throw new Error(`Sprite task has no source: ${task.outputPath}`)
}

async function settleSprite(
  task: SpriteTask,
  context: BuildContext,
): Promise<SpriteOutcome> {
  try {
    return { status: 'ok', ...(await produceSprite(task, context)) }
  } catch (error: unknown) {
    return {
      status: 'failed',
      task,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

function assertNoPinnedSkipped(
  skippedById: ReadonlyMap<string, SkippedEmoji>,
  previousManifest: Manifest | undefined,
): void {
  const pinnedSkipped = (previousManifest?.categories ?? [])
    .flatMap((category) => category.emoticons)
    .filter(
      (emoticon) =>
        emoticon.origin === 'official' && skippedById.has(emoticon.id),
    )
    .map((emoticon) => emoticon.id)
  if (pinnedSkipped.length > 0) {
    throw new Error(
      `Pinned official emojis failed to build and would be dropped: ${pinnedSkipped.join(', ')}`,
    )
  }
}

function collectSkipped(
  outcomes: readonly SpriteOutcome[],
): Map<string, SkippedEmoji> {
  const skipped = new Map<string, SkippedEmoji>()
  for (const outcome of outcomes) {
    if (outcome.status === 'failed' && !skipped.has(outcome.task.id)) {
      skipped.set(outcome.task.id, {
        id: outcome.task.id,
        reason: `${outcome.task.outputPath}: ${outcome.error.message}`,
      })
    }
  }
  return skipped
}

function reportSkipped(
  summaryTitle: string,
  warningPrefix: string,
  skipped: readonly SkippedEmoji[],
  stepSummaryPath: string | undefined,
): void {
  if (skipped.length === 0) return
  for (const entry of skipped) {
    console.warn(`${warningPrefix} ${entry.id}: ${entry.reason}`)
  }
  appendStepSummary(
    `${summaryTitle} (${String(skipped.length)})`,
    skipped.map((entry) => `\`${entry.id}\`: ${entry.reason}`),
    stepSummaryPath,
  )
}

function limitCatalog(
  tasks: readonly SpriteTask[],
  limit: number | undefined,
): SpriteTask[] {
  if (limit === undefined) return [...tasks]
  const ids = new Set<string>()
  for (const task of tasks) {
    if (ids.size >= limit) break
    ids.add(task.id)
  }
  return tasks.filter((task) => ids.has(task.id))
}

function collectAnimations(
  results: readonly Extract<SpriteOutcome, { status: 'ok' }>[],
  mitEmojiIds: ReadonlySet<string>,
): Map<string, AnimationState> {
  const animationsById = new Map<string, AnimationState>()
  for (const result of results) {
    if (
      result.animation &&
      result.task.toneSuffix === '' &&
      mitEmojiIds.has(result.task.id)
    ) {
      animationsById.set(result.task.id, result.animation)
    }
  }
  return animationsById
}

/**
 * Builds the complete static site published to Cloudflare Pages: the merged
 * manifest, every sprite, the version marker, the headers file and the
 * license notice for the official repository assets.
 * @param options Build inputs.
 * @returns A summary of what was built.
 */
export async function buildAssets(options: BuildOptions): Promise<BuildResult> {
  const limitConversion = createLimiter(getConversionConcurrency())
  const rawConvert = options.convert ?? convertAnimatedPng
  const convert: ConvertSprite = (animatedPng, frameSizes) =>
    limitConversion(() => rawConvert(animatedPng, frameSizes))
  const githubHeaders = options.githubHeaders ?? {}
  const teamsManifest = await fetchTeamsManifest(
    options.fetchImplementation,
    options.teamsVersion.hash,
  )
  const mitIndex: MitIndex = await loadMitIndex(
    options.fetchImplementation,
    githubHeaders,
  )
  const catalog = buildCatalog(
    teamsManifest,
    mitIndex.emojis,
    options.previousManifest,
  )
  options.onPlanned?.(catalog.manifest)
  const limitedTasks = limitCatalog(catalog.tasks, options.limit)

  const state = await readState(options.cacheDirectory)
  const context: BuildContext = {
    options,
    mitSha: mitIndex.commitSha,
    state,
    convert,
  }
  const seeded = await seedUnchangedEmojis(
    limitedTasks,
    catalog.manifest,
    context,
  )
  const outcomes = await mapWithConcurrency(
    limitedTasks,
    DOWNLOAD_CONCURRENCY,
    (task) => settleSprite(task, context),
  )
  await writeState(options.cacheDirectory, state)

  const teamsFailures = outcomes.flatMap((outcome) =>
    outcome.status === 'failed' && outcome.task.source === 'teams'
      ? [outcome]
      : [],
  )
  if (teamsFailures.length > 0) {
    throw new AggregateError(
      teamsFailures.map((outcome) => outcome.error),
      `${String(teamsFailures.length)} Teams sprite download(s) failed:\n${teamsFailures
        .map((outcome) => `- ${outcome.task.id}: ${outcome.error.message}`)
        .join('\n')}`,
    )
  }

  const skippedById = collectSkipped(outcomes)
  assertNoPinnedSkipped(skippedById, options.previousManifest)
  const skipped = skippedById.values().toArray()
  const summaryPath = options.stepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY
  reportSkipped(
    'Skipped official emojis',
    'Skipped official emoji',
    skipped,
    summaryPath,
  )
  const tasks = limitedTasks.filter((task) => !skippedById.has(task.id))
  const results = outcomes.filter((outcome) => outcome.status === 'ok')

  const generatedIds = new Set(tasks.map((task) => task.id))
  const keptManifest = pruneManifest(
    catalog.manifest,
    new Set(skippedById.keys()),
    options.limit === undefined ? undefined : generatedIds,
  )
  const animatedManifest = applyAnimations(
    keptManifest,
    collectAnimations(results, catalog.mitEmojiIds),
  )

  const hd = await buildHdSheets(tasks, animatedManifest, context)
  await writeState(options.cacheDirectory, state)
  const hdSkipped = [...catalog.hdSkipped, ...hd.skipped]
  reportSkipped('Emojis without HD', 'Skipped HD for', hdSkipped, summaryPath)
  const manifest = applyHd(animatedManifest, hd.hdEtagById)
  const skippedIds = [
    ...new Set([
      ...skipped.map((entry) => entry.id),
      ...hd.skipped
        .filter((entry) => entry.transient === true)
        .map((entry) => entry.id),
    ]),
  ].toSorted((a, b) => a.localeCompare(b))

  await validateCatalog({
    manifest,
    tasks: hd.tasks,
    cacheDirectory: options.cacheDirectory,
  })

  await rm(options.outputDirectory, { recursive: true, force: true })
  await copySpriteTrees({
    tasks: hd.tasks,
    manifest,
    cacheDirectory: options.cacheDirectory,
    outputDirectory: options.outputDirectory,
  })

  const license = await fetchLicenseText(
    options.fetchImplementation,
    mitIndex.commitSha,
  )
  const version: PublishedVersion = {
    teamsHash: options.teamsVersion.hash,
    teamsLastModified: options.teamsVersion.lastModified,
    mitSha: mitIndex.commitSha,
    builtAt: (options.now ?? (() => new Date()))().toISOString(),
    pipelineVersion: PIPELINE_VERSION,
    layouts: [V1_DIRECTORY],
    ...(skippedIds.length > 0 && { skippedIds }),
    ...(options.limit !== undefined && { limited: true as const }),
  }
  await writeSiteFiles({
    manifest,
    version,
    outputDirectory: options.outputDirectory,
  })
  const fileBudget =
    (options.maxOutputFiles ?? MAX_OUTPUT_FILES) -
    (await countFiles(options.outputDirectory)) -
    LICENSE_FILE_COUNT
  const retention = await retainPreviousGeneration({
    options,
    manifest,
    emojiIds: generatedIds,
    fileBudget,
  })
  await validateV1Layout({
    manifest,
    tasks: hd.tasks,
    outputDirectory: options.outputDirectory,
    retained: retention.retained,
  })
  await writeLicense(options.outputDirectory, license)

  const reused = results.filter((result) => result.reused).length
  return {
    manifest,
    version,
    spriteCount: tasks.length,
    downloaded: results.length - reused,
    reused,
    skipped,
    hdSkipped,
    hdCount: hd.hdEtagById.size,
    seeded,
    retained: retention.emojiCount,
    diff: options.previousManifest
      ? diffManifests(options.previousManifest, manifest)
      : undefined,
  }
}
