import { appendFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import type { ManifestDiff } from "./manifest-ops.js";
import type { TeamsDiscovery } from "./teams.js";

/**
 * Largest fraction of the previous catalog a single run may remove.
 */
const MAX_REMOVED_FRACTION = 0.05;

/**
 * Most files the output may hold. Cloudflare Pages allows 20,000.
 */
export const MAX_OUTPUT_FILES = 19_000;

/**
 * Fails when both advertised Teams discovery sources yielded nothing, which
 * would otherwise silently fall back to the newest pinned hash.
 * @param discovery The Teams discovery result.
 * @param bypassGuards Whether the guard is bypassed.
 */
export function assertDiscoveryHealthy(
  discovery: Pick<TeamsDiscovery, "advertisedSourcesFailed">,
  bypassGuards: boolean,
): void {
  if (!bypassGuards && discovery.advertisedSourcesFailed) {
    throw new Error(
      "Teams discovery failed: neither the web client bundle nor ECS advertised a metadata hash. Re-run with bypass_guards to fall back to the known hashes.",
    );
  }
}

function countEmoticons(manifest: Manifest): number {
  return manifest.categories.reduce((total, category) => total + category.emoticons.length, 0);
}

/**
 * Fails when the new catalog drops more than 5% of the previous one. Runs on
 * the planned catalog, before any conversion.
 * @param previous The previously published manifest.
 * @param diff The diff between the previous and the planned manifest.
 * @param bypassGuards Whether the guard is bypassed.
 */
export function assertRemovalsWithinLimit(
  previous: Manifest,
  diff: Pick<ManifestDiff, "removed">,
  bypassGuards: boolean,
): void {
  const previousCount = countEmoticons(previous);
  const limit = previousCount * MAX_REMOVED_FRACTION;
  if (!bypassGuards && diff.removed.length > limit) {
    throw new Error(
      `Refusing to publish: ${String(diff.removed.length)} of ${String(previousCount)} emoji would be removed (limit ${String(MAX_REMOVED_FRACTION * 100)}%). Re-run with bypass_guards if this is intended.`,
    );
  }
}

/**
 * Counts every file below a directory.
 * @param directory The directory to walk.
 * @returns The number of files found.
 */
export async function countFiles(directory: string): Promise<number> {
  const entries = await readdir(path.resolve(directory), {
    recursive: true,
    withFileTypes: true,
  });
  return entries.filter((entry) => entry.isFile()).length;
}

/**
 * Fails when the output exceeds the Pages file limit. Never bypassed by `bypass_guards`.
 * @param directory The output directory.
 * @param limit The most files allowed.
 */
export async function assertFileCountWithinLimit(
  directory: string,
  limit = MAX_OUTPUT_FILES,
): Promise<void> {
  const total = await countFiles(directory);
  if (total > limit) {
    throw new Error(
      `Output holds ${String(total)} files, over the ${String(limit)} limit (Cloudflare Pages allows 20,000).`,
    );
  }
}

/**
 * Appends a Markdown section to the GitHub step summary when one is configured.
 * @param title The section heading.
 * @param lines The lines to list under it.
 * @param summaryPath The summary file, defaulting to `GITHUB_STEP_SUMMARY`.
 */
export function appendStepSummary(
  title: string,
  lines: readonly string[],
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
): void {
  if (!summaryPath || lines.length === 0) return;
  appendFileSync(summaryPath, `### ${title}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n\n`);
}
