import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import type { SpriteTask } from "./catalog.js";
import { createSpritePng } from "./test-support.js";
import { findSpriteSheetProblem, validateCatalog } from "./validate.js";

const TONES = ["", "_s2", "_s3", "_s4", "_s5", "_s6"];

const context = { cacheDirectory: "" };

beforeEach(async () => {
  context.cacheDirectory = await mkdtemp(path.join(tmpdir(), "validate-test-"));
});
afterEach(async () => {
  await rm(context.cacheDirectory, { recursive: true, force: true });
});

const createManifest = (
  overrides: {
    fps?: number;
    framesCount?: number;
    firstFrame?: number;
    diverse?: boolean;
    hd?: boolean;
    id?: string;
    category?: string;
  } = {},
): Manifest => ({
  categories: [
    {
      id: "c",
      title: overrides.category ?? "Cat",
      emoticons: [
        {
          id: overrides.id ?? "e1",
          description: "E",
          shortcuts: [],
          unicode: "x",
          etag: "a",
          diverse: overrides.diverse ?? false,
          animation: {
            fps: overrides.fps ?? 24,
            framesCount: overrides.framesCount ?? 40,
            firstFrame: overrides.firstFrame ?? 1,
          },
          keywords: [],
          ...(overrides.hd && { hd: true }),
        },
      ],
    },
  ] as unknown as Manifest["categories"],
});

const createTasks = (
  suffixes: readonly string[],
  source: SpriteTask["source"] = "teams",
): SpriteTask[] =>
  suffixes.map((toneSuffix) => ({
    source,
    id: "e1",
    category: "Cat",
    toneSuffix,
    etag: "a",
    outputPath: `sprites/Cat/e1${toneSuffix}.png`,
  }));

const writeFileInCache = async (relativePath: string, bytes: Uint8Array): Promise<void> => {
  const target = path.join(context.cacheDirectory, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
};

const writeSprites = async (tasks: readonly SpriteTask[], framesCount = 40): Promise<void> => {
  const png = await createSpritePng(framesCount);
  for (const task of tasks) await writeFileInCache(task.outputPath, png);
};

test("passes a complete catalog", async () => {
  const tasks = createTasks(TONES);
  await writeSprites(tasks);
  await expect(
    validateCatalog({
      manifest: createManifest({ diverse: true }),
      tasks,
      cacheDirectory: context.cacheDirectory,
    }),
  ).resolves.toBeUndefined();
});

test("rejects zero frames and zero fps", async () => {
  const tasks = createTasks([""]);
  await writeSprites(tasks);
  const input = { tasks, cacheDirectory: context.cacheDirectory };
  await expect(
    validateCatalog({ ...input, manifest: createManifest({ framesCount: 0 }) }),
  ).rejects.toThrow("e1: invalid animation");
  await expect(validateCatalog({ ...input, manifest: createManifest({ fps: 0 }) })).rejects.toThrow(
    "e1: invalid animation",
  );
});

test("rejects a planned sprite missing from the cache", async () => {
  await expect(
    validateCatalog({
      manifest: createManifest(),
      tasks: createTasks([""]),
      cacheDirectory: context.cacheDirectory,
    }),
  ).rejects.toThrow("missing sprite sprites/Cat/e1.png");
});

test("rejects a diverse emoji lacking tone sprites", async () => {
  const tasks = createTasks(["", "_s2", "_s3"]);
  await writeSprites(tasks);
  await expect(
    validateCatalog({
      manifest: createManifest({ diverse: true }),
      tasks,
      cacheDirectory: context.cacheDirectory,
    }),
  ).rejects.toThrow(/missing tone sprite _s4[\s\S]*_s5[\s\S]*_s6/);
});

test("lists every problem in one error", async () => {
  await expect(
    validateCatalog({
      manifest: createManifest({ framesCount: 0, diverse: true }),
      tasks: createTasks([""]),
      cacheDirectory: context.cacheDirectory,
    }),
  ).rejects.toThrow(/7 problem\(s\)/);
});

const run = (manifest: Manifest, tasks: readonly SpriteTask[]): Promise<void> =>
  validateCatalog({ manifest, tasks, cacheDirectory: context.cacheDirectory });

test("rejects a non-finite fps", async () => {
  const tasks = createTasks([""]);
  await writeSprites(tasks);
  await expect(run(createManifest({ fps: Infinity }), tasks)).rejects.toThrow("fps must be finite");
  await expect(run(createManifest({ fps: NaN }), tasks)).rejects.toThrow("fps must be finite");
});

test("rejects a firstFrame outside the frame range", async () => {
  const tasks = createTasks([""]);
  await writeSprites(tasks);
  await expect(run(createManifest({ firstFrame: 0 }), tasks)).rejects.toThrow(
    "firstFrame must be within [1, framesCount]",
  );
  await expect(run(createManifest({ firstFrame: 41 }), tasks)).rejects.toThrow(
    "firstFrame must be within [1, framesCount]",
  );
});

test("rejects a sprite whose width differs from the frame size", async () => {
  const tasks = createTasks([""]);
  await writeFileInCache(tasks[0]?.outputPath ?? "", await createSpritePng(40, { width: 64 }));
  await expect(run(createManifest(), tasks)).rejects.toThrow("is 64px wide, expected 100px");
});

test("rejects a sprite whose height does not match framesCount", async () => {
  const tasks = createTasks([""]);
  await writeSprites(tasks, 39);
  await expect(run(createManifest(), tasks)).rejects.toThrow(
    "is 3900px tall, expected 4000px (40 frames)",
  );
});

test("rejects a sprite that cannot be decoded", async () => {
  const tasks = createTasks([""]);
  await writeFileInCache(tasks[0]?.outputPath ?? "", Buffer.from("not a png"));
  await expect(run(createManifest(), tasks)).rejects.toThrow("could not be decoded");
});

test("validates HD sheets against 200px frames", async () => {
  const tasks = createTasks([""]);
  const hdTasks = tasks.map((task) => ({
    ...task,
    hdOutputPath: "sprites/Cat/e1@2x.png",
  }));
  await writeSprites(tasks);
  await writeFileInCache("sprites/Cat/e1@2x.png", await createSpritePng(40, { frameSize: 100 }));
  await expect(run(createManifest({ hd: true }), hdTasks)).rejects.toThrow(
    "e1@2x.png is 100px wide, expected 200px",
  );
  await writeFileInCache("sprites/Cat/e1@2x.png", await createSpritePng(40, { frameSize: 200 }));
  await expect(run(createManifest({ hd: true }), hdTasks)).resolves.toBeUndefined();
});

test("rejects an HD sheet with a different frame count than the standard one", async () => {
  const tasks = createTasks([""]);
  const hdTasks = tasks.map((task) => ({
    ...task,
    hdOutputPath: "sprites/Cat/e1@2x.png",
  }));
  await writeSprites(tasks);
  await writeFileInCache("sprites/Cat/e1@2x.png", await createSpritePng(39, { frameSize: 200 }));
  await expect(run(createManifest({ hd: true }), hdTasks)).rejects.toThrow(
    "e1@2x.png is 7800px tall, expected 8000px (40 frames)",
  );
});

test("rejects an hd flag without HD sheets for every tone, and HD sheets without the flag", async () => {
  const tasks = createTasks(TONES);
  const partial = tasks.map((task, index) =>
    index === 0 ? { ...task, hdOutputPath: "sprites/Cat/e1@2x.png" } : task,
  );
  await expect(run(createManifest({ hd: true, diverse: true }), partial)).rejects.toThrow(
    "flagged hd but not every tone has an HD sprite",
  );
  await expect(run(createManifest({ diverse: true }), partial)).rejects.toThrow(
    "has HD sprites but is not flagged hd",
  );
});

test("rejects category and id values that are not URL-safe", async () => {
  const unsafeValues = [
    "a/b",
    String.raw`a\b`,
    "..",
    "a..b",
    `a${String.fromCodePoint(0)}b`,
    "a\nb",
    "",
  ];
  for (const value of unsafeValues) {
    await expect(run(createManifest({ id: value }), createTasks([""], "teams"))).rejects.toThrow(
      `id ${JSON.stringify(value)} is not URL-safe`,
    );
    await expect(run(createManifest({ category: value }), createTasks([""]))).rejects.toThrow(
      `category ${JSON.stringify(value)} is not URL-safe`,
    );
  }
});

test("rejects a duplicate id across categories", async () => {
  const tasks = createTasks([""]);
  await writeSprites(tasks);
  const [category] = createManifest().categories;
  if (!category) throw new Error("fixture has no category");
  const manifest: Manifest = {
    categories: [category, { ...category, id: "other", title: "Other" }],
  };
  await expect(run(manifest, tasks)).rejects.toThrow("e1: duplicate id across categories");
});

test("rejects an emoji with no base sprite task", async () => {
  const tasks = createTasks(["_s2"]);
  await writeSprites(tasks);
  await expect(run(createManifest(), tasks)).rejects.toThrow("e1: missing base sprite task");
});

test("rejects an official emoji whose tones have different frame counts", async () => {
  const tasks = createTasks(TONES, "mit");
  await writeSprites(tasks, 40);
  await writeFileInCache("sprites/Cat/e1_s3.png", await createSpritePng(30));
  await expect(run(createManifest({ diverse: true }), tasks)).rejects.toThrow(
    /e1: skin tones have different frame counts \(40, 30\)/,
  );
});

test("lists every violation of different rules in one error", async () => {
  const tasks = createTasks(["_s2"]);
  await writeFileInCache(tasks[0]?.outputPath ?? "", await createSpritePng(40, { width: 64 }));
  let message = "";
  try {
    await run(createManifest({ fps: 0, id: "a/b", firstFrame: 99 }), tasks);
  } catch (error: unknown) {
    message = error instanceof Error ? error.message : "";
  }
  expect(message).toContain("invalid animation");
  expect(message).toContain("is not URL-safe");
  expect(message).toContain("missing base sprite task");
  expect(message).toContain("is 64px wide");
});

test("rejects an HD sheet taller than the texture limit", async () => {
  const tasks = createTasks([""]);
  const hdTasks = tasks.map((task) => ({
    ...task,
    hdOutputPath: "sprites/Cat/e1@2x.png",
  }));
  await writeSprites(tasks, 82);
  await writeFileInCache("sprites/Cat/e1@2x.png", await createSpritePng(82, { frameSize: 200 }));
  await expect(run(createManifest({ hd: true, framesCount: 82 }), hdTasks)).rejects.toThrow(
    "above the 16384px texture limit",
  );
});

test("rejects a sheet whose image data is corrupt past the header", async () => {
  const tasks = createTasks([""]);
  const png = Buffer.from(await createSpritePng(40));
  const idatOffset = png.indexOf("IDAT");
  png.fill(0xff, idatOffset + 4 + 20, idatOffset + 4 + 120);
  await writeFileInCache(tasks[0]?.outputPath ?? "", png);
  await expect(
    validateCatalog({
      manifest: createManifest(),
      tasks,
      cacheDirectory: context.cacheDirectory,
    }),
  ).rejects.toThrow("could not be decoded");
});

test("findSpriteSheetProblem reports a truncated sheet", async () => {
  const png = await createSpritePng(40);
  const truncated = png.subarray(0, -80);
  expect(await findSpriteSheetProblem(truncated, 100, 40)).toContain("could not be decoded");
  expect(await findSpriteSheetProblem(png, 100, 40)).toBeUndefined();
});
