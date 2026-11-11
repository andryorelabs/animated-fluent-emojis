import type { Manifest } from "../../packages/animated-fluent-emojis/src/utils/types.js";

/**
 * One emoji entry of a manifest.
 */
export type Emoticon = Manifest["categories"][number]["emoticons"][number];

/**
 * Pixel size of one frame in a standard sprite sheet.
 */
export const SPRITE_FRAME_SIZE = 100;

/**
 * Pixel size of one frame in an HD sprite sheet.
 */
export const HD_FRAME_SIZE = 200;

/**
 * The skin tone suffixes a diverse emoji carries besides the default tone.
 */
export const TONE_SUFFIXES = ["_s2", "_s3", "_s4", "_s5", "_s6"] as const;

/**
 * Indexes every emoji of a manifest by id.
 * @param manifest The manifest to index.
 * @returns The emoticons keyed by emoji id.
 */
export function indexEmoticons(manifest: Manifest): Map<string, Emoticon> {
  return new Map(
    manifest.categories.flatMap((category) =>
      category.emoticons.map((emoticon) => [emoticon.id, emoticon] as const),
    ),
  );
}
