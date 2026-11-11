import tseslint from "typescript-eslint";

import { withTypesPlugin } from "./with-types.mjs";

/**
 * typescript-eslint's original rules for Oxlint's `typescript-js` alias, run
 * with TypeScript parser services. Used only where the tsgolint port reports
 * differently from typescript-eslint, so the ESLint verdict is kept.
 */
const typescriptJsPlugin = withTypesPlugin(tseslint.plugin, "typescript-js", {
  requireTypes: true,
});

export default typescriptJsPlugin;
