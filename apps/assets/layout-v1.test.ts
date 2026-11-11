import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";

import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";
import type { SpriteTask } from "./catalog.js";
import { buildV1SpritePath, toV1Manifest, validateV1Layout } from "./layout-v1.js";
import { createSpritePng } from "./test-support.js";

const context = { outputDirectory: "" };

beforeEach(async () => {
  context.outputDirectory = await mkdtemp(path.join(tmpdir(), "layout-v1-"));
});
afterEach(async () => {
  await rm(context.outputDirectory, { recursive: true, force: true });
});

const manifest = {
  categories: [
    {
      id: "c",
      title: "Cat",
      description: "d",
      emoticons: [
        {
          id: "e1",
          description: "E",
          shortcuts: [],
          unicode: "x",
          etag: "abc",
          diverse: false,
          animation: { fps: 24, framesCount: 4, firstFrame: 1 },
          keywords: [],
        },
      ],
    },
  ],
} as unknown as Manifest;

const tasks: SpriteTask[] = [
  {
    source: "teams",
    id: "e1",
    category: "Cat",
    toneSuffix: "",
    etag: "abc",
    outputPath: "sprites/Cat/e1.png",
  },
];

const spritePath = "v1/sprites/Cat/e1.abc.png";

const writeSite = async (): Promise<void> => {
  const root = context.outputDirectory;
  await mkdir(path.join(root, "v1/sprites/Cat"), { recursive: true });
  await writeFile(path.join(root, spritePath), await createSpritePng(4));
  await writeFile(path.join(root, "v1/manifest.slim.json"), JSON.stringify(toV1Manifest(manifest)));
  await writeFile(path.join(root, "v1/version.json"), "{}");
};

const validate = () =>
  validateV1Layout({
    manifest,
    tasks,
    outputDirectory: context.outputDirectory,
  });

test("builds etag-named sprite paths", () => {
  expect(buildV1SpritePath("sprites/Cat/e1_s2.png", "abc")).toBe("v1/sprites/Cat/e1_s2.abc.png");
  expect(buildV1SpritePath("sprites/Cat/e1_s2@2x.png", "abc")).toBe(
    "v1/sprites/Cat/e1_s2.abc@2x.png",
  );
});

test("adds unicode to the v1 manifest", () => {
  expect(toV1Manifest(manifest).categories[0]?.emoticons[0]).toMatchObject({
    id: "e1",
    unicode: "x",
  });
});

test("passes a complete v1 layout", async () => {
  await writeSite();
  await expect(validate()).resolves.toBeUndefined();
});

test("fails when a v1 sprite is missing", async () => {
  await writeSite();
  await rm(path.join(context.outputDirectory, spritePath));
  await expect(validate()).rejects.toThrow("missing v1 sprite");
});

test("fails when a file name etag disagrees with the manifest", async () => {
  await writeSite();
  await rename(
    path.join(context.outputDirectory, spritePath),
    path.join(context.outputDirectory, "v1/sprites/Cat/e1.old.png"),
  );
  await expect(validate()).rejects.toThrow(
    'file name etag "old" disagrees with manifest etag "abc"',
  );
});

test("fails when the v1 manifest is missing", async () => {
  await writeSite();
  await rm(path.join(context.outputDirectory, "v1/manifest.slim.json"));
  await expect(validate()).rejects.toThrow("v1/manifest.slim.json is unreadable");
});

test("fails when the v1 version file is missing", async () => {
  await writeSite();
  await rm(path.join(context.outputDirectory, "v1/version.json"));
  await expect(validate()).rejects.toThrow("v1/version.json is unreadable");
});

test("fails when the v1 manifest differs from the catalog", async () => {
  await writeSite();
  await writeFile(path.join(context.outputDirectory, "v1/manifest.slim.json"), "{}");
  await expect(validate()).rejects.toThrow("v1/manifest.slim.json does not match the manifest");
});

const entryWith = (overrides: Record<string, unknown>, animation: Record<string, unknown> = {}) => {
  const base = manifest.categories[0]?.emoticons[0];
  return {
    categories: [
      {
        id: "c",
        title: "Cat",
        description: "d",
        emoticons: [
          {
            ...base,
            ...overrides,
            animation: { ...base?.animation, ...animation },
          },
        ],
      },
    ],
  } as unknown as Manifest;
};

test("omits default-valued fields from v1 entries", () => {
  expect(toV1Manifest(manifest).categories[0]?.emoticons[0]).toEqual({
    id: "e1",
    description: "E",
    etag: "abc",
    unicode: "x",
    animation: { framesCount: 4 },
  });
});

test("keeps non-default fields in v1 entries", () => {
  const entry = toV1Manifest(entryWith({ diverse: true, hd: true }, { fps: 30, firstFrame: 2 }))
    .categories[0]?.emoticons[0];
  expect(entry).toEqual({
    id: "e1",
    description: "E",
    etag: "abc",
    unicode: "x",
    animation: { framesCount: 4, fps: 30, firstFrame: 2 },
    diverse: true,
    hd: true,
  });
});

test("omits hd for a 121-frame emoji and keeps it for an 81-frame one", () => {
  const tall = toV1Manifest(entryWith({}, { framesCount: 121 }));
  const capped = toV1Manifest(entryWith({ hd: true }, { framesCount: 81 }));
  expect(tall.categories[0]?.emoticons[0]).not.toHaveProperty("hd");
  expect(capped.categories[0]?.emoticons[0]?.hd).toBe(true);
});
