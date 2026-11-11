import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { DOWNLOAD_CONCURRENCY } from "./build-context.js";
import type { SpriteTask } from "./catalog.js";
import { indexEmoticons } from "./constants.js";
import { fetchOk, mapWithConcurrency, type FetchLike } from "./http.js";
import { buildV1SpritePath, toV1Manifest, V1_DIRECTORY, V1_HEADERS_FILE } from "./layout-v1.js";
import { MIT_REPOSITORY } from "./mit.js";
import { toSlimManifest } from "./slim-manifest.js";

/**
 * How many files the license notice adds to the output.
 */
export const LICENSE_FILE_COUNT = 1;

const LICENSE_FILE_NAME = "LICENSE-fluentui-emoji-animated.txt";

const HEADERS_FILE = `/sprites/*
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
`;

/**
 * The versions a published catalog was built from.
 */
export interface PublishedVersion {
  readonly teamsHash: string;
  readonly teamsLastModified: string;
  readonly mitSha: string;
  readonly builtAt: string;
  readonly pipelineVersion: number;
  readonly layouts: readonly string[];
  /**
   * Emoji that failed to build, or whose HD sheet failed. Present only when
   * non-empty; a published catalog that lists any is stale.
   */
  readonly skippedIds?: readonly string[];
  /**
   * Set when the build was cut short by `--limit`. Such a catalog is never
   * current.
   */
  readonly limited?: true;
}

async function copyFileInto(source: string, destination: string): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

/**
 * Copies every sprite sheet from the cache into the output twice: once at its
 * legacy path and once in the versioned layout under its etag.
 * @param input Everything the copy needs.
 * @param input.tasks The tasks whose sheets are published.
 * @param input.manifest The final manifest, which supplies each etag.
 * @param input.cacheDirectory Where the sheets were produced.
 * @param input.outputDirectory Where the site is assembled.
 */
export async function copySpriteTrees(input: {
  tasks: readonly SpriteTask[];
  manifest: Manifest;
  cacheDirectory: string;
  outputDirectory: string;
}): Promise<void> {
  const { tasks, manifest, cacheDirectory, outputDirectory } = input;
  const emoticonById = indexEmoticons(manifest);
  const copies = tasks.flatMap((task) =>
    [task.outputPath, task.hdOutputPath].flatMap((relativePath) =>
      relativePath === undefined
        ? []
        : {
            relativePath,
            etag: emoticonById.get(task.id)?.etag ?? task.etag,
          },
    ),
  );
  await mapWithConcurrency(copies, DOWNLOAD_CONCURRENCY, async ({ relativePath, etag }) => {
    const source = path.join(cacheDirectory, relativePath);
    await copyFileInto(source, path.join(outputDirectory, relativePath));
    await copyFileInto(source, path.join(outputDirectory, buildV1SpritePath(relativePath, etag)));
  });
}

/**
 * Downloads the license of the official repository at the pinned commit.
 * @param fetchImplementation The fetch function to use.
 * @param mitSha The pinned official-repository commit.
 * @returns The raw LICENSE file content.
 */
export async function fetchLicenseText(
  fetchImplementation: FetchLike,
  mitSha: string,
): Promise<string> {
  const response = await fetchOk(
    fetchImplementation,
    `https://raw.githubusercontent.com/${MIT_REPOSITORY}/${mitSha}/LICENSE`,
  );
  return response.text();
}

/**
 * Writes the license notice into the output.
 * @param outputDirectory The directory being published.
 * @param text The license file content.
 */
export async function writeLicense(outputDirectory: string, text: string): Promise<void> {
  await writeFile(path.join(outputDirectory, LICENSE_FILE_NAME), text);
}

/**
 * Writes the manifests, version markers and headers file in both layouts.
 * @param input Everything the files are derived from.
 * @param input.manifest The final manifest.
 * @param input.version The version marker to publish.
 * @param input.outputDirectory Where the site is assembled.
 */
export async function writeSiteFiles(input: {
  manifest: Manifest;
  version: PublishedVersion;
  outputDirectory: string;
}): Promise<void> {
  const { manifest, version, outputDirectory } = input;
  const versionJson = JSON.stringify(version, null, 2);
  await writeFile(path.join(outputDirectory, "manifest.json"), JSON.stringify(manifest));
  await writeFile(
    path.join(outputDirectory, "manifest.slim.json"),
    JSON.stringify(toSlimManifest(manifest)),
  );
  await writeFile(path.join(outputDirectory, "version.json"), versionJson);
  const versionedDirectory = path.join(outputDirectory, V1_DIRECTORY);
  await mkdir(versionedDirectory, { recursive: true });
  await writeFile(
    path.join(versionedDirectory, "manifest.slim.json"),
    JSON.stringify(toV1Manifest(manifest)),
  );
  await writeFile(path.join(versionedDirectory, "version.json"), versionJson);
  await writeFile(path.join(outputDirectory, "_headers"), `${HEADERS_FILE}\n${V1_HEADERS_FILE}`);
}
