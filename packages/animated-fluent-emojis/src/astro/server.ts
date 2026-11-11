import { normalizeSize } from "../core/normalize.js";
import { getSpriteSourceSet, getSpriteUrl, startManifestLoad } from "../utils/emoji-manifest.js";
import { isDevelopment } from "../utils/is-development.js";
import {
  buildFallbackHtml,
  buildReadyHtml,
  type EmojiRuntimeConfig,
  type RootOptions,
} from "./markup.js";
import type { EmojiAstroProps } from "./types.js";

const warnedMissingIds = new Set<string>();

/**
 * Renders the HTML of one emoji at build or request time. A ready emoji is a
 * sized span around the sprite image, hydrated in the browser by the client
 * script. An unknown id or a failed manifest renders the slotted fallback, or
 * nothing without one.
 * @param props - The component props.
 * @param fallbackHtml - Rendered `fallback` slot content, or an empty string.
 * @returns The HTML string to emit.
 */
export const renderEmojiHtml = async (
  props: EmojiAstroProps,
  fallbackHtml: string,
): Promise<string> => {
  const root: RootOptions = {
    size: props.size,
    alt: props.alt,
    className: props.class,
    style: props.style,
  };
  const snapshot = await startManifestLoad();
  if (snapshot.status !== "ready") {
    return buildFallbackHtml(root, fallbackHtml);
  }

  const emoji = snapshot.manifest[props.id];
  if (!emoji) {
    if (isDevelopment() && !warnedMissingIds.has(props.id)) {
      warnedMissingIds.add(props.id);
      console.warn(`Unknown emoji id "${props.id}".`);
    }
    return buildFallbackHtml(root, fallbackHtml);
  }

  const label = props.alt ?? emoji.description;
  const config: EmojiRuntimeConfig = {
    playOnHover: props.playOnHover ?? false,
    animationIterations: props.animationIterations ?? 2,
    autoPlay: props.autoPlay ?? true,
    playing: props.playing,
    size: normalizeSize(props.size ?? 100),
    animation: emoji.animation,
    label,
    unicode: emoji.unicode,
  };
  return buildReadyHtml(
    { ...root, config },
    {
      source: getSpriteUrl(emoji, props.skinTone),
      sourceSet: getSpriteSourceSet(emoji, props.skinTone),
      alt: label,
    },
    fallbackHtml,
  );
};
