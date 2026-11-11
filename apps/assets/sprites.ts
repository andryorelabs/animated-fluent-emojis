import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

/**
 * The frame size, in pixels, of the standard sprite sheets.
 */
const SPRITE_SIZE = 100;

/**
 * A sprite sheet and the animation data derived from it.
 */
export interface ConvertedSprite {
  readonly png: Buffer;
  readonly framesCount: number;
  readonly fps: number;
}

/**
 * The frame rate used when ffprobe reports no usable rate.
 */
const DEFAULT_FRAME_RATE = 24;

function tryParseFrameRate(rate: string | undefined): number | undefined {
  if (rate === undefined) return undefined;
  const [numerator, denominator] = rate.split("/").map(Number);
  if (numerator === undefined || denominator === undefined) return undefined;
  const frameRate = numerator / denominator;
  return Number.isFinite(frameRate) && frameRate > 0 ? frameRate : undefined;
}

/**
 * Parses an ffprobe frame rate such as `143/6` into frames per second.
 * @param rate The ratio string reported by ffprobe.
 * @returns The exact, possibly fractional, frames per second.
 */
export function parseFrameRate(rate: string): number {
  const parsed = tryParseFrameRate(rate);
  if (parsed === undefined) throw new Error(`Invalid frame rate "${rate}"`);
  return parsed;
}

/**
 * Picks the frame rate from ffprobe's reported rates, preferring the average
 * rate, then the base rate, then 24 fps.
 * @param averageRate The `avg_frame_rate` value, possibly `0/0`.
 * @param baseRate The `r_frame_rate` value, possibly missing or `0/0`.
 * @returns The exact, possibly fractional, frames per second, never throwing.
 */
export function resolveFrameRate(
  averageRate: string | undefined,
  baseRate: string | undefined,
): number {
  return tryParseFrameRate(averageRate) ?? tryParseFrameRate(baseRate) ?? DEFAULT_FRAME_RATE;
}

const PNG_SIGNATURE_LENGTH = 8;

/**
 * Reads the animation frame count from the `acTL` chunk of an animated PNG,
 * without decoding any frame.
 * @param animatedPng The bytes of the animated PNG.
 * @returns The number of frames declared by the `acTL` chunk.
 */
export function readApngFrameCount(animatedPng: Buffer): number {
  let offset = PNG_SIGNATURE_LENGTH;
  while (offset + 8 <= animatedPng.length) {
    const chunkLength = animatedPng.readUInt32BE(offset);
    const chunkType = animatedPng.toString("latin1", offset + 4, offset + 8);
    if (chunkType === "acTL" && chunkLength >= 8) {
      const framesCount = animatedPng.readUInt32BE(offset + 8);
      if (framesCount < 1) break;
      return framesCount;
    }
    if (chunkType === "IDAT") break;
    offset += 12 + chunkLength;
  }
  throw new Error("Animated PNG has no valid acTL frame count");
}

function buildFilterGraph(frameSizes: readonly number[], framesCount: number): string {
  const branches = frameSizes.map(
    (frameSize, index) =>
      `[branch${String(index)}]scale=${String(frameSize)}:${String(frameSize)}:flags=lanczos,tile=1x${String(framesCount)}[sheet${String(index)}]`,
  );
  const labels = frameSizes.map((_, index) => `[branch${String(index)}]`);
  return [`[0:v]split=${String(frameSizes.length)}${labels.join("")}`, ...branches].join(";");
}

/**
 * Converts an animated PNG into vertical sprite sheets, the layout the
 * `Emoji` component steps through. Every requested size comes from a single
 * ffmpeg decode.
 * @param animatedPng The bytes of the animated PNG.
 * @param frameSizes The width and height of each frame in pixels, one sheet per
 * entry; 100 by default, 200 builds the `@2x` sheet.
 * @returns The palette-optimized sprite sheets, in the order of `frameSizes`.
 */
export async function convertAnimatedPng(
  animatedPng: Buffer,
  frameSizes: readonly number[] = [SPRITE_SIZE],
): Promise<ConvertedSprite[]> {
  if (frameSizes.length === 0) throw new Error("No sprite frame sizes given");
  for (const frameSize of frameSizes) {
    if (!Number.isSafeInteger(frameSize) || frameSize < 1) {
      throw new Error(`Invalid sprite frame size ${String(frameSize)}`);
    }
  }
  const framesCount = readApngFrameCount(animatedPng);
  const workingDirectory = await mkdtemp(path.join(tmpdir(), "emoji-sprite-"));
  try {
    const inputPath = path.join(workingDirectory, "input.png");
    await writeFile(inputPath, animatedPng);

    const probe = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=avg_frame_rate,r_frame_rate",
      "-of",
      "json",
      inputPath,
    ]);
    const stream = (
      JSON.parse(probe.stdout) as {
        streams: { avg_frame_rate?: string; r_frame_rate?: string }[];
      }
    ).streams[0];
    if (!stream) throw new Error("ffprobe did not report a video stream");
    const fps = resolveFrameRate(stream.avg_frame_rate, stream.r_frame_rate);

    const outputPaths = frameSizes.map((_, index) =>
      path.join(workingDirectory, `sprite-${String(index)}.png`),
    );
    await execFileAsync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      inputPath,
      "-filter_complex",
      buildFilterGraph(frameSizes, framesCount),
      ...outputPaths.flatMap((outputPath, index) => [
        "-map",
        `[sheet${String(index)}]`,
        "-frames:v",
        "1",
        "-update",
        "1",
        outputPath,
      ]),
    ]);
    return await Promise.all(
      outputPaths.map(async (outputPath) => ({
        png: await sharp(await readFile(outputPath))
          .png({ palette: true, quality: 90, effort: 10 })
          .toBuffer(),
        framesCount,
        fps,
      })),
    );
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
