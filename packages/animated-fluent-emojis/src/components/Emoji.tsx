import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefAttributes,
} from "react";

import { normalizeSize, toCssLength } from "../core/normalize.js";
import { useEmojiAnimation, useEmojiStyle } from "../hooks/index.js";
import type { EmojiProps } from "../react/types.js";
import { getSpriteSourceSet, getSpriteUrl } from "../utils/index.js";
import { isDevelopment } from "../utils/is-development.js";
import { createSharedSubscription } from "../utils/shared-subscription.js";
import styles from "./Emoji.module.css";

const DEFAULT_SIZE = 100;

const warnedMissingIds = new Set<string>();

const subscribeToOnline = createSharedSubscription((notify) => {
  globalThis.addEventListener("online", notify);
  return () => {
    globalThis.removeEventListener("online", notify);
  };
});

const EmojiComponent = (
  {
    id,
    size: requestedSize = DEFAULT_SIZE,
    playOnHover = false,
    animationIterations = 2,
    autoPlay = true,
    playing,
    onPlaybackEnd,
    skinTone = "default",
    alt,
    fallback,
    onLoad,
    onError,
    className,
    style,
    ...spanProps
  }: EmojiProps,
  ref: Ref<HTMLSpanElement>,
): ReactElement | null => {
  const size = normalizeSize(requestedSize);
  const { status, emoji } = useEmojiStyle(id);
  const spriteSource = emoji ? getSpriteUrl(emoji, skinTone) : undefined;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const { isInitialAnimationComplete, animationStyle, imageRef } = useEmojiAnimation(
    emoji,
    playOnHover,
    animationIterations,
    autoPlay,
    typeof size === "number" ? size : "100%",
    spriteSource,
    failedSource !== null && failedSource === spriteSource,
    { playing, onPlaybackEnd },
  );
  const onErrorRef = useRef(onError);
  const hasReportedErrorRef = useRef(false);
  const hasObservedOwnAttemptRef = useRef(false);
  useEffect(() => {
    onErrorRef.current = onError;
  });
  useEffect(() => {
    if (status === "loading") hasObservedOwnAttemptRef.current = true;
    if (status !== "error") {
      hasReportedErrorRef.current = false;
    } else if (hasObservedOwnAttemptRef.current && !hasReportedErrorRef.current) {
      hasReportedErrorRef.current = true;
      onErrorRef.current?.();
    }
  }, [status]);
  useEffect(() => {
    if (status !== "missing" || !isDevelopment() || warnedMissingIds.has(id)) {
      return;
    }
    warnedMissingIds.add(id);
    console.warn(`Unknown emoji id "${id}".`);
  }, [status, id]);
  useEffect(() => {
    const retry = () => {
      setFailedSource(null);
    };
    const unsubscribe = subscribeToOnline(retry);
    return () => {
      unsubscribe();
      retry();
    };
  }, [spriteSource]);

  const cssSize = toCssLength(size);
  const containerStyle = {
    width: cssSize,
    height: cssSize,
    display: "inline-block",
    overflow: "hidden",
    ...style,
  };

  if (status === "loading") {
    return (
      <span
        {...spanProps}
        ref={ref}
        aria-hidden="true"
        style={containerStyle}
        className={className}
      />
    );
  }

  const isDecorative = alt === "";
  const renderFallback = (content: ReactNode): ReactElement => (
    <span
      {...spanProps}
      ref={ref}
      aria-hidden={isDecorative || undefined}
      style={containerStyle}
      className={className}
    >
      {content}
    </span>
  );

  if (status === "error" || !emoji) {
    return fallback === undefined || fallback === null ? null : renderFallback(fallback);
  }

  const source = getSpriteUrl(emoji, skinTone);
  if (failedSource === source) {
    if (fallback === null) return null;
    if (fallback !== undefined) return renderFallback(fallback);
    if (!emoji.unicode) return null;
    return renderFallback(
      <span
        role="img"
        aria-label={alt ?? emoji.description}
        style={{
          fontSize: typeof size === "number" ? `${String(size * 0.75)}px` : `calc(${size} * 0.75)`,
          lineHeight: cssSize,
        }}
      >
        {emoji.unicode}
      </span>,
    );
  }

  const containerClassName = isInitialAnimationComplete && playOnHover ? styles.animateOnHover : "";

  return (
    <span
      {...spanProps}
      ref={ref}
      aria-hidden={isDecorative || undefined}
      style={containerStyle}
      className={[className, containerClassName].filter(Boolean).join(" ") || undefined}
    >
      <img
        ref={imageRef}
        alt={alt ?? emoji.description}
        loading="lazy"
        decoding="async"
        draggable="false"
        src={source}
        srcSet={getSpriteSourceSet(emoji, skinTone)}
        sizes={typeof size === "number" ? cssSize : undefined}
        style={animationStyle}
        className={styles.emojiImage}
        onLoad={onLoad}
        onError={(event) => {
          setFailedSource(source);
          onError?.(event);
        }}
      />
    </span>
  );
};

// eslint-disable-next-line @eslint-react/no-forward-ref -- React 18 is a supported peer, where ref is not a prop
const ForwardedEmoji: ForwardRefExoticComponent<EmojiProps & RefAttributes<HTMLSpanElement>> =
  forwardRef(EmojiComponent);
ForwardedEmoji.displayName = "Emoji";

type EmojiComponentType = (<Id extends string = string>(
  props: EmojiProps<Id> & RefAttributes<HTMLSpanElement>,
) => ReactElement | null) &
  Pick<typeof ForwardedEmoji, "displayName">;

/**
 * Emoji component for displaying animated emojis. Other props, including
 * `className`, `style` and `data-*`, are passed to the root span; `style` is applied
 * after the sizing styles and wins over them.
 * @param props - The properties for the Emoji component.
 * @param props.id - The unique identifier of the emoji.
 * @param props.size - The size of the emoji. A number is in pixels: fractions are rounded and anything but a finite positive number falls back to 100. A string is any CSS length, such as `2rem` or `var(--size)`, passed to CSS as-is. A numeric string is read as pixels without rounding; a non-positive one falls back to 100.
 * @param props.playOnHover - Whether to play the animation on hover.
 * @param props.animationIterations - How many times to play the animation, or 'infinite'.
 * @param props.autoPlay - Whether to automatically play the animation on mount.
 * @param props.playing - Controls playback. Left undefined, `autoPlay` and reduced motion apply as usual. `true` plays `animationIterations` runs, overriding both, once the image has loaded, the emoji is on screen and while the document is visible; `false` pauses on the current frame. A finished run is not restarted by toggling; remount the emoji with a new `key` to play it again.
 * @param props.onPlaybackEnd - Called once when a finite run of `animationIterations` ends. Never called for `'infinite'` or when the emoji unmounts mid-run.
 * @param props.skinTone - The skin tone, for emojis that support it.
 * @param props.alt - Accessible text, defaults to the emoji description. An empty string marks the emoji as decorative.
 * @param props.fallback - Rendered when the image or the manifest fails, or the id is unknown. Defaults to the emoji's Unicode glyph when known; `null` renders nothing.
 * @param props.onLoad - Called when the image loads.
 * @param props.onError - Called when the image fails, and without an event when the manifest fails.
 * @param ref - Forwarded to the root span.
 * @returns The emoji, an empty placeholder of the final size while the manifest loads, or null if the manifest failed to load or the emoji is not found, unless a fallback is given.
 */
export const Emoji: EmojiComponentType = ForwardedEmoji as EmojiComponentType;
