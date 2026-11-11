import { expect, test } from "vitest";

import {
  buildFallbackHtml,
  buildReadyHtml,
  escapeHtml,
  toStyleText,
  type EmojiRuntimeConfig,
} from "./markup.js";

const config: EmojiRuntimeConfig = {
  playOnHover: false,
  animationIterations: 2,
  autoPlay: true,
  size: 48,
  animation: { framesCount: 20, fps: 10, firstFrame: 1 },
  label: "Cat",
};

const root = {
  size: 48,
  alt: undefined,
  className: "mine",
  style: "color:red",
  config,
};

test("toStyleText kebab-cases names and reads a numeric width as pixels", () => {
  expect(toStyleText({ width: 10, animationName: "none", opacity: 0.5 })).toBe(
    "width:10px;animation-name:none;opacity:0.5",
  );
});

test("escapeHtml escapes markup and quotes", () => {
  expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("a ready emoji merges the class and style of the caller", () => {
  const html = buildReadyHtml(root, { source: "https://site.test/cat.png", alt: "Cat" }, "");

  expect(html).toContain('class="mine"');
  expect(html).toContain("overflow:hidden;color:red");
  expect(html).not.toContain("<template");
  expect(html).not.toContain("srcset");
});

test("a ready emoji escapes alt text and adds a srcset when given", () => {
  const html = buildReadyHtml(
    root,
    {
      source: "https://site.test/cat.png",
      sourceSet: "a.png 100w, b.png 200w",
      alt: '"><script>',
    },
    "",
  );

  expect(html).toContain('alt="&quot;&gt;&lt;script&gt;"');
  expect(html).toContain('srcset="a.png 100w, b.png 200w"');
});

test("play on hover with autoplay off starts with the hover class", () => {
  const html = buildReadyHtml(
    {
      ...root,
      className: undefined,
      config: { ...config, playOnHover: true, autoPlay: false },
    },
    { source: "https://site.test/cat.png", alt: "Cat" },
    "",
  );

  expect(html).toContain('class="afe-hover"');
});

test("a ready emoji sizes the image for numeric sizes and omits sizes otherwise", () => {
  const image = { source: "https://site.test/cat.png", alt: "Cat" };

  expect(buildReadyHtml(root, image, "")).toContain('sizes="48px"');
  expect(
    buildReadyHtml({ ...root, size: "100%", config: { ...config, size: "100%" } }, image, ""),
  ).not.toContain("sizes=");
});

test("a fallback with no content renders nothing", () => {
  expect(buildFallbackHtml(root, "")).toBe("");
  expect(buildFallbackHtml(root, "<i>x</i>")).toContain("<i>x</i>");
});
