import type { Snippet } from "svelte";

import type { EmojiId } from "../utils/emoji-id.generated.js";
import type { SkinTone } from "../utils/types.js";

/**
 * Props of the Svelte `Emoji`, matching the React props. `class`, `style` and
 * `attributes` style the root span; the fallback is a snippet.
 */
export interface EmojiProps {
  /** The unique identifier of the emoji. Known ids autocomplete; any string compiles. */
  id: EmojiId | (string & {});
  /** A number of pixels (default 100) or any CSS length such as `2rem`. */
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
  /** Accessible text. Defaults to the emoji description; an empty string marks the emoji as decorative. */
  alt?: string;
  /** Rendered when the image or manifest fails. Defaults to the Unicode glyph; `null` renders nothing. */
  fallback?: Snippet | null;
  /** Called when the image loads. */
  onLoad?: (event: Event) => void;
  /** Called when the image fails, and without an event when the manifest fails. */
  onError?: (event?: Event) => void;
  /** Called once when a finite run of `animationIterations` ends. */
  onPlaybackEnd?: () => void;
  /** Class names for the root span. */
  class?: string;
  /** Inline styles for the root span, as CSS property names or camelCase keys. */
  style?: Readonly<Record<string, string>>;
  /** Extra attributes for the root span, such as `data-*`. */
  attributes?: Readonly<Record<string, string>>;
}
