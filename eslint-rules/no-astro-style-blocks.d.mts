import type { Rule } from "eslint";

/**
 * Type declaration for `./no-astro-style-blocks.mjs`, needed because this
 * module is imported from `no-astro-style-blocks.test.ts` and TypeScript
 * cannot infer types across a `.ts` -> `.mjs` import without one.
 */
declare const rule: Rule.RuleModule;

export default rule;
