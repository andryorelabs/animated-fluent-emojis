import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const THEMES = {
  dark: {
    ground: "#0D1715",
    text: "#EAF4F1",
    muted: "#9AB0AA",
    accentRgb: "46,196,160",
    glow: 0.22,
  },
  light: {
    ground: "oklch(0.983 0.003 174.5)",
    text: "oklch(0.228 0.023 176.5)",
    muted: "oklch(0.467 0.026 178.2)",
    accentRgb: "46,196,160",
    glow: 0.16,
  },
};

export const MARK_SIZES = [16, 32, 48, 128, 512];
export const APPLE_TOUCH_SIZE = 180;
export const ICO_SIZES = [16, 32, 48];
export const KB = 1024;
export const MB = 1024 * KB;
export const COVER_SCALE = 1.5;
export const WEBP_QUALITY = 86;
const TAGLINE = "Fluent emojis,<br>but they move.";
const SUBLINE = "Microsoft's animated Fluent emojis as one component.";
const NOTICE = "Not affiliated with or endorsed by Microsoft.";

/**
 * Builds the HTML of a brand banner. Pure: the lockup SVG, the embedded font
 * CSS and the three emoji data URIs are inputs, so no file or browser is
 * needed. Dimensions scale from a 1280px-wide design.
 * @param options Banner inputs.
 * @param options.width Banner width in CSS pixels.
 * @param options.height Banner height in CSS pixels.
 * @param options.theme Colour theme.
 * @param options.lockupSvg Inline SVG of the horizontal lockup.
 * @param options.fontFaces CSS `@font-face` rules with embedded fonts.
 * @param options.emojiUris Three emoji image data URIs.
 * @returns The banner document HTML.
 */
export function bannerHtml({ width, height, theme, lockupSvg, fontFaces, emojiUris }) {
  const { ground, text, muted, accentRgb, glow } = THEMES[theme];
  const unit = width / 1280;
  const px = (value) => `${Math.round(value * unit)}px`;
  const emojiStyle = (size, rotate, left, top) =>
    `position:absolute;left:${px(left)};top:${px(top)};width:${px(size)};height:${px(size)};transform:rotate(${rotate}deg)`;
  return `<html lang="en"><style>${fontFaces}svg{display:block;width:100%;height:auto}img{display:block}</style>
    <body style="margin:0;width:${width}px;height:${height}px;position:relative;overflow:hidden;font-family:Figtree,system-ui,sans-serif;color:${text};background:radial-gradient(52% 78% at 78% 50%, rgba(${accentRgb},${glow}), transparent 70%), ${ground}">
      <div style="position:absolute;left:${px(80)};top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:${px(640)}">
        <div style="width:${px(500)}">${lockupSvg}</div>
        <div style="font-weight:800;font-size:${px(62)};line-height:1.04;letter-spacing:-0.03em;margin-top:${px(52)}">${TAGLINE}</div>
        <div style="font-weight:400;font-size:${px(24)};line-height:1.4;color:${muted};margin-top:${px(22)}">${SUBLINE}</div>
      </div>
      <div style="position:absolute;left:${px(80)};bottom:${px(40)};font-size:${px(15)};color:${muted};opacity:0.8">${NOTICE}</div>
      <img src="${emojiUris[0]}" alt="" style="${emojiStyle(220, -7, 760, 118)}">
      <img src="${emojiUris[1]}" alt="" style="${emojiStyle(168, 6, 984, 280)}">
      <img src="${emojiUris[2]}" alt="" style="${emojiStyle(150, -4, 806, 360)}">
    </body></html>`;
}

/**
 * Throws when the image at `outPath` misses its exact pixel size or exceeds
 * its byte budget; otherwise logs its path relative to `repositoryRoot` and
 * its size in KB. `log` defaults to `console.log`.
 * @param outPath Path of the image to check.
 * @param spec Expected image properties.
 * @param spec.width Expected width in pixels.
 * @param spec.height Expected height in pixels.
 * @param spec.maxBytes Maximum file size in bytes.
 * @param [options] Reporting options.
 * @param [options.repositoryRoot] Base for the logged relative path.
 * @param [options.log] Success logger.
 * @returns Resolves when the image meets the spec.
 */
export async function assertSpec(
  outPath,
  { width, height, maxBytes },
  { repositoryRoot = process.cwd(), log = console.log } = {},
) {
  const { size } = await stat(outPath);
  const meta = await sharp(outPath).metadata();
  const name = path.basename(outPath);
  if (meta.width !== width || meta.height !== height) {
    throw new Error(`${name} is ${meta.width}x${meta.height}, expected ${width}x${height}`);
  }
  if (size > maxBytes) {
    throw new Error(`${name} is ${size} bytes, over ${maxBytes}`);
  }
  log(`${path.relative(repositoryRoot, outPath)} ${(size / KB).toFixed(0)} KB`);
}

const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

/**
 * Packs PNG images into one `.ico` container. Every entry keeps its PNG
 * payload as is, which every browser that requests `/favicon.ico` accepts.
 * @param images PNG buffers with their square pixel size, at most 256.
 * @returns The `.ico` file bytes.
 */
export function encodeIco(images) {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(ICO_ENTRY_BYTES);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}
