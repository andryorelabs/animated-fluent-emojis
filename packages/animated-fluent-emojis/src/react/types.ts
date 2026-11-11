import type { HTMLAttributes, ReactEventHandler, ReactNode, SyntheticEvent } from "react";

import type { DiverseEmojiId, EmojiId } from "../utils/emoji-id.generated.js";
import type { SkinTone } from "../utils/types.js";

/**
 * Props the component controls itself, so they are not passed to the root span.
 */
type ControlledSpanProps = "id" | "children" | "onLoad" | "onError";

/**
 * The base properties of the Emoji component, without the id-dependent
 * `skinTone` rule. Any other prop is passed to the root span.
 */
interface EmojiBaseProps extends Omit<HTMLAttributes<HTMLSpanElement>, ControlledSpanProps> {
  /** The unique identifier of the emoji. Known ids autocomplete; any string compiles. */
  id: EmojiId | (string & {});
  /** The size of the emoji: a number of pixels (default 100) or any CSS length such as `2rem` or `var(--size)`. */
  size?: number | string;
  /** Whether to play the animation on hover. Default is false. */
  playOnHover?: boolean;
  /** The number of times to play the animation, or 'infinite'. Default is 2. */
  animationIterations?: number | "infinite";
  /** Whether to automatically play the animation on mount. Default is true. */
  autoPlay?: boolean;
  /** Controls playback. `true` plays `animationIterations` runs, overriding `autoPlay` and reduced motion; `false` pauses on the current frame; left undefined, `autoPlay` applies. Remount with a new `key` to restart a finished run. */
  playing?: boolean;
  /** Called once when a finite run of `animationIterations` ends, never for `'infinite'` and not when the run is cancelled by unmount. */
  onPlaybackEnd?: () => void;
  /** Accessible text. Defaults to the emoji description; an empty string marks the emoji as decorative. */
  alt?: string;
  /** Rendered when the image fails or the manifest fails to load. Defaults to the emoji's Unicode glyph when known; `null` renders nothing. */
  fallback?: ReactNode;
  /** Called when the image loads. */
  onLoad?: ReactEventHandler<HTMLImageElement>;
  /** Called when the image fails to load, and with no event when the manifest fails to load. */
  onError?: (event?: SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Ids that are known not to support skin tones.
 */
type NonDiverseEmojiId = Exclude<EmojiId, DiverseEmojiId>;

/**
 * The `skinTone` prop, rejected when `Id` is a known id without skin tone
 * variants and accepted for diverse ids and arbitrary strings.
 */
type SkinToneProps<Id extends string> = [Id] extends [NonDiverseEmojiId]
  ? { skinTone?: never }
  : {
      /** The skin tone, for emojis that support it. Default is 'default'. */
      skinTone?: SkinTone;
    };

/**
 * Represents the properties for the Emoji component. `skinTone` is only
 * accepted when `Id` is a diverse or an arbitrary string id.
 */
export type EmojiProps<Id extends string = string> = Omit<EmojiBaseProps, "id"> & {
  id: Id | EmojiId | (string & {});
} & SkinToneProps<Id>;
