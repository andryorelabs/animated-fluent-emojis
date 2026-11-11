import { expect, test } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

test("rendering on the server yields the sized placeholder with no DOM access", async () => {
  expect(typeof document).toBe("undefined");
  expect(typeof window).toBe("undefined");
  const { Emoji } = await import("../vue/index.js");

  const html = await renderToString(
    createSSRApp({
      render: () => h(Emoji, { id: "cat", size: 64, class: "hero" }),
    }),
  );

  expect(html).toContain("<span");
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("width:64px");
  expect(html).toContain("height:64px");
  expect(html).toContain('class="hero"');
  expect(html).not.toContain("<img");
});

test("a CSS length size is rendered as given", async () => {
  const { Emoji } = await import("../vue/index.js");

  const html = await renderToString(
    createSSRApp({ render: () => h(Emoji, { id: "cat", size: "2rem" }) }),
  );

  expect(html).toContain("width:2rem");
});
