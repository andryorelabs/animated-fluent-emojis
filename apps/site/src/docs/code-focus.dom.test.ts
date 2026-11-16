import { afterEach, expect, test } from "vitest";

import { makeCodeFocusable } from "./code-focus";

afterEach(() => {
  document.body.replaceChildren();
});

test("every expressive-code pre gets a tab stop and other pre blocks are untouched", () => {
  document.body.innerHTML = `
    <div class="expressive-code"><pre id="a"></pre></div>
    <div class="expressive-code"><pre id="b"></pre></div>
    <pre id="plain"></pre>`;

  makeCodeFocusable();

  expect(document.querySelector("#a")?.getAttribute("tabindex")).toBe("0");
  expect(document.querySelector("#b")?.getAttribute("tabindex")).toBe("0");
  expect(document.querySelector("#plain")?.hasAttribute("tabindex")).toBe(false);
});
