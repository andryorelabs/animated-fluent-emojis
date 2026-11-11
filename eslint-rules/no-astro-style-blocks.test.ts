import * as astroParser from "astro-eslint-parser";
import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-astro-style-blocks.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: astroParser },
});

ruleTester.run("no-astro-style-blocks", rule, {
  valid: [
    {
      name: "markup without a style block",
      code: '---\nconst title = "Hi"\n---\n<h1 class="text-lg">{title}</h1>\n',
      filename: "Heading.astro",
    },
    {
      name: "a style attribute is not a style block",
      code: '<div style="--index: 1">x</div>\n',
      filename: "Item.astro",
    },
  ],
  invalid: [
    {
      name: "scoped style block",
      code: "<div>x</div>\n<style>\n  div { color: red; }\n</style>\n",
      filename: "Scoped.astro",
      errors: [{ messageId: "noStyleBlock" }],
    },
    {
      name: "global style block",
      code: "<div>x</div>\n<style is:global>\n  div { color: red; }\n</style>\n",
      filename: "Global.astro",
      errors: [{ messageId: "noStyleBlock" }],
    },
  ],
});
