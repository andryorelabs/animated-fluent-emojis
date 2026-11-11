import path from "node:path";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import {
  DOWNLOAD_CONCURRENCY,
  fileExists,
  writeBytes,
  type BuildContext,
} from "./build-context.js";
import {
  buildHdOutputPath,
  buildOutputPath,
  hashHdEtag,
  HD_MAX_FRAMES,
  type SpriteTask,
} from "./catalog.js";
import { HD_FRAME_SIZE, indexEmoticons, SPRITE_FRAME_SIZE, TONE_SUFFIXES } from "./constants.js";
import { appendStepSummary } from "./guards.js";
import { getHdEtag, withoutHdSource } from "./hd.js";
import { fetchOkOrMissing, mapWithConcurrency, type FetchLike } from "./http.js";
import { buildV1SpritePath, type RetainedSprite } from "./layout-v1.js";
import { findSpriteSheetProblem } from "./validate.js";

/**
 * What the previously published manifest says about one emoji.
 */
interface PreviousEmoji {
  readonly id: string;
  readonly categoryTitle: string;
  readonly etag: string;
  readonly diverse: boolean;
  readonly hd: boolean;
  readonly fps: number;
  readonly framesCount: number;
}

/**
 * A sprite sheet downloaded from the live site and checked.
 */
interface LiveSprite {
  readonly legacyPath: string;
  readonly v1Path: string;
  readonly bytes: Buffer;
  readonly hd: boolean;
  readonly framesCount: number;
}

interface SpriteFileRef {
  readonly legacyPath: string;
  readonly hd: boolean;
}

/**
 * Builds the live URL of a file in the versioned layout.
 * @param liveUrl The base URL of the published site.
 * @param v1Path A relative path such as `v1/sprites/Cat/id.<etag>.png`.
 * @returns The URL with every path segment percent-encoded.
 */
export function buildLiveSpriteUrl(liveUrl: string, v1Path: string): string {
  const encoded = v1Path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${liveUrl.replace(/\/+$/, "")}/${encoded}`;
}

/**
 * Indexes the previously published manifest by emoji id.
 * @param manifest The previous manifest, if any.
 * @returns What is known about each previously published emoji.
 */
function indexPreviousEmojis(manifest: Manifest | undefined): Map<string, PreviousEmoji> {
  const entries = (manifest?.categories ?? []).flatMap((category) =>
    category.emoticons.map((emoticon): [string, PreviousEmoji] => [
      emoticon.id,
      {
        id: emoticon.id,
        categoryTitle: category.title,
        etag: emoticon.etag,
        diverse: emoticon.diverse,
        hd: (emoticon as { hd?: unknown }).hd === true,
        fps: emoticon.animation.fps,
        framesCount: emoticon.animation.framesCount,
      },
    ]),
  );
  return new Map(entries);
}

/**
 * Derives the etag an emoji will be published under, before building it.
 * @param baseEtag The etag the catalog gives the emoji without HD.
 * @param emojiTasks Every sprite task of the emoji.
 * @returns The HD-aware etag when every tone has an HD source, else the base.
 */
function expectEmojiEtag(baseEtag: string, emojiTasks: readonly SpriteTask[]): string {
  const withHd = emojiTasks.filter(
    (task) => task.hdOutputPath !== undefined && task.hdBlobSha !== undefined,
  );
  if (withHd.length === 0 || withHd.length !== emojiTasks.length) {
    return baseEtag;
  }
  return hashHdEtag(
    baseEtag,
    withHd.map((task) => ({
      toneSuffix: task.toneSuffix,
      blobSha: task.hdBlobSha ?? "",
    })),
  );
}

async function downloadLiveSprite(
  fetchImplementation: FetchLike,
  liveUrl: string,
  file: SpriteFileRef,
  previous: PreviousEmoji,
): Promise<LiveSprite | undefined> {
  const v1Path = buildV1SpritePath(file.legacyPath, previous.etag);
  try {
    const response = await fetchOkOrMissing(
      fetchImplementation,
      buildLiveSpriteUrl(liveUrl, v1Path),
    );
    if (!response) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    const problem = await findSpriteSheetProblem(
      bytes,
      file.hd ? HD_FRAME_SIZE : SPRITE_FRAME_SIZE,
      previous.framesCount,
    );
    if (problem !== undefined) {
      console.warn(`Live sprite ${v1Path} ${problem}`);
      return undefined;
    }
    return {
      legacyPath: file.legacyPath,
      v1Path,
      bytes,
      hd: file.hd,
      framesCount: previous.framesCount,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Live sprite ${v1Path} could not be fetched: ${message}`);
    return undefined;
  }
}

async function downloadAll(
  fetchImplementation: FetchLike,
  liveUrl: string,
  files: readonly SpriteFileRef[],
  previous: PreviousEmoji,
): Promise<LiveSprite[] | undefined> {
  const sprites = await Promise.all(
    files.map((file) => downloadLiveSprite(fetchImplementation, liveUrl, file, previous)),
  );
  return sprites.every((sprite) => sprite !== undefined) ? sprites : undefined;
}

/**
 * Lists the legacy-relative sprite paths a previously published emoji owns.
 * @param previous The emoji as the previous manifest described it.
 * @returns Every standard sheet, plus every HD sheet when it was published.
 */
function listPreviousFiles(previous: PreviousEmoji): SpriteFileRef[] {
  const suffixes = previous.diverse ? ["", ...TONE_SUFFIXES] : [""];
  return suffixes.flatMap((suffix) => [
    {
      legacyPath: buildOutputPath(previous.categoryTitle, previous.id, suffix),
      hd: false,
    },
    ...(previous.hd
      ? [
          {
            legacyPath: buildHdOutputPath(previous.categoryTitle, previous.id, suffix),
            hd: true,
          },
        ]
      : []),
  ]);
}

/**
 * Downloads every sheet of an unchanged emoji from the live versioned layout.
 * It is all or nothing: one missing or invalid file rejects the whole emoji so
 * its tones and HD sheets always come from one source.
 * @param fetchImplementation The fetch function to use.
 * @param liveUrl The base URL of the published site.
 * @param emojiTasks Every sprite task of the emoji.
 * @param previous The emoji as the previous manifest described it.
 * @returns The checked sheets, or undefined to build from source.
 */
function seedFromLive(
  fetchImplementation: FetchLike,
  liveUrl: string,
  emojiTasks: readonly SpriteTask[],
  previous: PreviousEmoji,
): Promise<LiveSprite[] | undefined> {
  const files = emojiTasks.flatMap((task): SpriteFileRef[] => [
    { legacyPath: task.outputPath, hd: false },
    ...(task.hdOutputPath === undefined ? [] : [{ legacyPath: task.hdOutputPath, hd: true }]),
  ]);
  return downloadAll(fetchImplementation, liveUrl, files, previous);
}

/**
 * Downloads the previous generation of a changed emoji from the live layout,
 * under its old etag file names.
 * @param fetchImplementation The fetch function to use.
 * @param liveUrl The base URL of the published site.
 * @param previous The emoji as the previous manifest described it.
 * @returns The checked sheets, or undefined when any is missing or invalid.
 */
function retainFromLive(
  fetchImplementation: FetchLike,
  liveUrl: string,
  previous: PreviousEmoji,
): Promise<LiveSprite[] | undefined> {
  return downloadAll(fetchImplementation, liveUrl, listPreviousFiles(previous), previous);
}

async function seedEmoji(
  emojiTasks: readonly SpriteTask[],
  previous: PreviousEmoji,
  context: BuildContext,
  liveUrl: string,
): Promise<boolean> {
  const { options, state } = context;
  const sprites = await seedFromLive(options.fetchImplementation, liveUrl, emojiTasks, previous);
  if (!sprites) return false;
  const animation = { fps: previous.fps, framesCount: previous.framesCount };
  const taskByPath = new Map(
    emojiTasks.flatMap((task) => [
      [task.outputPath, task] as const,
      ...(task.hdOutputPath === undefined ? [] : [[task.hdOutputPath, task] as const]),
    ]),
  );
  for (const sprite of sprites) {
    const task = taskByPath.get(sprite.legacyPath);
    if (!task) continue;
    await writeBytes(path.join(options.cacheDirectory, sprite.legacyPath), sprite.bytes);
    state[sprite.legacyPath] = {
      etag: sprite.hd ? getHdEtag(task) : task.etag,
      animation,
    };
  }
  return true;
}

async function isEmojiCached(
  emojiTasks: readonly SpriteTask[],
  context: BuildContext,
): Promise<boolean> {
  const { options, state } = context;
  const checks = await Promise.all(
    emojiTasks.map(async (task) => {
      const cached = state[task.outputPath];
      return (
        cached?.etag === task.etag &&
        (await fileExists(path.join(options.cacheDirectory, task.outputPath)))
      );
    }),
  );
  return checks.every(Boolean);
}

/**
 * Seeds the cache from the live site for every emoji whose planned etag equals
 * the published one, so unchanged emoji are not downloaded or converted again.
 * @param tasks The planned sprite tasks.
 * @param catalogManifest The planned manifest.
 * @param context The build context.
 * @returns How many emoji were seeded.
 */
export async function seedUnchangedEmojis(
  tasks: readonly SpriteTask[],
  catalogManifest: Manifest,
  context: BuildContext,
): Promise<number> {
  const { liveUrl, previousManifest } = context.options;
  if (liveUrl === undefined || previousManifest === undefined) return 0;
  const previousById = indexPreviousEmojis(previousManifest);
  const baseEtagById = indexEmoticons(catalogManifest);
  const candidates = Map.groupBy(tasks, (task) => task.id)
    .entries()
    .map(([id, emojiTasks]): [string, readonly SpriteTask[]] => [
      id,
      (previousById.get(id)?.framesCount ?? 0) > HD_MAX_FRAMES
        ? emojiTasks.map((task) => withoutHdSource(task))
        : emojiTasks,
    ])
    .filter(([id, emojiTasks]) => {
      const previous = previousById.get(id);
      const baseEtag = baseEtagById.get(id)?.etag;
      return (
        previous !== undefined &&
        baseEtag !== undefined &&
        previous.etag === expectEmojiEtag(baseEtag, emojiTasks) &&
        previous.hd === emojiTasks.every((task) => task.hdOutputPath)
      );
    })
    .toArray();
  const seeded = await mapWithConcurrency(
    candidates,
    DOWNLOAD_CONCURRENCY,
    async ([id, emojiTasks]) => {
      const previous = previousById.get(id);
      const cached = await isEmojiCached(emojiTasks, context);
      return previous && !cached ? seedEmoji(emojiTasks, previous, context, liveUrl) : false;
    },
  );
  return seeded.filter(Boolean).length;
}

/**
 * Copies the previous generation of changed and removed emoji from the live
 * site into the output, so clients on the old manifest keep working.
 * @param input Everything retention needs.
 * @param input.options The build options.
 * @param input.manifest The new manifest.
 * @param input.emojiIds The ids generated in this run.
 * @param input.fileBudget How many more files the output may hold.
 * @returns The retained sheets and how many emoji were retained.
 */
export async function retainPreviousGeneration(input: {
  options: BuildContext["options"];
  manifest: Manifest;
  emojiIds: ReadonlySet<string>;
  fileBudget: number;
}): Promise<{ retained: RetainedSprite[]; emojiCount: number }> {
  const { options, manifest, emojiIds, fileBudget } = input;
  if (options.liveUrl === undefined || options.previousManifest === undefined) {
    return { retained: [], emojiCount: 0 };
  }
  const liveUrl = options.liveUrl;
  const previousById = indexPreviousEmojis(options.previousManifest);
  const currentIds = new Set(indexEmoticons(manifest).keys());
  const changed = indexEmoticons(manifest)
    .values()
    .filter((emoticon) => emojiIds.has(emoticon.id))
    .flatMap((emoticon) => {
      const previous = previousById.get(emoticon.id);
      return previous && previous.etag !== emoticon.etag ? [previous] : [];
    })
    .toArray()
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const removed =
    options.limit === undefined
      ? previousById
          .values()
          .filter((previous) => !currentIds.has(previous.id))
          .toArray()
          .toSorted((left, right) => left.id.localeCompare(right.id))
      : [];
  let remaining = fileBudget;
  const affordable: PreviousEmoji[] = [];
  let truncated = 0;
  for (const previous of [...changed, ...removed]) {
    const fileCount = listPreviousFiles(previous).length;
    if (fileCount > remaining) {
      truncated += 1;
      continue;
    }
    remaining -= fileCount;
    affordable.push(previous);
  }
  if (truncated > 0) {
    appendStepSummary(
      "Previous generation retention truncated",
      [
        `${String(truncated)} changed or removed emoji(s) were not retained: the file budget was exhausted`,
      ],
      options.stepSummaryPath,
    );
  }
  const downloaded = await mapWithConcurrency(affordable, DOWNLOAD_CONCURRENCY, (previous) =>
    retainFromLive(options.fetchImplementation, liveUrl, previous),
  );
  const kept = downloaded.filter((sprites): sprites is LiveSprite[] => sprites !== undefined);
  for (const sprite of kept.flat()) {
    await writeBytes(path.join(options.outputDirectory, sprite.v1Path), sprite.bytes);
  }
  return {
    retained: kept.flat().map(({ v1Path, hd, framesCount }) => ({
      v1Path,
      hd,
      framesCount,
    })),
    emojiCount: kept.length,
  };
}
