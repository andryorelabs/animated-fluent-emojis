import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { FIXTURE_MANIFEST } from "../test/manifest-fixture.js";
import { configureEmojis } from "../utils/index.js";
import { renderEmojiHtml } from "./server.js";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => 0 as never);
  vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  configureEmojis({
    assetSiteUrl: `https://server-${crypto.randomUUID()}.test`,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("renders the sprite url, srcset and skin tone of a ready emoji", async () => {
  vi.stubGlobal("fetch", () => Promise.resolve(Response.json(FIXTURE_MANIFEST)));

  const html = await renderEmojiHtml({ id: "waving-hand", skinTone: "dark" }, "");

  expect(html).toMatch(/src="[^"]+waving-hand_s6\.etag-wave\.png"/);
  expect(html).toContain("@2x.png 200w");
});

test("a missing id warns once per id and renders the fallback", async () => {
  vi.stubGlobal("fetch", () => Promise.resolve(Response.json(FIXTURE_MANIFEST)));

  const first = await renderEmojiHtml({ id: "nope" }, "<i>x</i>");
  await renderEmojiHtml({ id: "nope" }, "");

  expect(first).toContain("<i>x</i>");
  const unknownWarnings = vi
    .mocked(console.warn)
    .mock.calls.filter(([message]) => String(message).includes("Unknown emoji"));
  expect(unknownWarnings).toHaveLength(1);
});

test("a failed manifest renders the fallback, or nothing without one", async () => {
  vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 500 })));

  expect(await renderEmojiHtml({ id: "cat" }, "<i>x</i>")).toContain("<i>x</i>");
  expect(await renderEmojiHtml({ id: "cat" }, "")).toBe("");
});
