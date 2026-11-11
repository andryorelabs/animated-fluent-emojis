import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";

import type { BuildContext, ConvertSprite, StateFile } from "./build-context.js";
import { HD_MAX_FRAMES, type SpriteTask } from "./catalog.js";
import {
  buildHdSheets,
  getHdEtag,
  needsHdFromSameSource,
  storeHdSprite,
  withoutHdSource,
} from "./hd.js";
import { buildMitMediaUrl } from "./mit.js";
import { createFakeFetch, createTeamsManifest } from "./test-support.js";

const SHA = "a".repeat(40);
const WAVE_ID = "1f44b_wavinghand";
const GRIN_ID = "1f603_grinningfacewithbigeyes";

function createTask(overrides: Partial<SpriteTask> = {}): SpriteTask {
  return {
    source: "mit",
    id: WAVE_ID,
    category: "hands-id",
    toneSuffix: "",
    etag: "v5",
    outputPath: "sprites/wave.png",
    mitPath: "assets/wave/wave.png",
    hdOutputPath: "sprites-hd/wave.png",
    hdMitPath: "assets/wave/wave.png",
    hdBlobSha: "blob1",
    ...overrides,
  };
}

async function createContext(
  options: {
    state?: StateFile;
    routes?: Parameters<typeof createFakeFetch>[0];
    convert?: ConvertSprite;
  } = {},
) {
  const cacheDirectory = await mkdtemp(path.join(tmpdir(), "hd-"));
  const fake = createFakeFetch(options.routes ?? {});
  const convert: ConvertSprite =
    options.convert ??
    (() => Promise.resolve([{ png: Buffer.from("png"), framesCount: 21, fps: 24 }]));
  const context = {
    options: { fetchImplementation: fake.fetch, cacheDirectory },
    mitSha: SHA,
    state: options.state ?? {},
    convert,
  } as unknown as BuildContext;
  return { context, cacheDirectory, fake };
}

const mediaRoute = () => `GET ${buildMitMediaUrl(SHA, "assets/wave/wave.png")}`;

test("getHdEtag depends on the HD blob", () => {
  expect(getHdEtag(createTask())).toBe(getHdEtag(createTask()));
  expect(getHdEtag(createTask())).not.toBe(getHdEtag(createTask({ hdBlobSha: "blob2" })));
  expect(getHdEtag(createTask({ hdBlobSha: undefined }))).toBeTypeOf("string");
});

test("storeHdSprite writes the sheet and records the state", async () => {
  const { context, cacheDirectory } = await createContext();
  await storeHdSprite(
    createTask(),
    { png: Buffer.from("hd-bytes"), framesCount: 21, fps: 24 },
    context,
  );
  expect(await readFile(path.join(cacheDirectory, "sprites-hd/wave.png"), "utf8")).toBe("hd-bytes");
  expect(context.state["sprites-hd/wave.png"]).toEqual({
    etag: getHdEtag(createTask()),
    animation: { fps: 24, framesCount: 21 },
  });
});

test("storeHdSprite ignores a task without an HD output", async () => {
  const { context } = await createContext();
  await storeHdSprite(
    createTask({ hdOutputPath: undefined }),
    { png: Buffer.from("x"), framesCount: 1, fps: 24 },
    context,
  );
  expect(context.state).toEqual({});
});

test("needsHdFromSameSource is false without an HD source or a shared download", async () => {
  const { context } = await createContext();
  expect(await needsHdFromSameSource(createTask({ hdOutputPath: undefined }), context)).toBe(false);
  expect(await needsHdFromSameSource(createTask({ hdBlobSha: undefined }), context)).toBe(false);
  expect(await needsHdFromSameSource(createTask({ hdMitPath: "other.png" }), context)).toBe(false);
});

test("needsHdFromSameSource is true until the sheet is cached", async () => {
  const task = createTask();
  const { context, cacheDirectory } = await createContext();
  expect(await needsHdFromSameSource(task, context)).toBe(true);

  context.state["sprites-hd/wave.png"] = {
    etag: getHdEtag(task),
    animation: { fps: 24, framesCount: 21 },
  };
  expect(await needsHdFromSameSource(task, context)).toBe(true);

  await mkdir(path.join(cacheDirectory, "sprites-hd"), { recursive: true });
  await writeFile(path.join(cacheDirectory, "sprites-hd/wave.png"), "cached");
  expect(await needsHdFromSameSource(task, context)).toBe(false);

  context.state["sprites-hd/wave.png"] = { etag: getHdEtag(task) };
  expect(await needsHdFromSameSource(task, context)).toBe(true);
});

test("withoutHdSource drops only the HD fields", () => {
  expect(withoutHdSource(createTask({ sourceUrl: "https://x/y.png" }))).toEqual({
    source: "mit",
    id: WAVE_ID,
    category: "hands-id",
    toneSuffix: "",
    etag: "v5",
    outputPath: "sprites/wave.png",
    sourceUrl: "https://x/y.png",
    mitPath: "assets/wave/wave.png",
  });
  const bare = withoutHdSource(createTask({ mitPath: undefined, sourceUrl: undefined }));
  expect(bare).not.toHaveProperty("mitPath");
  expect(bare).not.toHaveProperty("sourceUrl");
});

test("buildHdSheets converts and publishes an HD emoji", async () => {
  const { context, cacheDirectory } = await createContext({
    routes: { [mediaRoute()]: { body: "apng" } },
  });
  const tasks = [createTask()];
  const result = await buildHdSheets(tasks, createTeamsManifest(), context);
  expect(result.skipped).toEqual([]);
  expect(result.tasks).toEqual(tasks);
  expect(result.hdEtagById.has(WAVE_ID)).toBe(true);
  expect(await readFile(path.join(cacheDirectory, "sprites-hd/wave.png"), "utf8")).toBe("png");
});

test("buildHdSheets reuses a cached sheet without downloading", async () => {
  const task = createTask();
  const { context, cacheDirectory, fake } = await createContext({
    state: {
      "sprites-hd/wave.png": {
        etag: getHdEtag(task),
        animation: { fps: 24, framesCount: 21 },
      },
    },
  });
  await mkdir(path.join(cacheDirectory, "sprites-hd"), { recursive: true });
  await writeFile(path.join(cacheDirectory, "sprites-hd/wave.png"), "cached");
  const result = await buildHdSheets([task], createTeamsManifest(), context);
  expect(fake.requests).toEqual([]);
  expect(result.hdEtagById.has(WAVE_ID)).toBe(true);
});

test("buildHdSheets skips emoji over the frame cap", async () => {
  const manifest = createTeamsManifest();
  const wave = manifest.categories[1]?.emoticons[0];
  if (wave) wave.animation.framesCount = HD_MAX_FRAMES + 1;
  const { context, fake } = await createContext();
  const result = await buildHdSheets([createTask()], manifest, context);
  expect(fake.requests).toEqual([]);
  expect(result.skipped).toEqual([]);
  expect(result.tasks).toEqual([withoutHdSource(createTask())]);
});

test("buildHdSheets skips an emoji whose frame count differs", async () => {
  const { context } = await createContext({
    routes: { [mediaRoute()]: { body: "apng" } },
    convert: () => Promise.resolve([{ png: Buffer.from("p"), framesCount: 10, fps: 24 }]),
  });
  const result = await buildHdSheets([createTask()], createTeamsManifest(), context);
  expect(result.skipped).toEqual([
    {
      id: WAVE_ID,
      reason: "sprites-hd/wave.png has 10 frames, standard sheet has 21",
    },
  ]);
  expect(result.hdEtagById.size).toBe(0);
});

test("buildHdSheets marks a failed download as transient", async () => {
  const { context } = await createContext();
  const result = await buildHdSheets([createTask()], createTeamsManifest(), context);
  expect(result.skipped).toHaveLength(1);
  expect(result.skipped[0]).toMatchObject({ id: WAVE_ID, transient: true });
  expect(result.skipped[0]?.reason).toContain("sprites-hd/wave.png: ");
});

test("buildHdSheets reports a task with no HD source", async () => {
  const { context } = await createContext();
  const result = await buildHdSheets(
    [createTask({ hdMitPath: undefined })],
    createTeamsManifest(),
    context,
  );
  expect(result.skipped[0]?.reason).toContain("Sprite task has no HD source: sprites/wave.png");
  expect(result.skipped[0]?.transient).toBe(true);
});

test("buildHdSheets reports a converter that returns nothing", async () => {
  const { context } = await createContext({
    routes: { [mediaRoute()]: { body: "apng" } },
    convert: () => Promise.resolve([]),
  });
  const result = await buildHdSheets([createTask()], createTeamsManifest(), context);
  expect(result.skipped[0]?.reason).toContain("Converter returned no sprite");
});

test("buildHdSheets wraps a non-Error rejection", async () => {
  const { context } = await createContext({
    routes: { [mediaRoute()]: { body: "apng" } },
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exercises the non-Error rejection branch
    convert: () => Promise.reject("boom"),
  });
  const result = await buildHdSheets([createTask()], createTeamsManifest(), context);
  expect(result.skipped[0]?.reason).toContain(": boom");
});

test("buildHdSheets skips an emoji missing from the manifest", async () => {
  const { context } = await createContext({
    routes: { [mediaRoute()]: { body: "apng" } },
  });
  const result = await buildHdSheets(
    [createTask({ id: "unknown" })],
    createTeamsManifest(),
    context,
  );
  expect(result.skipped).toEqual([{ id: "unknown", reason: "emoji is not in the manifest" }]);
});

test("buildHdSheets leaves tasks without HD output untouched", async () => {
  const { context } = await createContext();
  const task = createTask({
    id: GRIN_ID,
    hdOutputPath: undefined,
    hdMitPath: undefined,
    hdBlobSha: undefined,
  });
  const result = await buildHdSheets([task], createTeamsManifest(), context);
  expect(result.tasks).toEqual([task]);
  expect(result.skipped).toEqual([]);
});
