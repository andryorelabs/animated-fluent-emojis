import type { EmojiAstroProps } from "./types.js";

/**
 * Typings for the `.astro` component that this entry's `default` condition
 * resolves to. It renders the emoji HTML at build time and a small script
 * starts playback in the browser.
 */
declare const Emoji: (props: EmojiAstroProps) => unknown;

export default Emoji;
export type { EmojiAstroProps } from "./types.js";
