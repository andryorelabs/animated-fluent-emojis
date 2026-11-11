import sharp from "sharp";

/**
 * The encoded public files of one emoji.
 */
export interface PublicFiles {
  readonly gif: Buffer;
  readonly webp: Buffer;
  readonly png: Buffer;
}

/**
 * The input of {@link encodePublicFiles}.
 */
export interface PublicFilesInput {
  readonly sheet: Buffer;
  readonly frameSize: number;
  readonly framesCount: number;
  readonly fps: number;
  readonly firstFrame: number;
}

/**
 * Builds the per-frame delays of an animation.
 * @param fps The frames per second, possibly fractional.
 * @param framesCount The number of frames.
 * @returns One delay in milliseconds per frame.
 */
export function frameDelays(fps: number, framesCount: number): number[] {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`Invalid frame rate ${String(fps)}`);
  }
  return Array.from({ length: framesCount }, () => Math.round(1000 / fps));
}

/**
 * Encodes a vertical sprite sheet into an animated GIF, an animated WebP and
 * a poster-frame PNG. GIF delays are stored in 10 ms steps, so GIF playback
 * runs slightly faster than the WebP.
 * @param input The sheet and its frame geometry; `firstFrame` is 1-based.
 * @returns The three encoded files.
 */
export async function encodePublicFiles(input: PublicFilesInput): Promise<PublicFiles> {
  const { sheet, frameSize, framesCount, fps, firstFrame } = input;
  if (!Number.isSafeInteger(firstFrame) || firstFrame < 1 || firstFrame > framesCount) {
    throw new Error(`First frame ${String(firstFrame)} is outside 1..${String(framesCount)}`);
  }
  const { data, info } = await sharp(sheet)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== frameSize || info.height !== frameSize * framesCount) {
    throw new Error(
      `Sheet is ${String(info.width)}x${String(info.height)}, expected ${String(frameSize)}x${String(frameSize * framesCount)}`,
    );
  }
  const raw = { width: info.width, height: info.height, channels: 4 as const };
  const animatedRaw = { ...raw, pageHeight: frameSize };
  const delay = frameDelays(fps, framesCount);
  const [gif, webp, png] = await Promise.all([
    sharp(data, { raw: animatedRaw })
      .gif({ delay, loop: 0, reuse: true, dither: 0, effort: 7 })
      .toBuffer(),
    sharp(data, { raw: animatedRaw })
      .webp({ delay, loop: 0, quality: 80, alphaQuality: 90, effort: 4 })
      .toBuffer(),
    sharp(data, { raw })
      .extract({
        left: 0,
        top: (firstFrame - 1) * frameSize,
        width: frameSize,
        height: frameSize,
      })
      .png()
      .toBuffer(),
  ]);
  return { gif, webp, png };
}
