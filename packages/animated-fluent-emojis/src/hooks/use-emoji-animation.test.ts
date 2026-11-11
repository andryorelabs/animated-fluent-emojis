import { expect, test } from "vitest";
import { renderHook } from "vitest-browser-react";

import type { EmojiManifest } from "../utils/index.js";
import { useEmojiAnimation } from "./use-emoji-animation.js";

const emoji: EmojiManifest = {
  id: "grinning-face",
  description: "Grinning face",
  etag: "etag-grin",
  unicode: "😀",
  diverse: false,
  hd: false,
  animation: { fps: 20, framesCount: 40, firstFrame: 2 },
  category: "Smilies",
};

test("returns an empty style while the emoji is not loaded", async () => {
  const { result } = await renderHook(() => useEmojiAnimation(null, false, 2, true, 64));

  expect(result.current.animationStyle).toEqual({});
});

test("derives timing and a percentage poster offset from the manifest entry", async () => {
  const { result } = await renderHook(() => useEmojiAnimation(emoji, false, 3, true, 64));

  expect(result.current.animationStyle).toMatchObject({
    width: 64,
    animationDuration: "2s",
    animationTimingFunction: "steps(40)",
    animationIterationCount: 3,
    transform: "translateY(-2.5%)",
  });
  expect(result.current.animationStyle.animationName).toBe("none");
});

test("holds autoplay paused until the image has loaded and is on screen", async () => {
  const { result } = await renderHook(() => useEmojiAnimation(emoji, false, "infinite", true, 64));

  expect(result.current.animationStyle.animationPlayState).toBe("paused");
});

test("disables the animation when autoPlay is off", async () => {
  const { result } = await renderHook(() => useEmojiAnimation(emoji, false, 2, false, 64));

  expect(result.current.isInitialAnimationComplete).toBe(true);
  expect(result.current.animationStyle).toMatchObject({
    animationName: "none",
    animationPlayState: "paused",
  });
});

test("loops forever once the initial animation is skipped for hover playback", async () => {
  const { result } = await renderHook(() => useEmojiAnimation(emoji, true, 2, false, 64));

  expect(result.current.animationStyle).toMatchObject({
    animationIterationCount: "infinite",
    animationPlayState: "running",
  });
  expect(result.current.animationStyle.animationName).toBeUndefined();
});

test.each([
  [Infinity, "infinite"],
  [-1, 0],
  [NaN, 0],
] as const)("normalizes %s iterations to %s", async (input, expected) => {
  const { result } = await renderHook(() => useEmojiAnimation(emoji, false, input, true, 64));

  expect(result.current.animationStyle.animationIterationCount).toBe(expected);
});

test("switches to hover-only playback when iterations resolve to 0", async () => {
  const { result } = await renderHook(() => useEmojiAnimation(emoji, true, 0, true, 64));

  expect(result.current.isInitialAnimationComplete).toBe(true);
  expect(result.current.animationStyle.animationIterationCount).toBe("infinite");
});

test("playing overrides a disabled autoPlay", async () => {
  const { result } = await renderHook(() =>
    useEmojiAnimation(emoji, false, 2, false, 64, undefined, false, {
      playing: true,
    }),
  );

  expect(result.current.isInitialAnimationComplete).toBe(false);
});

test("playing false keeps the run pending and paused", async () => {
  const { result } = await renderHook(() =>
    useEmojiAnimation(emoji, false, 2, true, 64, undefined, false, {
      playing: false,
    }),
  );

  expect(result.current.isInitialAnimationComplete).toBe(false);
  expect(result.current.animationStyle.animationPlayState).toBe("paused");
});

test("a zero iteration count never starts a run even when playing", async () => {
  const { result } = await renderHook(() =>
    useEmojiAnimation(emoji, false, 0, true, 64, undefined, false, {
      playing: true,
    }),
  );

  expect(result.current.isInitialAnimationComplete).toBe(true);
});

test("accepts a percentage width for CSS length sizes", async () => {
  const { result } = await renderHook(() => useEmojiAnimation(emoji, false, 2, true, "100%"));

  expect(result.current.animationStyle.width).toBe("100%");
});
