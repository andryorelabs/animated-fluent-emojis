import type { RuleTester } from "oxlint/plugins-dev";

/** A rule as Oxlint's `RuleTester.run` accepts it. */
type OxlintRule = Parameters<RuleTester["run"]>[1];

/**
 * Type declaration for `./unicorn-js.mjs`, needed because this module is
 * imported from `with-types.test.ts` and TypeScript cannot infer types across
 * a `.ts` -> `.mjs` import without one.
 */
declare const unicornJsPlugin: {
  meta: { name: string };
  rules: Record<"prefer-combined-guards", OxlintRule> & Record<string, OxlintRule>;
};

export default unicornJsPlugin;
