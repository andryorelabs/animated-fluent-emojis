import path from "node:path";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import {
  DOWNLOAD_CONCURRENCY,
  fileExists,
  writeBytes,
  type BuildContext,
} from "./build-context.js";
import {
  hashEtag,
  hashHdEtag,
  HD_MAX_FRAMES,
  type HdSkippedEmoji,
  type SpriteTask,
} from "./catalog.js";
import { HD_FRAME_SIZE, indexEmoticons } from "./constants.js";
import { fetchOk, mapWithConcurrency } from "./http.js";
import { buildMitMediaUrl } from "./mit.js";
import type { ConvertedSprite } from "./sprites.js";

type HdOutcome = { task: SpriteTask; framesCount: number } | { task: SpriteTask; error: Error };

/**
 * Computes the etag of an HD sheet from its source blob.
 * @param task The sprite task with an HD source.
 * @returns The etag the cache stores for the HD sheet.
 */
export function getHdEtag(task: SpriteTask): string {
  return hashEtag(["hd", task.hdBlobSha ?? ""]);
}

async function isHdCached(task: SpriteTask, context: BuildContext): Promise<boolean> {
  if (!task.hdOutputPath) return false;
  const cached = context.state[task.hdOutputPath];
  return (
    cached?.etag === getHdEtag(task) &&
    cached.animation !== undefined &&
    (await fileExists(path.join(context.options.cacheDirectory, task.hdOutputPath)))
  );
}

/**
 * Tells whether the HD sheet can come from the same download as the standard
 * one and is not cached yet.
 * @param task The sprite task being produced.
 * @param context The build context.
 * @returns Whether the conversion should also produce the HD sheet.
 */
export async function needsHdFromSameSource(
  task: SpriteTask,
  context: BuildContext,
): Promise<boolean> {
  return (
    task.hdOutputPath !== undefined &&
    task.hdBlobSha !== undefined &&
    task.hdMitPath === task.mitPath &&
    !(await isHdCached(task, context))
  );
}

/**
 * Stores a converted HD sheet in the cache and records it in the state.
 * @param task The sprite task that owns the HD sheet.
 * @param converted The converted HD sheet.
 * @param context The build context.
 */
export async function storeHdSprite(
  task: SpriteTask,
  converted: ConvertedSprite,
  context: BuildContext,
): Promise<void> {
  const { options, state } = context;
  if (!task.hdOutputPath) return;
  await writeBytes(path.join(options.cacheDirectory, task.hdOutputPath), converted.png);
  state[task.hdOutputPath] = {
    etag: getHdEtag(task),
    animation: { fps: converted.fps, framesCount: converted.framesCount },
  };
}

async function produceHdSprite(task: SpriteTask, context: BuildContext): Promise<number> {
  const { options, mitSha, convert } = context;
  const { hdOutputPath, hdMitPath, hdBlobSha } = task;
  if (!hdOutputPath || !hdMitPath || !hdBlobSha) {
    throw new Error(`Sprite task has no HD source: ${task.outputPath}`);
  }
  const cached = context.state[hdOutputPath];
  if (cached?.animation && (await isHdCached(task, context))) {
    return cached.animation.framesCount;
  }
  const response = await fetchOk(options.fetchImplementation, buildMitMediaUrl(mitSha, hdMitPath));
  const [converted] = await convert(Buffer.from(await response.arrayBuffer()), [HD_FRAME_SIZE]);
  if (!converted) throw new Error("Converter returned no sprite");
  await storeHdSprite(task, converted, context);
  return converted.framesCount;
}

async function settleHdSprite(task: SpriteTask, context: BuildContext): Promise<HdOutcome> {
  try {
    return { task, framesCount: await produceHdSprite(task, context) };
  } catch (error: unknown) {
    return {
      task,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Drops the HD source of a task, for an emoji that will not ship HD sheets.
 * @param task The planned sprite task.
 * @returns The task without HD fields.
 */
export function withoutHdSource(task: SpriteTask): SpriteTask {
  return {
    source: task.source,
    id: task.id,
    category: task.category,
    toneSuffix: task.toneSuffix,
    etag: task.etag,
    outputPath: task.outputPath,
    ...(task.sourceUrl !== undefined && { sourceUrl: task.sourceUrl }),
    ...(task.mitPath !== undefined && { mitPath: task.mitPath }),
  };
}

function describeHdProblem(
  emojiOutcomes: readonly HdOutcome[],
  standardFrames: number,
): Omit<HdSkippedEmoji, "id"> | undefined {
  for (const outcome of emojiOutcomes) {
    if ("error" in outcome) {
      return {
        reason: `${outcome.task.hdOutputPath ?? ""}: ${outcome.error.message}`,
        transient: true,
      };
    }
    if (outcome.framesCount !== standardFrames) {
      return {
        reason: `${outcome.task.hdOutputPath ?? ""} has ${String(outcome.framesCount)} frames, standard sheet has ${String(standardFrames)}`,
      };
    }
  }
  return undefined;
}

/**
 * Produces the HD sheets of every emoji under the frame cap and decides which
 * emoji ship them.
 * @param tasks The sprite tasks that were built.
 * @param manifest The manifest with real animations.
 * @param context The shared state of the running build.
 * @returns The tasks with HD sources only where HD ships, the HD-aware etag of
 * each HD emoji and the emoji skipped for a problem.
 */
export async function buildHdSheets(
  tasks: readonly SpriteTask[],
  manifest: Manifest,
  context: BuildContext,
): Promise<{
  tasks: SpriteTask[];
  hdEtagById: Map<string, string>;
  skipped: HdSkippedEmoji[];
}> {
  const emoticonById = indexEmoticons(manifest);
  const emojiTasksById = Map.groupBy(
    tasks.filter(
      (task) =>
        task.hdOutputPath !== undefined &&
        (emoticonById.get(task.id)?.animation.framesCount ?? 0) <= HD_MAX_FRAMES,
    ),
    (task) => task.id,
  );
  const outcomes = await mapWithConcurrency(
    emojiTasksById.values().toArray().flat(),
    DOWNLOAD_CONCURRENCY,
    (task) => settleHdSprite(task, context),
  );
  const outcomesById = Map.groupBy(outcomes, (outcome) => outcome.task.id);
  const hdEtagById = new Map<string, string>();
  const skipped: HdSkippedEmoji[] = [];
  for (const [id, emojiOutcomes] of outcomesById) {
    const emoticon = emoticonById.get(id);
    const problem =
      emoticon === undefined
        ? { reason: "emoji is not in the manifest" }
        : describeHdProblem(emojiOutcomes, emoticon.animation.framesCount);
    if (problem !== undefined || emoticon === undefined) {
      skipped.push({
        id,
        ...(problem ?? { reason: "emoji is not in the manifest" }),
      });
      continue;
    }
    hdEtagById.set(
      id,
      hashHdEtag(
        emoticon.etag,
        emojiOutcomes.map(({ task }) => ({
          toneSuffix: task.toneSuffix,
          blobSha: task.hdBlobSha ?? "",
        })),
      ),
    );
  }
  return {
    tasks: tasks.map((task) => (hdEtagById.has(task.id) ? task : withoutHdSource(task))),
    hdEtagById,
    skipped,
  };
}
