import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import type { FetchLike } from "./http.js";
import type { AnimationState } from "./manifest-ops.js";
import type { ConvertedSprite } from "./sprites.js";
import type { TeamsVersion } from "./teams.js";

/**
 * How many sprite tasks run at once. Each task is mostly waiting on the
 * network, so this is far above the CPU count.
 */
export const DOWNLOAD_CONCURRENCY = 24;

/**
 * How many ffmpeg conversions run at once, independent of
 * {@link DOWNLOAD_CONCURRENCY}. Conversions are CPU-bound.
 * @returns The number of CPUs available to this process.
 */
export function getConversionConcurrency(): number {
  return availableParallelism();
}

/**
 * Converts an animated PNG into sprite sheets, one per requested frame size.
 */
export type ConvertSprite = (
  animatedPng: Buffer,
  frameSizes: readonly number[],
) => Promise<ConvertedSprite[]>;

/**
 * What the cache remembers about one sprite file.
 */
interface SpriteState {
  readonly etag: string;
  readonly animation?: AnimationState | undefined;
}

/**
 * The cache state file, keyed by legacy-relative sprite path.
 */
export type StateFile = Record<string, SpriteState>;

/**
 * Options for `buildAssets`.
 */
export interface BuildOptions {
  readonly fetchImplementation: FetchLike;
  readonly githubHeaders?: Record<string, string> | undefined;
  readonly teamsVersion: TeamsVersion;
  readonly outputDirectory: string;
  readonly cacheDirectory: string;
  readonly limit?: number | undefined;
  readonly previousManifest?: Manifest | undefined;
  readonly liveUrl?: string | undefined;
  readonly maxOutputFiles?: number;
  readonly convert?: ConvertSprite;
  readonly now?: () => Date;
  readonly stepSummaryPath?: string;
  readonly onPlanned?: ((planned: Manifest) => void) | undefined;
}

/**
 * The shared inputs and mutable cache state of one build run.
 */
export interface BuildContext {
  readonly options: BuildOptions;
  readonly mitSha: string;
  readonly state: StateFile;
  readonly convert: ConvertSprite;
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

/**
 * Checks whether a regular file exists. Only a missing file counts as absent;
 * any other filesystem error propagates.
 * @param filePath The file to check.
 * @returns Whether the file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch (error: unknown) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

/**
 * Reads the sprite state file. Only a missing file yields an empty state; any
 * other read or parse error propagates.
 * @param cacheDirectory The cache directory holding `state.json`.
 * @returns The stored state, or an empty state on first run.
 */
export async function readState(cacheDirectory: string): Promise<StateFile> {
  try {
    return JSON.parse(await readFile(path.join(cacheDirectory, "state.json"), "utf8")) as StateFile;
  } catch (error: unknown) {
    if (isMissingFileError(error)) return {};
    throw error;
  }
}

/**
 * Writes the sprite state file, creating the cache directory when needed.
 * @param cacheDirectory The directory that holds `state.json`.
 * @param state The sprite states to persist.
 */
export async function writeState(cacheDirectory: string, state: StateFile): Promise<void> {
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(path.join(cacheDirectory, "state.json"), JSON.stringify(state));
}

/**
 * Writes bytes to a file, creating its parent directories.
 * @param filePath The destination file.
 * @param bytes The content to write.
 */
export async function writeBytes(filePath: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}
