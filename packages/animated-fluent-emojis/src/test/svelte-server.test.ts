import { render } from "svelte/server";
import { expect, test } from "vitest";

import Emoji from "../svelte/Emoji.svelte";

test("server rendering outputs a sized, hidden placeholder with no DOM", () => {
  expect(typeof document).toBe("undefined");

  const { body } = render(Emoji, { props: { id: "grinning-face", size: 48 } });

  expect(body).toContain("width:48px");
  expect(body).toContain("height:48px");
  expect(body).toContain('aria-hidden="true"');
  expect(body).not.toContain("<img");
});

test("server rendering honours a CSS length size and the class", () => {
  const { body } = render(Emoji, {
    props: { id: "grinning-face", size: "2rem", class: "mine" },
  });

  expect(body).toContain("width:2rem");
  expect(body).toContain('class="mine"');
});

test("server rendering defaults the placeholder to 100px", () => {
  const { body } = render(Emoji, { props: { id: "grinning-face" } });

  expect(body).toContain("width:100px");
});
