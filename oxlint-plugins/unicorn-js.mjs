import unicorn from "eslint-plugin-unicorn";

import { withTypesPlugin } from "./with-types.mjs";

/**
 * `eslint-plugin-unicorn`'s original rules for Oxlint's `unicorn-js` alias.
 * Many unicorn rules change their verdict when TypeScript parser services
 * exist (e.g. `prefer-combined-guards` compares narrowed types), and
 * ESLint lints `.ts`/`.tsx` with types, so they run with types there and
 * without types on JavaScript files, as under ESLint.
 */
const unicornJsPlugin = withTypesPlugin(unicorn, "unicorn-js", {
  requireTypes: false,
});

export default unicornJsPlugin;
