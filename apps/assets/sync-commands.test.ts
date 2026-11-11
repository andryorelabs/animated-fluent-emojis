import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import type { BuildResult } from "./build.js";
import { PIPELINE_VERSION } from "./catalog.js";
import { KNOWN_TEAMS_HASHES } from "./known-teams-versions.js";
import { deriveRegistry } from "./public-slugs.js";
import type { PublishedVersion } from "./site-writer.js";
import { runBuild, runCommand, runDetect, runLists, type SyncDependencies } from "./sync.js";
import { buildManifestUrl } from "./teams.js";
import { createFakeFetch, createTeamsManifest } from "./test-support.js";

const SITE = "https://site.test";
const HASH = "c".repeat(32);
const SHA = "f".repeat(40);
const BUNDLE_URL =
  "https://teams.public.onecdn.static.microsoft/teams-modular-packages/hashed-assets/config-prod-abc123.js";
const MIT_COMMIT =
  "GET https://api.github.com/repos/microsoft/fluentui-emoji-animated/commits/main";

const published: PublishedVersion = {
  teamsHash: HASH,
  teamsLastModified: "2025-10-16T22:08:15.000Z",
  mitSha: SHA,
  builtAt: "2026-10-05T00:00:00.000Z",
  pipelineVersion: PIPELINE_VERSION,
  layouts: ["v1"],
};

const discoveryRoutes = () => ({
  [`HEAD ${buildManifestUrl(HASH)}`]: {
    headers: { "last-modified": "Thu, 16 Oct 2025 22:08:15 GMT" },
  },
  "GET https://teams.microsoft.com/v2/": {
    body: `<script src="${BUNDLE_URL}"></script>`,
  },
  [`GET ${BUNDLE_URL}`]: {
    body: `emoticonAssetVersion:[{value:"${HASH}"}]`,
  },
  [MIT_COMMIT]: { body: { sha: SHA } },
});

const cleanups: string[] = [];

async function createScratch(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "sync-test-"));
  cleanups.push(directory);
  return directory;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    cleanups.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const silence = () => {
  vi.spyOn(console, "log").mockReturnValue();
  vi.spyOn(console, "warn").mockReturnValue();
};

const detectOptions = {
  publishedUrl: SITE,
  rebuild: false,
  bypassGuards: false,
};

const createDependencies = (
  routes: Parameters<typeof createFakeFetch>[0],
  environment: SyncDependencies["environment"] = {},
  buildAssetsStub: SyncDependencies["buildAssets"] = vi.fn(),
): SyncDependencies => ({
  fetch: createFakeFetch(routes).fetch,
  environment,
  buildAssets: buildAssetsStub,
});

test("runDetect writes the changed, teams_hash and mit_sha outputs", async () => {
  silence();
  const scratch = await createScratch();
  const outputFile = path.join(scratch, "output");
  const summaryFile = path.join(scratch, "summary");
  const { fetch, requests } = createFakeFetch(discoveryRoutes());

  await runDetect(detectOptions, {
    fetch,
    environment: {
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_TOKEN: "secret",
    },
    buildAssets: vi.fn(),
  });

  expect(await readFile(outputFile, "utf8")).toBe(
    `changed=true\nteams_hash=${HASH}\nmit_sha=${SHA}\n`,
  );
  expect(await readFile(summaryFile, "utf8")).toContain("### Teams discovery warnings");
  expect(requests).toContain(`GET ${SITE}/version.json`);
});

test("runDetect reports no change when the published catalog is current", async () => {
  silence();
  const scratch = await createScratch();
  const outputFile = path.join(scratch, "output");

  await runDetect(
    detectOptions,
    createDependencies(
      {
        ...discoveryRoutes(),
        [`GET ${SITE}/version.json`]: { body: published },
        [`GET ${SITE}/v1/version.json`]: { body: published },
      },
      { GITHUB_OUTPUT: outputFile },
    ),
  );

  expect(await readFile(outputFile, "utf8")).toContain("changed=false\n");
});

test("runDetect runs without output or token configured", async () => {
  silence();

  const dependencies = createDependencies(discoveryRoutes());

  await expect(runDetect(detectOptions, dependencies)).resolves.toBeUndefined();
});

test("runDetect fails when discovery is unhealthy unless guards are bypassed", async () => {
  silence();
  const routes = {
    [`HEAD ${buildManifestUrl(KNOWN_TEAMS_HASHES[0] ?? HASH)}`]: {
      headers: { "last-modified": "Thu, 16 Oct 2025 22:08:15 GMT" },
    },
    [MIT_COMMIT]: { body: { sha: SHA } },
  };

  await expect(runDetect(detectOptions, createDependencies(routes))).rejects.toThrow(
    "Teams discovery failed",
  );
  await expect(
    runDetect({ ...detectOptions, bypassGuards: true }, createDependencies(routes)),
  ).resolves.toBeUndefined();
});

const createBuildOptions = async () => {
  const scratch = await createScratch();
  const outputDirectory = path.join(scratch, "out");
  await mkdir(outputDirectory, { recursive: true });
  return {
    scratch,
    teamsHash: undefined,
    publishedUrl: SITE,
    outputDirectory,
    cacheDirectory: path.join(scratch, "cache"),
    limit: undefined,
    bypassGuards: false,
  };
};

const buildResult = (diff: BuildResult["diff"]): BuildResult => ({
  manifest: createTeamsManifest(),
  version: published,
  spriteCount: 8,
  downloaded: 3,
  reused: 4,
  skipped: [],
  hdSkipped: [],
  hdCount: 0,
  seeded: 1,
  retained: 2,
  diff,
});

type BuildCall = [
  {
    githubHeaders: Record<string, string>;
    limit: number | undefined;
    onPlanned: unknown;
    teamsVersion: { hash: string };
  },
];

test("runBuild fails loudly when the pinned teams hash is unavailable", async () => {
  const options = await createBuildOptions();
  const buildAssetsStub = vi.fn();

  await expect(
    runBuild({ ...options, teamsHash: HASH }, createDependencies({}, {}, buildAssetsStub)),
  ).rejects.toThrow(`Teams manifest ${HASH} is not available`);
  expect(buildAssetsStub).not.toHaveBeenCalled();
});

test("runBuild builds with the pinned hash and writes step summaries", async () => {
  silence();
  const { scratch, ...options } = await createBuildOptions();
  const summaryFile = path.join(scratch, "summary");
  const diff = { added: ["a"], removed: [], changed: ["b", "c"] };
  const buildAssetsStub = vi.fn(() =>
    Promise.resolve(buildResult(diff as unknown as BuildResult["diff"])),
  );

  await runBuild(
    { ...options, teamsHash: HASH, limit: 5 },
    createDependencies(
      {
        ...discoveryRoutes(),
        [`GET ${SITE}/manifest.json`]: { body: createTeamsManifest() },
      },
      { GITHUB_STEP_SUMMARY: summaryFile, GITHUB_TOKEN: "secret" },
      buildAssetsStub,
    ),
  );

  const summary = await readFile(summaryFile, "utf8");
  expect(summary).toContain("### Catalog diff");
  expect(summary).toContain("Added: 1");
  expect(summary).toContain("Changed: 2");
  expect(summary).toContain("### Sprite sources");
  expect(summary).toContain("Built from source: 3 sprite(s)");
  const [call] = buildAssetsStub.mock.calls as unknown as BuildCall[];
  expect(call?.[0].githubHeaders).toEqual({ authorization: "Bearer secret" });
  expect(call?.[0].limit).toBe(5);
  expect(call?.[0].onPlanned).toBeUndefined();
});

test("runBuild discovers the newest hash and guards removals on a full build", async () => {
  silence();
  const options = await createBuildOptions();
  const buildAssetsStub = vi.fn(() => Promise.resolve(buildResult(undefined)));

  await runBuild(
    options,
    createDependencies(
      {
        ...discoveryRoutes(),
        [`GET ${SITE}/manifest.json`]: { body: createTeamsManifest() },
      },
      {},
      buildAssetsStub,
    ),
  );

  const [call] = buildAssetsStub.mock.calls as unknown as BuildCall[];
  expect(call?.[0].teamsVersion.hash).toBe(HASH);
  expect(call?.[0].onPlanned).toBeTypeOf("function");
});

test("runLists writes the emoji lists and the emoji-id module", async () => {
  const scratch = await createScratch();
  const manifestPath = path.join(scratch, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(createTeamsManifest()));
  const docsDirectory = path.join(scratch, "docs");
  const emojiIdPath = path.join(scratch, "nested", "emoji-id.generated.ts");

  await runLists(manifestPath, docsDirectory, emojiIdPath);

  expect(await readFile(path.join(docsDirectory, "EMOJI_LIST_Smilies.md"), "utf8")).toContain(
    "1f603_grinningfacewithbigeyes",
  );
  expect(await readFile(emojiIdPath, "utf8")).toContain("1f44b_wavinghand");
});

test("runLists freezes new slugs into the registry and leaves frozen ones alone", async () => {
  const scratch = await createScratch();
  const manifestPath = path.join(scratch, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(createTeamsManifest()));
  const registryPath = path.join(scratch, "slugs.json");
  await writeFile(
    registryPath,
    JSON.stringify({
      version: 1,
      slugs: { "1f603_grinningfacewithbigeyes": "frozen-grin" },
    }),
  );
  const indexPath = path.join(scratch, "index.json");
  await writeFile(
    indexPath,
    JSON.stringify([{ id: "1f44b_wavinghand", slug: "live-wave", tones: [] }]),
  );

  await runLists(
    manifestPath,
    path.join(scratch, "docs"),
    path.join(scratch, "emoji-id.generated.ts"),
    { registryPath, indexPath },
  );

  const { slugs } = JSON.parse(await readFile(registryPath, "utf8")) as {
    slugs: Record<string, string>;
  };
  expect(slugs["1f603_grinningfacewithbigeyes"]).toBe("frozen-grin");
  expect(slugs["1f44b_wavinghand"]).toBe("live-wave");
  expect(slugs["1f44b_wavinghand_s2"]).toBe("live-wave-light");
  expect(await readFile(path.join(scratch, "docs", "EMOJI_LIST_Smilies.md"), "utf8")).toContain(
    "/png/frozen-grin.png",
  );
});

test("runLists falls back to the committed registry when the live index is missing", async () => {
  const scratch = await createScratch();
  const manifestPath = path.join(scratch, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(createTeamsManifest()));
  const registryPath = path.join(scratch, "slugs.json");
  await writeFile(registryPath, JSON.stringify({ version: 1, slugs: {} }));
  const warn = vi.spyOn(console, "warn").mockReturnValue();

  await runLists(
    manifestPath,
    path.join(scratch, "docs"),
    path.join(scratch, "emoji-id.generated.ts"),
    { registryPath, indexPath: path.join(scratch, "missing.json") },
  );

  expect(warn).toHaveBeenCalledWith(expect.stringContaining("No live index"));
  expect(await readFile(registryPath, "utf8")).toContain("waving-hand");
  warn.mockRestore();
});

test("runLists fails on a conflict between the live index and the registry", async () => {
  const scratch = await createScratch();
  const manifestPath = path.join(scratch, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(createTeamsManifest()));
  const registryPath = path.join(scratch, "slugs.json");
  await writeFile(
    registryPath,
    JSON.stringify({ version: 1, slugs: { "1f44b_wavinghand": "wave-a" } }),
  );
  const indexPath = path.join(scratch, "index.json");
  await writeFile(
    indexPath,
    JSON.stringify([{ id: "1f44b_wavinghand", slug: "wave-b", tones: [] }]),
  );

  await expect(
    runLists(
      manifestPath,
      path.join(scratch, "docs"),
      path.join(scratch, "emoji-id.generated.ts"),
      { registryPath, indexPath },
    ),
  ).rejects.toThrow("Slug conflict");
});

test("runCommand dispatches lists with the given paths", async () => {
  const scratch = await createScratch();
  const manifestPath = path.join(scratch, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(createTeamsManifest()));
  const emojiIdPath = path.join(scratch, "emoji-id.generated.ts");

  await runCommand(
    [
      "lists",
      "--manifest",
      manifestPath,
      "--docs",
      path.join(scratch, "docs"),
      "--emoji-id",
      emojiIdPath,
    ],
    createDependencies({}),
  );

  expect(await readFile(emojiIdPath, "utf8")).toContain("EmojiId");
});

test("runCommand dispatches detect, build and verify-live", async () => {
  silence();
  const options = await createBuildOptions();
  const buildAssetsStub = vi.fn(() => Promise.resolve(buildResult(undefined)));
  const { fetch, requests } = createFakeFetch({
    ...discoveryRoutes(),
    [`GET ${SITE}/v1/version.json`]: { body: published },
  });
  const dependencies: SyncDependencies = {
    fetch,
    environment: {},
    buildAssets: buildAssetsStub,
  };

  await runCommand(["detect", "--published-url", SITE, "--rebuild"], dependencies);
  await runCommand(
    [
      "build",
      "--published-url",
      SITE,
      "--out",
      options.outputDirectory,
      "--cache",
      options.cacheDirectory,
      "--limit",
      "2",
      "--bypass-guards",
    ],
    dependencies,
  );
  await runCommand(["verify-live", "--published-url", SITE], dependencies);

  expect(buildAssetsStub).toHaveBeenCalledOnce();
  expect(requests.filter((request) => request === `GET ${SITE}/v1/version.json`)).toHaveLength(2);
});

test("runCommand rejects an unknown command with the usage message", async () => {
  const dependencies = createDependencies({});

  await expect(runCommand(["nope"], dependencies)).rejects.toThrow(
    "Usage: sync.ts <detect|build|files|verify-live|lists> [options]",
  );
  await expect(runCommand([], dependencies)).rejects.toThrow("Usage:");
});

const FILES_SITE = "https://files.test";

const detectChanged = async (
  filesRoutes: Parameters<typeof createFakeFetch>[0],
  filesUrl: string | null = FILES_SITE,
): Promise<boolean> => {
  silence();
  const scratch = await createScratch();
  const outputFile = path.join(scratch, "output");
  await runDetect(
    { ...detectOptions, ...(filesUrl !== null && { filesUrl }) },
    createDependencies(
      {
        ...discoveryRoutes(),
        [`GET ${SITE}/version.json`]: { body: published },
        [`GET ${SITE}/v1/version.json`]: { body: published },
        ...filesRoutes,
      },
      { GITHUB_OUTPUT: outputFile },
    ),
  );
  const output = await readFile(outputFile, "utf8");
  return output.includes("changed=true\n");
};

test("runDetect reports a rebuild when the files site version is missing", async () => {
  expect(await detectChanged({})).toBe(true);
});

test("runDetect reports a rebuild when the files site version request fails", async () => {
  expect(
    await detectChanged({
      [`GET ${FILES_SITE}/version.json`]: { status: 500 },
    }),
  ).toBe(true);
});

test("runDetect reports a rebuild when the files site builtAt differs", async () => {
  expect(
    await detectChanged({
      [`GET ${FILES_SITE}/version.json`]: {
        body: { builtAt: "2020-01-01T00:00:00.000Z" },
      },
    }),
  ).toBe(true);
});

test("runDetect reports no change when the files site matches the assets", async () => {
  expect(
    await detectChanged({
      [`GET ${FILES_SITE}/version.json`]: {
        body: { builtAt: published.builtAt },
      },
    }),
  ).toBe(false);
});

test("runDetect ignores the files site when no files url is given", async () => {
  expect(await detectChanged({}, null)).toBe(false);
});

async function createFilesFixture(): Promise<{
  scratch: string;
  assetsDirectory: string;
  outputDirectory: string;
  manifest: Manifest;
}> {
  const scratch = await createScratch();
  const assetsDirectory = path.join(scratch, "assets");
  const outputDirectory = path.join(scratch, "files");
  const manifest = createTeamsManifest();
  await mkdir(assetsDirectory, { recursive: true });
  await writeFile(path.join(assetsDirectory, "manifest.json"), JSON.stringify(manifest));
  await writeFile(
    path.join(assetsDirectory, "version.json"),
    JSON.stringify({ builtAt: published.builtAt, mitSha: SHA }),
  );
  await writeFile(path.join(assetsDirectory, "LICENSE-fluentui-emoji-animated.txt"), "MIT text");
  for (const sheet of [
    "Smilies/1f603_grinningfacewithbigeyes.png",
    ...["", "_s2", "_s3", "_s4", "_s5", "_s6"].map(
      (suffix) => `Hand gestures/1f44b_wavinghand${suffix}.png`,
    ),
  ]) {
    const target = path.join(assetsDirectory, "sprites", sheet);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, sheet);
  }
  return { scratch, assetsDirectory, outputDirectory, manifest };
}

test("runCommand files writes the files site tree", async () => {
  const { scratch, assetsDirectory, outputDirectory, manifest } = await createFilesFixture();
  const registryPath = path.join(scratch, "slugs.json");
  await writeFile(registryPath, JSON.stringify(deriveRegistry(manifest)));
  const encodeFiles = vi.fn(() =>
    Promise.resolve({
      gif: Buffer.from("gif"),
      webp: Buffer.from("webp"),
      png: Buffer.from("png"),
    }),
  );

  await runCommand(
    ["files", "--out", assetsDirectory, "--files-out", outputDirectory, "--registry", registryPath],
    { ...createDependencies({}), encodeFiles },
  );

  expect(encodeFiles).toHaveBeenCalled();
  const versionText = await readFile(path.join(outputDirectory, "version.json"), "utf8");
  expect(JSON.parse(versionText)).toMatchObject({ builtAt: published.builtAt });
  expect(await readFile(path.join(outputDirectory, "index.json"), "utf8")).toContain("slug");
});

test("runCommand files gives new slugs to emoji missing from the registry", async () => {
  const { scratch, assetsDirectory, outputDirectory } = await createFilesFixture();
  const registryPath = path.join(scratch, "slugs.json");
  await writeFile(registryPath, JSON.stringify({ version: 1, slugs: {} }));
  const encodeFiles = vi.fn(() =>
    Promise.resolve({
      gif: Buffer.from("gif"),
      webp: Buffer.from("webp"),
      png: Buffer.from("png"),
    }),
  );

  await runCommand(
    ["files", "--out", assetsDirectory, "--files-out", outputDirectory, "--registry", registryPath],
    { ...createDependencies({}), encodeFiles },
  );

  expect(await readFile(path.join(outputDirectory, "index.json"), "utf8")).toContain(
    "grinning-face-with-big-eyes",
  );
});
