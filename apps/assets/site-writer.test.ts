import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";

import type { SpriteTask } from "./catalog.js";
import { buildV1SpritePath, V1_DIRECTORY } from "./layout-v1.js";
import {
  copySpriteTrees,
  fetchLicenseText,
  LICENSE_FILE_COUNT,
  writeLicense,
  writeSiteFiles,
  type PublishedVersion,
} from "./site-writer.js";
import { createFakeFetch, createTeamsManifest } from "./test-support.js";

const SHA = "b".repeat(40);

const VERSION: PublishedVersion = {
  teamsHash: "hash",
  teamsLastModified: "Mon, 01 Jan 2024 00:00:00 GMT",
  mitSha: SHA,
  builtAt: "2024-01-01T00:00:00.000Z",
  pipelineVersion: 1,
  layouts: ["v1"],
};

const createDirectory = (prefix: string) => mkdtemp(path.join(tmpdir(), `${prefix}-`));

function createTask(overrides: Partial<SpriteTask> = {}): SpriteTask {
  return {
    source: "teams",
    id: "1f44b_wavinghand",
    category: "hands-id",
    toneSuffix: "",
    etag: "task-etag",
    outputPath: "sprites/wave.png",
    ...overrides,
  };
}

async function writeCached(directory: string, relativePath: string) {
  const target = path.join(directory, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, relativePath);
}

test("copySpriteTrees copies each sheet to the legacy and versioned paths", async () => {
  const cacheDirectory = await createDirectory("cache");
  const outputDirectory = await createDirectory("out");
  await writeCached(cacheDirectory, "sprites/wave.png");
  await writeCached(cacheDirectory, "sprites-hd/wave.png");
  await copySpriteTrees({
    tasks: [createTask({ hdOutputPath: "sprites-hd/wave.png" })],
    manifest: createTeamsManifest(),
    cacheDirectory,
    outputDirectory,
  });
  for (const relativePath of ["sprites/wave.png", "sprites-hd/wave.png"]) {
    const legacyPath = path.join(outputDirectory, relativePath);
    const versionedPath = path.join(outputDirectory, buildV1SpritePath(relativePath, "v5"));
    expect(await readFile(legacyPath, "utf8")).toBe(relativePath);
    expect(await readFile(versionedPath, "utf8")).toBe(relativePath);
  }
});

test("copySpriteTrees falls back to the task etag for an unknown emoji", async () => {
  const cacheDirectory = await createDirectory("cache");
  const outputDirectory = await createDirectory("out");
  await writeCached(cacheDirectory, "sprites/ghost.png");
  await copySpriteTrees({
    tasks: [createTask({ id: "ghost", outputPath: "sprites/ghost.png" })],
    manifest: createTeamsManifest(),
    cacheDirectory,
    outputDirectory,
  });
  const versionedPath = path.join(
    outputDirectory,
    buildV1SpritePath("sprites/ghost.png", "task-etag"),
  );
  expect(await readFile(versionedPath, "utf8")).toBe("sprites/ghost.png");
});

test("fetchLicenseText downloads the pinned license", async () => {
  const fake = createFakeFetch({
    [`GET https://raw.githubusercontent.com/microsoft/fluentui-emoji-animated/${SHA}/LICENSE`]: {
      body: "MIT License",
    },
  });
  expect(await fetchLicenseText(fake.fetch, SHA)).toBe("MIT License");
});

test("fetchLicenseText rejects when the download fails", async () => {
  const fake = createFakeFetch({});
  await expect(fetchLicenseText(fake.fetch, SHA)).rejects.toThrow();
});

test("writeLicense writes the notice into the output", async () => {
  const outputDirectory = await createDirectory("out");
  await writeLicense(outputDirectory, "license text");
  expect(LICENSE_FILE_COUNT).toBe(1);
  expect(
    await readFile(path.join(outputDirectory, "LICENSE-fluentui-emoji-animated.txt"), "utf8"),
  ).toBe("license text");
});

test("writeSiteFiles writes manifests, versions and headers in both layouts", async () => {
  const outputDirectory = await createDirectory("out");
  const manifest = createTeamsManifest();
  await writeSiteFiles({ manifest, version: VERSION, outputDirectory });
  const read = (...segments: string[]) => readFile(path.join(outputDirectory, ...segments), "utf8");

  expect(JSON.parse(await read("manifest.json"))).toEqual(manifest);
  expect(JSON.parse(await read("manifest.slim.json"))).toBeTypeOf("object");
  expect(JSON.parse(await read("version.json"))).toEqual(VERSION);
  expect(JSON.parse(await read(V1_DIRECTORY, "version.json"))).toEqual(VERSION);
  expect(JSON.parse(await read(V1_DIRECTORY, "manifest.slim.json"))).toBeTypeOf("object");
  const headers = await read("_headers");
  expect(headers).toContain("/manifest.slim.json");
  expect(headers).toContain(`/${V1_DIRECTORY}/sprites/*`);
});
