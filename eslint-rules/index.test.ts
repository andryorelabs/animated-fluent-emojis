import { expect, test } from "vitest";

import localPlugin from "./index.mjs";
import noAstroStyleBlocks from "./no-astro-style-blocks.mjs";
import rule from "./no-non-doc-comments.mjs";

test("the local plugin registers the no-non-doc-comments rule", () => {
  expect(localPlugin.rules["no-non-doc-comments"]).toBe(rule);
});

test("the local plugin registers the no-astro-style-blocks rule", () => {
  expect(localPlugin.rules["no-astro-style-blocks"]).toBe(noAstroStyleBlocks);
});
