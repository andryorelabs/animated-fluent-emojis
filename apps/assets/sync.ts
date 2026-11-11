import { appendFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import { buildAssets } from "./build.js";
import { PIPELINE_VERSION } from "./catalog.js";
import { formatSource, renderEmojiIdModule, renderEmojiLists } from "./emoji-lists.js";
import { buildFilesSite, type EncodeFiles, type IndexEntry } from "./files-site.js";
import {
  appendStepSummary,
  assertDiscoveryHealthy,
  assertFileCountWithinLimit,
  assertRemovalsWithinLimit,
} from "./guards.js";
import { fetchOk, fetchOkOrMissing, type FetchLike } from "./http.js";
import { KNOWN_TEAMS_HASHES } from "./known-teams-versions.js";
import { V1_DIRECTORY } from "./layout-v1.js";
import { diffManifests } from "./manifest-ops.js";
import { fetchMitCommitSha } from "./mit.js";
import {
  deriveRegistry,
  mergeRegistries,
  registryFromIndex,
  type SlugRegistry,
} from "./public-slugs.js";
import type { PublishedVersion } from "./site-writer.js";
import { discoverTeamsVersion, probeVersion, type TeamsVersion } from "./teams.js";

const DEFAULT_PUBLISHED_URL = "https://animated-fluent-emojis-cdn.andryore.dev";
const DEFAULT_FILES_URL = "https://animated-fluent-emojis-files.andryore.dev";
const SLUG_REGISTRY_URL = new URL("public-slugs.json", import.meta.url);
const WORKSPACE_DIRECTORY = import.meta.dirname;
const REPOSITORY_DIRECTORY = path.resolve(WORKSPACE_DIRECTORY, "..", "..");

/**
 * Decides whether the published v1 layout is missing or was built by another
 * pipeline version.
 * @param publishedV1 The `/v1/version.json` marker, if it exists.
 * @returns Whether the layout must be published again.
 */
export function isV1LayoutStale(publishedV1: PublishedVersion | undefined): boolean {
  return (
    publishedV1 === undefined ||
    !publishedV1.layouts.includes(V1_DIRECTORY) ||
    publishedV1.pipelineVersion !== PIPELINE_VERSION
  );
}

function hasUnfinishedBuild(version: PublishedVersion | undefined): boolean {
  return (
    version?.limited === true ||
    (version?.skippedIds !== undefined && version.skippedIds.length > 0)
  );
}

/**
 * Parses the `--limit` option.
 * @param value The raw option value, if given.
 * @returns The limit, or undefined when the option is absent.
 * @throws {Error} When the value is not a positive integer.
 */
export function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const limit = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(`Invalid --limit "${value}": expected a positive whole number`);
  }
  return limit;
}

/**
 * Checks that the live site serves a current v1 layout.
 * @param fetchImplementation The fetch to use.
 * @param baseUrl The site URL.
 * @throws {Error} When `/v1/version.json` is missing, lacks the v1 layout or was built by another pipeline version.
 */
export async function verifyLive(fetchImplementation: FetchLike, baseUrl: string): Promise<void> {
  const url = `${baseUrl}/${V1_DIRECTORY}/version.json`;
  const response = await fetchOk(fetchImplementation, url, {
    headers: { "cache-control": "no-cache" },
  });
  const version = (await response.json()) as PublishedVersion;
  if (!version.layouts.includes(V1_DIRECTORY)) {
    throw new Error(`${url} does not list the ${V1_DIRECTORY} layout`);
  }
  if (version.limited === true) {
    throw new Error(`${url} was built with --limit and is not the full catalog`);
  }
  if (isV1LayoutStale(version)) {
    throw new Error(
      `${url} has pipelineVersion ${String(version.pipelineVersion)}, expected ${String(PIPELINE_VERSION)}`,
    );
  }
}

/**
 * Decides whether the published catalog is out of date.
 * @param published The root version marker, if any.
 * @param publishedV1 The `/v1/version.json` marker, if any.
 * @param latest The newest Teams hash and official repository commit.
 * @param latest.teamsHash The newest Teams metadata hash.
 * @param latest.mitSha The latest official repository commit.
 * @param rebuild Whether to rebuild regardless.
 * @param filesCheck The files site marker to compare, or undefined when the files site is not checked.
 * @param filesCheck.version The files site `version.json`, or undefined when it is missing or unreachable.
 * @returns Whether a new build is needed.
 */
export function needsRebuild(
  published: PublishedVersion | undefined,
  publishedV1: PublishedVersion | undefined,
  latest: { teamsHash: string; mitSha: string },
  rebuild: boolean,
  filesCheck?: { version: { builtAt?: string } | undefined },
): boolean {
  return (
    rebuild ||
    (filesCheck !== undefined && filesCheck.version?.builtAt !== published?.builtAt) ||
    published?.teamsHash !== latest.teamsHash ||
    published.mitSha !== latest.mitSha ||
    hasUnfinishedBuild(published) ||
    hasUnfinishedBuild(publishedV1) ||
    isV1LayoutStale(publishedV1)
  );
}

/**
 * Creates the removal guard that runs on the planned catalog, before any
 * sprite is converted.
 * @param previous The previously published manifest, if any.
 * @param bypassGuards Whether the guard is bypassed.
 * @returns A callback for `onPlanned`, or undefined when there is nothing to compare.
 */
export function createPlanGuard(
  previous: Manifest | undefined,
  bypassGuards: boolean,
): ((planned: Manifest) => void) | undefined {
  if (!previous) return undefined;
  return (planned) => {
    assertRemovalsWithinLimit(previous, diffManifests(previous, planned), bypassGuards);
  };
}

/**
 * Reads a JSON file from the published site.
 * @param fetchImplementation The fetch function to use.
 * @param baseUrl The site origin.
 * @param fileName The file to read, such as `version.json`.
 * @param attempts How many times to try before giving up.
 * @returns The parsed JSON, or undefined when the site or file does not exist yet.
 */
export async function fetchPublishedJson<Value>(
  fetchImplementation: FetchLike,
  baseUrl: string,
  fileName: string,
  attempts?: number,
): Promise<Value | undefined> {
  const url = `${baseUrl}/${fileName}`;
  const response = await fetchOkOrMissing(
    fetchImplementation,
    url,
    {
      headers: { "cache-control": "no-cache" },
    },
    attempts,
  );
  if (!response) return undefined;
  try {
    return (await response.json()) as Value;
  } catch (error: unknown) {
    throw new Error(`Could not parse the JSON published at ${url}`, {
      cause: error,
    });
  }
}

/**
 * Renders an error with its full `cause` chain and stack for the CLI.
 * @param error The thrown value.
 * @returns A multi-line description.
 */
export function formatErrorChain(error: unknown): string {
  const lines: string[] = [];
  let current: unknown = error;
  let depth = 0;
  while (current !== undefined && depth < 10) {
    const prefix = depth === 0 ? "" : "Caused by: ";
    if (current instanceof Error) {
      lines.push(`${prefix}${current.stack ?? current.message}`);
      if (current instanceof AggregateError) {
        for (const inner of current.errors as unknown[]) {
          lines.push(`  - ${formatErrorChain(inner).replaceAll("\n", "\n    ")}`);
        }
      }
      current = current.cause;
    } else {
      lines.push(`${prefix}${typeof current === "string" ? current : JSON.stringify(current)}`);
      current = undefined;
    }
    depth += 1;
  }
  return lines.join("\n");
}

/**
 * Everything the sync commands read from their surroundings.
 */
export interface SyncDependencies {
  readonly fetch: FetchLike;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly buildAssets: typeof buildAssets;
  readonly encodeFiles?: EncodeFiles;
}

/**
 * Creates the real dependencies the CLI runs with: the global fetch, the process
 * environment and the real asset build.
 * @returns The dependencies wired to the live globals.
 */
export function createDefaultDependencies(): SyncDependencies {
  return { fetch, environment: process.env, buildAssets };
}

function buildGithubHeaders(environment: SyncDependencies["environment"]): Record<string, string> {
  const token = environment.GITHUB_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function fetchFilesVersion(
  fetchImplementation: FetchLike,
  filesUrl: string,
): Promise<{ builtAt?: string } | undefined> {
  try {
    return await fetchPublishedJson<{ builtAt?: string }>(
      fetchImplementation,
      filesUrl,
      "version.json",
      1,
    );
  } catch (error: unknown) {
    console.warn(
      `warning: could not read the files site version, treating it as missing\n${formatErrorChain(error)}`,
    );
    return undefined;
  }
}

function setOutputs(
  environment: SyncDependencies["environment"],
  outputs: Record<string, string>,
): void {
  const outputFile = environment.GITHUB_OUTPUT;
  if (!outputFile) return;
  appendFileSync(
    outputFile,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
  );
}

function reportDiscovery(
  environment: SyncDependencies["environment"],
  warnings: readonly string[],
): void {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  appendStepSummary("Teams discovery warnings", warnings, environment.GITHUB_STEP_SUMMARY);
}

/**
 * Compares the published catalog with the newest upstream versions and writes
 * the `changed`, `teams_hash` and `mit_sha` step outputs.
 * @param options The command options.
 * @param options.publishedUrl The published site origin.
 * @param options.rebuild Whether to report a rebuild regardless.
 * @param options.bypassGuards Whether the discovery guard is bypassed.
 * @param options.filesUrl The files site origin; when set, a missing or stale files site reports a rebuild.
 * @param dependencies The fetch and environment to use.
 */
export async function runDetect(
  options: {
    publishedUrl: string;
    rebuild: boolean;
    bypassGuards: boolean;
    filesUrl?: string;
  },
  dependencies: SyncDependencies = createDefaultDependencies(),
): Promise<void> {
  const { publishedUrl, rebuild, bypassGuards } = options;
  const { environment } = dependencies;
  const fetchImplementation = dependencies.fetch;
  const published = await fetchPublishedJson<PublishedVersion>(
    fetchImplementation,
    publishedUrl,
    "version.json",
  );
  const publishedV1 = await fetchPublishedJson<PublishedVersion>(
    fetchImplementation,
    publishedUrl,
    `${V1_DIRECTORY}/version.json`,
  );
  const discovery = await discoverTeamsVersion({
    fetchImplementation,
    knownHashes: [...(published ? [published.teamsHash] : []), ...KNOWN_TEAMS_HASHES],
  });
  reportDiscovery(environment, discovery.warnings);
  assertDiscoveryHealthy(discovery, bypassGuards);
  const mitSha = await fetchMitCommitSha(fetchImplementation, buildGithubHeaders(environment));
  const filesVersion =
    options.filesUrl === undefined
      ? undefined
      : await fetchFilesVersion(fetchImplementation, options.filesUrl);
  const changed = needsRebuild(
    published,
    publishedV1,
    { teamsHash: discovery.version.hash, mitSha },
    rebuild,
    options.filesUrl === undefined ? undefined : { version: filesVersion },
  );
  console.log(
    JSON.stringify(
      {
        published,
        publishedV1,
        filesVersion,
        latest: discovery.version,
        mitSha,
        changed,
      },
      null,
      2,
    ),
  );
  setOutputs(environment, {
    changed: String(changed),
    teams_hash: discovery.version.hash,
    mit_sha: mitSha,
  });
}

/**
 * Builds the asset site into the output directory and reports a summary.
 * @param options The command options.
 * @param options.teamsHash A pinned Teams metadata hash, or undefined to discover the newest.
 * @param options.publishedUrl The published site origin.
 * @param options.outputDirectory Where the site is written.
 * @param options.cacheDirectory Where converted sprites are cached.
 * @param options.limit Builds only this many emojis when set.
 * @param options.bypassGuards Whether the safety guards are bypassed.
 * @param dependencies The fetch, environment and build to use.
 * @throws {Error} When the pinned Teams hash is not available.
 */
export async function runBuild(
  options: {
    teamsHash: string | undefined;
    publishedUrl: string;
    outputDirectory: string;
    cacheDirectory: string;
    limit: number | undefined;
    bypassGuards: boolean;
  },
  dependencies: SyncDependencies = createDefaultDependencies(),
): Promise<void> {
  const { environment } = dependencies;
  const fetchImplementation = dependencies.fetch;
  let teamsVersion: TeamsVersion | undefined;
  if (options.teamsHash) {
    teamsVersion = await probeVersion(fetchImplementation, options.teamsHash);
    if (!teamsVersion) {
      throw new Error(`Teams manifest ${options.teamsHash} is not available`);
    }
  } else {
    const discovery = await discoverTeamsVersion({
      fetchImplementation,
      knownHashes: KNOWN_TEAMS_HASHES,
    });
    reportDiscovery(environment, discovery.warnings);
    assertDiscoveryHealthy(discovery, options.bypassGuards);
    teamsVersion = discovery.version;
  }

  const previousManifest = await fetchPublishedJson<Manifest>(
    fetchImplementation,
    options.publishedUrl,
    "manifest.json",
  );
  const result = await dependencies.buildAssets({
    fetchImplementation,
    githubHeaders: buildGithubHeaders(environment),
    teamsVersion,
    outputDirectory: options.outputDirectory,
    cacheDirectory: options.cacheDirectory,
    limit: options.limit,
    previousManifest,
    liveUrl: options.publishedUrl,
    onPlanned:
      options.limit === undefined
        ? createPlanGuard(previousManifest, options.bypassGuards)
        : undefined,
  });
  await assertFileCountWithinLimit(options.outputDirectory);
  if (result.diff) {
    appendStepSummary(
      "Catalog diff",
      [
        `Added: ${String(result.diff.added.length)}`,
        `Removed: ${String(result.diff.removed.length)}`,
        `Changed: ${String(result.diff.changed.length)}`,
      ],
      environment.GITHUB_STEP_SUMMARY,
    );
  }
  appendStepSummary(
    "Sprite sources",
    [
      `Seeded from the live site: ${String(result.seeded)} emoji(s)`,
      `Built from source: ${String(result.downloaded)} sprite(s)`,
      `Reused from the cache: ${String(result.reused)} sprite(s)`,
      `Retained from the previous generation: ${String(result.retained)} emoji(s)`,
    ],
    environment.GITHUB_STEP_SUMMARY,
  );
  console.log(
    JSON.stringify(
      {
        version: result.version,
        sprites: result.spriteCount,
        downloaded: result.downloaded,
        reused: result.reused,
        seeded: result.seeded,
        retained: result.retained,
        diff: result.diff && {
          added: result.diff.added.length,
          removed: result.diff.removed.length,
          changed: result.diff.changed.length,
        },
      },
      null,
      2,
    ),
  );
}

/**
 * Builds the public files site from the built asset site.
 * @param options The command options.
 * @param options.assetsDirectory The built asset site to read.
 * @param options.outputDirectory Where the files site is written.
 * @param options.registryPath The frozen slug registry, defaulting to the committed one; emoji it lacks get new slugs.
 * @param dependencies The encoder to use.
 */
export async function runFiles(
  options: {
    assetsDirectory: string;
    outputDirectory: string;
    registryPath?: string;
  },
  dependencies: Pick<SyncDependencies, "encodeFiles"> = {},
): Promise<void> {
  const frozen = JSON.parse(
    await readFile(options.registryPath ?? SLUG_REGISTRY_URL, "utf8"),
  ) as SlugRegistry;
  const manifest = JSON.parse(
    await readFile(path.join(options.assetsDirectory, "manifest.json"), "utf8"),
  ) as Manifest;
  const registry = deriveRegistry(manifest, frozen);
  await buildFilesSite({
    assetsDirectory: options.assetsDirectory,
    outputDirectory: options.outputDirectory,
    registry,
    encode: dependencies.encodeFiles,
  });
}

async function readLiveIndex(indexPath: string | undefined): Promise<SlugRegistry | undefined> {
  if (indexPath === undefined) return undefined;
  let source: string;
  try {
    source = await readFile(indexPath, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    console.warn(
      `No live index at ${indexPath}; freezing slugs from the committed registry alone.`,
    );
    return undefined;
  }
  return registryFromIndex(JSON.parse(source) as IndexEntry[]);
}

/**
 * Writes the per-category emoji lists and the emoji-id module from a manifest,
 * and freezes the slugs of newly published emoji into the committed registry.
 * @param manifestPath The built `manifest.json`.
 * @param docsDirectory Where the `EMOJI_LIST_*.md` files go.
 * @param emojiIdPath Where the generated emoji-id module goes.
 * @param options Registry, live index and files site settings.
 * @param options.registryPath The committed slug registry, rewritten in place; defaults to the repository one.
 * @param options.indexPath A downloaded live `index.json`; when absent or missing on disk, only the committed registry is used and a warning is logged.
 * @param options.filesUrl The files site origin the list links point at.
 * @throws {Error} When the live index conflicts with the committed registry.
 */
export async function runLists(
  manifestPath: string,
  docsDirectory: string,
  emojiIdPath: string,
  options: {
    registryPath?: string;
    indexPath?: string;
    filesUrl?: string;
  } = {},
): Promise<void> {
  const registryPath = options.registryPath ?? fileURLToPath(SLUG_REGISTRY_URL);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const committed = JSON.parse(await readFile(registryPath, "utf8")) as SlugRegistry;
  const live = await readLiveIndex(options.indexPath);
  const registry = deriveRegistry(
    manifest,
    live === undefined ? committed : mergeRegistries(committed, live),
  );
  await writeFile(registryPath, await formatSource(JSON.stringify(registry), registryPath));
  await mkdir(docsDirectory, { recursive: true });
  const lists = renderEmojiLists(manifest, registry, options.filesUrl ?? DEFAULT_FILES_URL);
  for (const [fileName, source] of lists) {
    const filePath = path.join(docsDirectory, fileName);
    await writeFile(filePath, await formatSource(source, filePath));
  }
  await mkdir(path.dirname(emojiIdPath), { recursive: true });
  await writeFile(emojiIdPath, await formatSource(renderEmojiIdModule(manifest), emojiIdPath));
}

/**
 * Parses the CLI arguments and runs the chosen command.
 * @param argv The arguments after the script name.
 * @param dependencies The fetch, environment and build to use.
 * @throws {Error} When the command is unknown.
 */
export async function runCommand(
  argv: readonly string[],
  dependencies: SyncDependencies = createDefaultDependencies(),
): Promise<void> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      "published-url": { type: "string", default: DEFAULT_PUBLISHED_URL },
      "files-url": { type: "string", default: DEFAULT_FILES_URL },
      "files-out": {
        type: "string",
        default: path.join(WORKSPACE_DIRECTORY, "dist-files"),
      },
      registry: { type: "string" },
      index: { type: "string" },
      "teams-hash": { type: "string" },
      out: {
        type: "string",
        default: path.join(WORKSPACE_DIRECTORY, "dist-assets"),
      },
      cache: {
        type: "string",
        default: path.join(WORKSPACE_DIRECTORY, ".cache", "assets"),
      },
      limit: { type: "string" },
      manifest: {
        type: "string",
        default: path.join(WORKSPACE_DIRECTORY, "dist-assets", "manifest.json"),
      },
      docs: {
        type: "string",
        default: path.join(REPOSITORY_DIRECTORY, "docs"),
      },
      "emoji-id": {
        type: "string",
        default: path.join(
          REPOSITORY_DIRECTORY,
          "packages/animated-fluent-emojis/src/utils/emoji-id.generated.ts",
        ),
      },
      rebuild: { type: "boolean", default: false },
      "bypass-guards": { type: "boolean", default: false },
    },
  });
  const [command] = positionals;
  switch (command) {
    case "detect": {
      await runDetect(
        {
          publishedUrl: values["published-url"],
          rebuild: values.rebuild,
          bypassGuards: values["bypass-guards"],
          filesUrl: values["files-url"],
        },
        dependencies,
      );
      break;
    }
    case "files": {
      await runFiles(
        {
          assetsDirectory: values.out,
          outputDirectory: values["files-out"],
          ...(values.registry !== undefined && {
            registryPath: values.registry,
          }),
        },
        dependencies,
      );
      break;
    }
    case "build": {
      await runBuild(
        {
          teamsHash: values["teams-hash"],
          publishedUrl: values["published-url"],
          outputDirectory: values.out,
          cacheDirectory: values.cache,
          limit: parseLimit(values.limit),
          bypassGuards: values["bypass-guards"],
        },
        dependencies,
      );
      break;
    }
    case "verify-live": {
      await verifyLive(dependencies.fetch, values["published-url"]);
      break;
    }
    case "lists": {
      await runLists(values.manifest, values.docs, values["emoji-id"], {
        ...(values.registry !== undefined && {
          registryPath: values.registry,
        }),
        ...(values.index !== undefined && { indexPath: values.index }),
        filesUrl: values["files-url"],
      });
      break;
    }
    default: {
      throw new Error("Usage: sync.ts <detect|build|files|verify-live|lists> [options]");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runCommand(process.argv.slice(2));
  } catch (error: unknown) {
    console.error(formatErrorChain(error));
    process.exitCode = 1;
  }
}
