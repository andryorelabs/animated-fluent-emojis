/**
 * A file that stays under the per-file coverage floor, with the reason and its own floor.
 * `lines` and `functions` are fractions set to the measured value; the gate fails when the file drops below them.
 */
export interface CoverageException {
  readonly file: string;
  readonly reason: string;
  readonly lines: number;
  readonly functions: number;
}

/**
 * Files allowed under the per-file floor of 97% lines and 98% functions.
 * Add a test instead of adding an entry; remove an entry as soon as its file meets the floor.
 */
export const COVERAGE_EXCEPTIONS: readonly CoverageException[] = [
  {
    file: "docs/brand/tools/export.mjs",
    reason:
      "CLI entry that drives a real browser to rasterise the brand assets; it runs through `bun run brand:export`, so no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "eslint-rules/no-non-doc-comments.mjs",
    reason:
      "its own test calls `create` directly and reaches 100% when run alone, but `scripts/lint-config.test.ts` also loads the rule through `oxlint.config`, and the merged root report then drops the `create` hits",
    lines: 16 / 18,
    functions: 3 / 4,
  },
  {
    file: "scripts/lint-parity/run.ts",
    reason:
      "process entry that spawns Oxlint and ESLint over the parity fixtures; the harness it drives is unit tested directly",
    lines: 0,
    functions: 0,
  },
  {
    file: "packages/animated-fluent-emojis/src/svelte/FallbackHost.svelte",
    reason:
      "the snippet host is mounted only on the Svelte fallback path that the current browser tests do not reach",
    lines: 0,
    functions: 1 / 1,
  },
  {
    file: "apps/site/src/content.config.ts",
    reason:
      "Astro build-time module evaluated only through astro.config.ts and content.config.ts during the site build, so no Vitest process imports it",
    lines: 0,
    functions: 1,
  },
  {
    file: "apps/site/src/docs/i18n-status.ts",
    reason:
      "Astro build-time module evaluated only through astro.config.ts and content.config.ts during the site build, so no Vitest process imports it",
    lines: 0,
    functions: 1,
  },
  {
    file: "apps/site/src/docs/loader.ts",
    reason:
      "Astro build-time module evaluated only through astro.config.ts and content.config.ts during the site build, so no Vitest process imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/docs/route-metadata.ts",
    reason:
      "Astro build-time module evaluated only through astro.config.ts and content.config.ts during the site build, so no Vitest process imports it",
    lines: 0,
    functions: 0,
  },
];
