import { expect, test } from "vitest";
import { renderHook } from "vitest-browser-react";

import { useEmojiStyle } from "./use-emoji-style.js";

test("resolves the manifest entry for a known id", async () => {
  const { result } = await renderHook(() => useEmojiStyle("cat"));

  await expect.poll(() => result.current.emoji?.id).toBe("cat");
  expect(result.current.status).toBe("ready");
});

test("reports a missing status for an unknown id", async () => {
  const { result } = await renderHook(() => useEmojiStyle("does-not-exist"));
  const { result: known } = await renderHook(() => useEmojiStyle("cat"));

  await expect.poll(() => known.current.emoji?.id).toBe("cat");
  await expect.poll(() => result.current.status).toBe("missing");
  expect(result.current.emoji).toBeNull();
});

test("follows the id when it changes", async () => {
  let currentId = "cat";
  const { result, rerender } = await renderHook(() => useEmojiStyle(currentId));
  await expect.poll(() => result.current.emoji?.id).toBe("cat");

  currentId = "grinning-face";
  await rerender();

  await expect.poll(() => result.current.emoji?.id).toBe("grinning-face");
});
