import eslintReact from "@eslint-react/eslint-plugin";

import { withTypes } from "./with-types.mjs";

/**
 * Oxlint-only plugin running `@eslint-react/no-leaked-conditional-rendering`,
 * which needs TypeScript types that Oxlint's JS plugins do not provide, as
 * `typed-react/no-leaked-conditional-rendering`. Files that no `tsconfig`
 * covers are reported instead of skipped.
 */
const typedReactPlugin = {
  meta: { name: "typed-react" },
  rules: {
    "no-leaked-conditional-rendering": withTypes(
      eslintReact.rules["no-leaked-conditional-rendering"],
      { requireTypes: true },
    ),
  },
};

export default typedReactPlugin;
