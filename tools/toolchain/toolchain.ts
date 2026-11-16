/**
 * The root `devDependencies` pins from the aokit toolchain version table
 * (`docs/standards/tooling.md`, rule E15, voted as V21). `typescript` is
 * resolved through the workspace catalog, so its pin is the catalog entry.
 */
export const DEV_DEPENDENCY_PINS: Readonly<Record<string, string>> = {
  oxlint: "1.93.0",
  "@oxlint/plugins": "1.93.0",
  oxfmt: "0.78.0",
  "oxlint-tsgolint": "7.0.2006",
  typescript7: "npm:typescript@7.1.0-beta",
  typescript: "npm:@typescript/typescript6@6.0.2",
  "@types/bun": "1.4.4",
};

/** The Bun release pinned in `packageManager` and `engines.bun`. */
export const BUN_VERSION = "1.4.4";

/** The Node.js major in `.node-version`. */
export const NODE_VERSION = "26";

/** The actionlint release installed by `.github/workflows/lint-workflows.yml`. */
export const ACTIONLINT_VERSION = "1.7.12";

/** The zizmor release run by `.github/workflows/lint-workflows.yml`. */
export const ZIZMOR_VERSION = "1.32.0";

/**
 * The `lycheeverse/lychee-action` pin in `.github/workflows/lint-docs.yml`,
 * mirrored by `EXPECTED_LYCHEE_ACTION_VERSION` in `scripts/lint-docs.ts`.
 */
export const LYCHEE_ACTION = {
  sha: "e7477775783ea5526144ba13e8db5eec57747ce8",
  version: "v2.9.0",
} as const;
