import type { SkinTone } from "../utils/types.js";

/**
 * Props of the Astro `Emoji` component, matching the React `Emoji` where
 * Astro can express them. The fallback is the `fallback` named slot, and the
 * playback and error callbacks are DOM events on the root span.
 */
export interface EmojiAstroProps {
  /** The unique identifier of the emoji. */
  id: string;
  /** A number of pixels (default 100) or any CSS length. */
  size?: number | string;
  /** Whether to play the animation on hover. Default is false. */
  playOnHover?: boolean;
  /** The number of times to play the animation, or 'infinite'. Default is 2. */
  animationIterations?: number | "infinite";
  /** Whether to automatically play the animation. Default is true. */
  autoPlay?: boolean;
  /** `true` plays, overriding `autoPlay` and reduced motion; `false` pauses. */
  playing?: boolean;
  /** The skin tone, for emojis that support it. Default is 'default'. */
  skinTone?: SkinTone;
  /** Accessible text; an empty string marks the emoji as decorative. */
  alt?: string;
  /** Class names for the root span. */
  class?: string;
  /** Inline styles for the root span, as a CSS declaration string. */
  style?: string;
}
