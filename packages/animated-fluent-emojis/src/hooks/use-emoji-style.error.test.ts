import { expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { configureEmojis } from "../utils/index.js";
import { useEmojiStyle } from "./use-emoji-style.js";

test("reports an error status when the manifest fails to load", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 500 })));
  configureEmojis({ assetSiteUrl: "https://hook-error.test" });

  const { result } = await renderHook(() => useEmojiStyle("cat"));

  await expect.poll(() => result.current.status).toBe("error");
  expect(result.current.emoji).toBeNull();
  vi.unstubAllGlobals();
  errorSpy.mockRestore();
});
