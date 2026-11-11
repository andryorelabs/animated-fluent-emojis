import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, test } from "vitest";

import {
  convertAnimatedPng,
  parseFrameRate,
  readApngFrameCount,
  resolveFrameRate,
} from "./sprites.js";

const hasFfmpeg =
  spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

const skipWithoutFfmpeg = !hasFfmpeg && !process.env.CI;

test("parseFrameRate keeps the exact fractional rate", () => {
  expect(parseFrameRate("143/6")).toBeCloseTo(23.8333, 4);
  expect(parseFrameRate("10/1")).toBe(10);
});

test("parseFrameRate rejects invalid ratios", () => {
  expect(() => parseFrameRate("0/0")).toThrow("Invalid frame rate");
  expect(() => parseFrameRate("abc")).toThrow("Invalid frame rate");
});

test("resolveFrameRate keeps fractional rates and ignores non-positive ones", () => {
  expect(resolveFrameRate("143/6", "30/1")).toBeCloseTo(23.8333, 4);
  expect(resolveFrameRate("0/1", "30/1")).toBe(30);
});

test("resolveFrameRate prefers the average rate", () => {
  expect(resolveFrameRate("10/1", "30/1")).toBe(10);
});

test("resolveFrameRate falls back to the base rate on 0/0", () => {
  expect(resolveFrameRate("0/0", "30/1")).toBe(30);
  expect(resolveFrameRate(undefined, "12/1")).toBe(12);
});

test("resolveFrameRate falls back to 24 when no rate is usable", () => {
  expect(resolveFrameRate("0/0", "0/0")).toBe(24);
  expect(resolveFrameRate(undefined, undefined)).toBe(24);
  expect(resolveFrameRate("abc", "")).toBe(24);
});

async function convertTestAnimation(frameSizes?: readonly number[]) {
  const directory = await mkdtemp(path.join(tmpdir(), "sprite-test-"));
  try {
    const apngPath = path.join(directory, "input.png");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=256x256:rate=10:duration=0.5",
      "-plays",
      "0",
      "-f",
      "apng",
      apngPath,
    ]);
    const apng = await readFile(apngPath);
    const sprites = await convertAnimatedPng(apng, frameSizes);
    return {
      apng,
      sprites,
      metadata: await Promise.all(sprites.map((sprite) => sharp(sprite.png).metadata())),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test.skipIf(skipWithoutFfmpeg)(
  "convertAnimatedPng stacks every frame into a 100px wide sprite",
  async () => {
    const { sprites, metadata } = await convertTestAnimation();

    expect(sprites).toHaveLength(1);
    expect(sprites[0]?.framesCount).toBe(5);
    expect(sprites[0]?.fps).toBe(10);
    expect(metadata[0]?.width).toBe(100);
    expect(metadata[0]?.height).toBe(500);
  },
);

test.skipIf(skipWithoutFfmpeg)(
  "convertAnimatedPng builds the 100px and 200px sheets from one decode",
  async () => {
    const { apng, sprites, metadata } = await convertTestAnimation([100, 200]);

    expect(readApngFrameCount(apng)).toBe(5);
    expect(sprites.map((sprite) => sprite.framesCount)).toEqual([5, 5]);
    expect(sprites.map((sprite) => sprite.fps)).toEqual([10, 10]);
    expect(metadata.map((meta) => [meta.width, meta.height])).toEqual([
      [100, 500],
      [200, 1000],
    ]);
  },
);

test("readApngFrameCount rejects a PNG without an acTL chunk", () => {
  const plainPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(4),
    Buffer.from("IDAT"),
    Buffer.alloc(4),
  ]);
  expect(() => readApngFrameCount(plainPng)).toThrow("acTL");
});

test("convertAnimatedPng rejects an invalid frame size", async () => {
  await expect(convertAnimatedPng(Buffer.alloc(0), [0])).rejects.toThrow(
    "Invalid sprite frame size",
  );
});
