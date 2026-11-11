import { expect, test } from "vitest";

import baselineConfig from "./eslint.baseline.config.mjs";

const localRuleNames = (): string[] =>
  baselineConfig
    .flatMap((block) => Object.keys(block.plugins?.local?.rules ?? {}))
    .toSorted((left, right) => left.localeCompare(right));

test("the baseline carries its own frozen copy of the local rules", () => {
  expect(localRuleNames()).toContain("no-non-doc-comments");
  expect(localRuleNames()).toContain("no-astro-style-blocks");
});

test("the baseline keeps the repo policy blocks the migration compares against", () => {
  const ruleIds = new Set(baselineConfig.flatMap((block) => Object.keys(block.rules ?? {})));
  for (const rule of [
    "unicorn/name-replacements",
    "unicorn/filename-case",
    "shadcn/no-restyle",
    "local/no-non-doc-comments",
    "@eslint-community/eslint-comments/require-description",
    "jsdoc/informative-docs",
  ]) {
    expect(ruleIds).toContain(rule);
  }
});
