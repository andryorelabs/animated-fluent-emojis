import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { encodePublicFiles, frameDelays } from "./public-files";

const FRAME_SIZE = 16;
const FRAMES_COUNT = 4;

function frameColor(index: number): { r: number; g: number; b: number } {
  return {
    r: (index * 80 + 40) % 256,
    g: (index * 50 + 100) % 256,
    b: 255 - index * 60,
  };
}

async function buildSheet(framesCount = FRAMES_COUNT): Promise<Buffer> {
  const frames = Array.from({ length: framesCount }, (_, index) => ({
    input: {
      create: {
        width: FRAME_SIZE,
        height: FRAME_SIZE,
        channels: 4 as const,
        background: { ...frameColor(index), alpha: 1 },
      },
    },
    top: index * FRAME_SIZE,
    left: 0,
  }));
  return sharp({
    create: {
      width: FRAME_SIZE,
      height: FRAME_SIZE * framesCount,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(frames)
    .png()
    .toBuffer();
}

function buildInput(sheet: Buffer, firstFrame = 1) {
  return {
    sheet,
    frameSize: FRAME_SIZE,
    framesCount: FRAMES_COUNT,
    fps: 24,
    firstFrame,
  };
}

describe("frameDelays", () => {
  it("repeats the rounded delay for every frame", () => {
    expect(frameDelays(24, 3)).toEqual([42, 42, 42]);
  });

  it("rejects a non-positive frame rate", () => {
    expect(() => frameDelays(0, 3)).toThrow("Invalid frame rate");
  });
});

describe("encodePublicFiles", () => {
  it("encodes animated gif and webp with every frame and an infinite loop", async () => {
    const files = await encodePublicFiles(buildInput(await buildSheet()));
    for (const file of [files.gif, files.webp]) {
      const metadata = await sharp(file, { pages: -1 }).metadata();
      expect(metadata.pages).toBe(FRAMES_COUNT);
      expect(metadata.loop).toBe(0);
      expect(metadata.pageHeight).toBe(FRAME_SIZE);
    }
  });

  it.each([1, 3])("extracts the poster frame for firstFrame %i", async (firstFrame) => {
    const sheet = await buildSheet();
    const { png } = await encodePublicFiles(buildInput(sheet, firstFrame));
    const metadata = await sharp(png).metadata();
    expect([metadata.width, metadata.height]).toEqual([FRAME_SIZE, FRAME_SIZE]);
    const poster = await sharp(png).ensureAlpha().raw().toBuffer();
    const expected = await sharp(sheet)
      .ensureAlpha()
      .extract({
        left: 0,
        top: (firstFrame - 1) * FRAME_SIZE,
        width: FRAME_SIZE,
        height: FRAME_SIZE,
      })
      .raw()
      .toBuffer();
    expect(poster.equals(expected)).toBe(true);
  });

  it("throws when the sheet height does not match the frame geometry", async () => {
    const sheet = await buildSheet(FRAMES_COUNT - 1);
    await expect(encodePublicFiles(buildInput(sheet))).rejects.toThrow("expected 16x64");
  });

  it("throws when firstFrame is out of range", async () => {
    const sheet = await buildSheet();
    await expect(encodePublicFiles(buildInput(sheet, 5))).rejects.toThrow("outside 1..4");
  });

  it("is deterministic", async () => {
    const sheet = await buildSheet();
    const first = await encodePublicFiles(buildInput(sheet, 2));
    const second = await encodePublicFiles(buildInput(sheet, 2));
    expect(second.gif.equals(first.gif)).toBe(true);
    expect(second.webp.equals(first.webp)).toBe(true);
    expect(second.png.equals(first.png)).toBe(true);
  });
});
