import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { BuildOptions } from "./build-context.js";
import { buildAssets } from "./build.js";
import type * as CatalogModule from "./catalog.js";
import type { SpriteTask } from "./catalog.js";
import { buildManifestUrl, buildSpriteUrl } from "./teams.js";
import { createFakeFetch, createSpritePng, createTeamsManifest } from "./test-support.js";

const SOURCELESS_ID = "1f44b_wavinghand";

const state = vi.hoisted(() => ({ sourcelessTasks: false }));

vi.mock("./catalog.js", async (importOriginal) => {
  const original = await importOriginal<typeof CatalogModule>();
  return {
    ...original,
    buildCatalog: (...catalogArguments: Parameters<typeof original.buildCatalog>) => {
      const catalog = original.buildCatalog(...catalogArguments);
      if (!state.sourcelessTasks) return catalog;
      return {
        ...catalog,
        tasks: catalog.tasks.map((task): SpriteTask => ({
          ...task,
          source: (task.id === SOURCELESS_ID ? "none" : task.source) as SpriteTask["source"],
        })),
      };
    },
  };
});

const SMILEY_PNG = await createSpritePng(72);
const WAVE_PNG = await createSpritePng(21);

const SHA = "f".repeat(40);
const HASH = "c".repeat(32);
const API = "https://api.github.com/repos/microsoft/fluentui-emoji-animated";
const RAW = `https://raw.githubusercontent.com/microsoft/fluentui-emoji-animated/${SHA}`;

const workDirectory = { path: "" };

beforeEach(async () => {
  state.sourcelessTasks = false;
  workDirectory.path = await mkdtemp(path.join(tmpdir(), "build-branches-"));
});
afterEach(async () => {
  vi.useRealTimers();
  await rm(workDirectory.path, { recursive: true, force: true });
});

const createSpriteRoutes = (): Record<string, { body: Uint8Array }> =>
  Object.fromEntries(
    createTeamsManifest().categories.flatMap((category) =>
      category.emoticons.flatMap((emoticon) =>
        ["", "_s2", "_s3", "_s4", "_s5", "_s6"].map((suffix) => [
          `GET ${buildSpriteUrl(emoticon.id, suffix)}`,
          { body: emoticon.diverse ? WAVE_PNG : SMILEY_PNG },
        ]),
      ),
    ),
  );

const createOptions = (): BuildOptions => {
  const fakeFetch = createFakeFetch({
    ...createSpriteRoutes(),
    [`GET ${buildManifestUrl(HASH)}`]: { body: createTeamsManifest() },
    [`GET ${API}/commits/main`]: { body: { sha: SHA } },
    [`GET ${API}/git/trees/${SHA}?recursive=1`]: {
      body: { truncated: false, tree: [] },
    },
    [`GET ${RAW}/LICENSE`]: { body: "MIT License" },
  });
  return {
    fetchImplementation: fakeFetch.fetch,
    teamsVersion: { hash: HASH, lastModified: "2025-10-16T22:08:15.000Z" },
    outputDirectory: path.join(workDirectory.path, "out"),
    cacheDirectory: path.join(workDirectory.path, "cache"),
  };
};

test("stamps builtAt from the system clock when no clock is injected", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
  const result = await buildAssets(createOptions());
  expect(result.version.builtAt).toBe("2026-01-02T03:04:05.000Z");
});

test("skips a sprite task that has no source", async () => {
  state.sourcelessTasks = true;
  const result = await buildAssets(createOptions());
  expect(result.skipped.length).toBeGreaterThan(0);
});
