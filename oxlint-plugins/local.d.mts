import type { RuleTester } from "oxlint/plugins-dev";

/** A rule as Oxlint's `RuleTester.run` accepts it. */
type OxlintRule = Parameters<RuleTester["run"]>[1];

/**
 * Type declaration for `./local.mjs`, needed because this module is imported
 * from `local.test.ts` and TypeScript cannot infer types across a
 * `.ts` -> `.mjs` import without one.
 */
declare const localPlugin: {
  meta: { name: string };
  rules: Record<string, OxlintRule> & {
    "no-unawaited-async-matcher": OxlintRule;
    "no-bun-test-only": OxlintRule;
  };
};

export default localPlugin;
