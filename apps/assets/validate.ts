import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { MAX_TEXTURE_HEIGHT, type SpriteTask } from "./catalog.js";
import { HD_FRAME_SIZE, indexEmoticons, SPRITE_FRAME_SIZE, TONE_SUFFIXES } from "./constants.js";

/**
 * Inputs for {@link validateCatalog}.
 */
export interface ValidationInput {
  readonly manifest: Manifest;
  readonly tasks: readonly SpriteTask[];
  readonly cacheDirectory: string;
}

type ValidatedTask = ValidationInput["tasks"][number];

interface SpriteFile {
  readonly task: ValidatedTask;
  readonly relativePath: string;
  readonly frameSize: number;
}

interface SpriteDimensions {
  readonly width: number;
  readonly height: number;
}

async function isNonEmptyFile(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.codePointAt(index) ?? 0;
    if (0x7f === code || code < 0x20) return true;
  }
  return false;
}

function isUrlSafeSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !segment.includes("..") &&
    !hasControlCharacter(segment)
  );
}

function findAnimationProblems(manifest: Manifest): string[] {
  return manifest.categories.flatMap((category) =>
    category.emoticons.flatMap((emoticon) => {
      const { fps, framesCount, firstFrame } = emoticon.animation;
      const reasons = [
        ...(Number.isSafeInteger(framesCount) && framesCount >= 1
          ? []
          : ["framesCount must be an integer of at least 1"]),
        ...(Number.isFinite(fps) && fps > 0 ? [] : ["fps must be finite and above 0"]),
        ...(Number.isSafeInteger(firstFrame) && firstFrame >= 1 && firstFrame <= framesCount
          ? []
          : ["firstFrame must be within [1, framesCount]"]),
      ];
      return reasons.length > 0
        ? `${emoticon.id}: invalid animation (fps ${String(fps)}, framesCount ${String(framesCount)}, firstFrame ${String(firstFrame)}): ${reasons.join("; ")}`
        : [];
    }),
  );
}

function findNameProblems(manifest: Manifest, tasks: readonly ValidatedTask[]): string[] {
  const names = [
    ...manifest.categories.flatMap((category) => [
      { kind: "category", value: category.title },
      ...category.emoticons.map((emoticon) => ({
        kind: "id",
        value: emoticon.id,
      })),
    ]),
    ...tasks.flatMap((task) => [
      { kind: "category", value: task.category },
      { kind: "id", value: task.id },
    ]),
  ];
  const unsafe = new Set(
    names
      .filter((name) => !isUrlSafeSegment(name.value))
      .map((name) => `${name.kind} ${JSON.stringify(name.value)} is not URL-safe`),
  );
  return [...unsafe];
}

function findDuplicateIdProblems(manifest: Manifest): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const category of manifest.categories) {
    for (const emoticon of category.emoticons) {
      if (seen.has(emoticon.id)) duplicates.add(emoticon.id);
      seen.add(emoticon.id);
    }
  }
  return [...duplicates].map((id) => `${id}: duplicate id across categories`);
}

function findToneProblems(manifest: Manifest, tasks: readonly ValidatedTask[]): string[] {
  const suffixesById = new Map<string, Set<string>>();
  for (const task of tasks) {
    const suffixes = suffixesById.get(task.id) ?? new Set<string>();
    suffixes.add(task.toneSuffix);
    suffixesById.set(task.id, suffixes);
  }
  return manifest.categories.flatMap((category) =>
    category.emoticons.flatMap((emoticon) => {
      const present = suffixesById.get(emoticon.id) ?? new Set<string>();
      const missingBase = present.has("") ? [] : [`${emoticon.id}: missing base sprite task`];
      const missingTones = emoticon.diverse
        ? TONE_SUFFIXES.filter((suffix) => !present.has(suffix)).map(
            (suffix) => `${emoticon.id}: missing tone sprite ${suffix}`,
          )
        : [];
      return [...missingBase, ...missingTones];
    }),
  );
}

function listSpriteFiles(tasks: readonly ValidatedTask[]): SpriteFile[] {
  return tasks.flatMap((task) => [
    {
      task,
      relativePath: task.outputPath,
      frameSize: SPRITE_FRAME_SIZE,
    },
    ...(task.hdOutputPath
      ? [
          {
            task,
            relativePath: task.hdOutputPath,
            frameSize: HD_FRAME_SIZE,
          },
        ]
      : []),
  ]);
}

async function findMissingSprites(
  files: readonly SpriteFile[],
  cacheDirectory: string,
): Promise<{ problems: string[]; present: SpriteFile[] }> {
  const checks = await Promise.all(
    files.map(
      async (file) =>
        [file, await isNonEmptyFile(path.join(cacheDirectory, file.relativePath))] as const,
    ),
  );
  return {
    problems: checks
      .filter(([, exists]) => !exists)
      .map(([file]) => `${file.task.id}: missing sprite ${file.relativePath}`),
    present: checks.filter(([, exists]) => exists).map(([file]) => file),
  };
}

async function readDimensions(source: Buffer | string): Promise<SpriteDimensions | Error> {
  try {
    const { info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height };
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function findDimensionProblems(
  files: readonly SpriteFile[],
  manifest: Manifest,
  cacheDirectory: string,
): Promise<{ problems: string[]; frameCounts: Map<SpriteFile, number> }> {
  const emoticonById = indexEmoticons(manifest);
  const frameCounts = new Map<SpriteFile, number>();
  const problems: string[] = [];
  const decoded = await Promise.all(
    files.map(
      async (file) =>
        [file, await readDimensions(path.join(cacheDirectory, file.relativePath))] as const,
    ),
  );
  for (const [file, dimensions] of decoded) {
    const label = `${file.task.id}: sprite ${file.relativePath}`;
    if (dimensions instanceof Error) {
      problems.push(`${label} could not be decoded (${dimensions.message})`);
      continue;
    }
    const { width, height } = dimensions;
    if (width !== file.frameSize) {
      problems.push(`${label} is ${String(width)}px wide, expected ${String(file.frameSize)}px`);
    }
    if (file.frameSize === HD_FRAME_SIZE && height > MAX_TEXTURE_HEIGHT) {
      problems.push(
        `${label} is ${String(height)}px tall, above the ${String(MAX_TEXTURE_HEIGHT)}px texture limit`,
      );
    }
    frameCounts.set(file, height / file.frameSize);
    const expectedFrames = emoticonById.get(file.task.id)?.animation.framesCount;
    if (
      expectedFrames !== undefined &&
      Number.isSafeInteger(expectedFrames) &&
      expectedFrames >= 1 &&
      height !== expectedFrames * file.frameSize
    ) {
      problems.push(
        `${label} is ${String(height)}px tall, expected ${String(expectedFrames * file.frameSize)}px (${String(expectedFrames)} frames)`,
      );
    }
  }
  return { problems, frameCounts };
}

function findToneFrameCountProblems(frameCounts: ReadonlyMap<SpriteFile, number>): string[] {
  const countsById = new Map<string, Set<number>>();
  for (const [file, count] of frameCounts) {
    if (file.task.source !== "mit" || file.frameSize !== SPRITE_FRAME_SIZE) {
      continue;
    }
    const counts = countsById.get(file.task.id) ?? new Set<number>();
    counts.add(count);
    countsById.set(file.task.id, counts);
  }
  return [...countsById]
    .filter(([, counts]) => counts.size > 1)
    .map(
      ([id, counts]) => `${id}: skin tones have different frame counts (${[...counts].join(", ")})`,
    );
}

function findHdFlagProblems(manifest: Manifest, tasks: readonly SpriteTask[]): string[] {
  const tasksById = Map.groupBy(tasks, (task) => task.id);
  return manifest.categories.flatMap((category) =>
    category.emoticons.flatMap((emoticon) => {
      const emojiTasks = tasksById.get(emoticon.id) ?? [];
      const flagged = (emoticon as { hd?: unknown }).hd === true;
      const withHd = emojiTasks.filter((task) => task.hdOutputPath);
      if (flagged && withHd.length !== emojiTasks.length) {
        return `${emoticon.id}: flagged hd but not every tone has an HD sprite`;
      }
      return !flagged && withHd.length > 0
        ? `${emoticon.id}: has HD sprites but is not flagged hd`
        : [];
    }),
  );
}

/**
 * Decodes one sprite sheet and checks it is one frame wide and `framesCount`
 * frames tall.
 * @param source The sheet bytes or a path to the sheet.
 * @param frameSize The frame edge in pixels (100 standard, 200 HD).
 * @param framesCount The number of frames the sheet must hold.
 * @returns A description of the first problem found, or undefined when valid.
 */
export async function findSpriteSheetProblem(
  source: Buffer | string,
  frameSize: number,
  framesCount: number,
): Promise<string | undefined> {
  const dimensions = await readDimensions(source);
  if (dimensions instanceof Error) {
    return `could not be decoded (${dimensions.message})`;
  }
  if (dimensions.width !== frameSize) {
    return `is ${String(dimensions.width)}px wide, expected ${String(frameSize)}px`;
  }
  const expectedHeight = framesCount * frameSize;
  if (!Number.isSafeInteger(framesCount) || framesCount < 1) {
    return `has an invalid expected frame count (${String(framesCount)})`;
  }
  if (frameSize === HD_FRAME_SIZE && dimensions.height > MAX_TEXTURE_HEIGHT) {
    return `is ${String(dimensions.height)}px tall, above the ${String(MAX_TEXTURE_HEIGHT)}px texture limit`;
  }
  return dimensions.height === expectedHeight
    ? undefined
    : `is ${String(dimensions.height)}px tall, expected ${String(expectedHeight)}px (${String(framesCount)} frames)`;
}

/**
 * Checks that a built catalog is safe to publish. Every emoji must have a
 * valid animation, a URL-safe unique id and category, a base sprite task and
 * all five tone sprites when diverse. Every sprite sheet is decoded and must
 * be one frame wide and `framesCount` frames tall (100px frames, 200px for HD
 * sheets), and an official emoji's skin tones must share a frame count.
 * @param input The manifest, the planned sprite tasks and the sprite cache.
 * @throws {Error} An error listing every problem found.
 */
export async function validateCatalog(input: ValidationInput): Promise<void> {
  const { manifest, tasks, cacheDirectory } = input;
  const { problems: missing, present } = await findMissingSprites(
    listSpriteFiles(tasks),
    cacheDirectory,
  );
  const dimensions = await findDimensionProblems(present, manifest, cacheDirectory);
  const problems = [
    ...findAnimationProblems(manifest),
    ...findNameProblems(manifest, tasks),
    ...findDuplicateIdProblems(manifest),
    ...findToneProblems(manifest, tasks),
    ...findHdFlagProblems(manifest, tasks),
    ...missing,
    ...dimensions.problems,
    ...findToneFrameCountProblems(dimensions.frameCounts),
  ];
  if (problems.length === 0) return;
  throw new Error(
    `Catalog validation failed with ${String(problems.length)} problem(s):\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}`,
  );
}
