import type { RuleTester } from "oxlint/plugins-dev";

/** A rule as Oxlint's `RuleTester.run` accepts it. */
type OxlintRule = Parameters<RuleTester["run"]>[1];

/**
 * Type declaration for `./with-types.mjs`, needed because this module is
 * imported from `with-types.test.ts` and TypeScript cannot infer types across
 * a `.ts` -> `.mjs` import without one.
 */
export declare function withTypes(rule: object, options: { requireTypes: boolean }): OxlintRule;

export declare function withTypesPlugin(
  plugin: { rules: Record<string, object> },
  name: string,
  options: { requireTypes: boolean },
): { meta: { name: string }; rules: Record<string, OxlintRule> };
