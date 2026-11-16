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
      "the ESLint `create` entry is only called when ESLint loads the rule, and the tests drive the rule through the Oxlint rule tester",
    lines: 16 / 18,
    functions: 3 / 4,
  },
  {
    file: "oxlint-plugins/with-types.mjs",
    reason:
      "the unreadable tsconfig and missing TypeScript node guards throw only on a corrupt project that no fixture builds",
    lines: 87 / 89,
    functions: 22 / 23,
  },
  {
    file: "scripts/lint-commits.ts",
    reason:
      "the `import.meta.url` entry guard runs only when the file is executed as a script, never under Vitest",
    lines: 24 / 28,
    functions: 9 / 9,
  },
  {
    file: "scripts/lint-docs.ts",
    reason:
      "the `import.meta.url` entry guard runs only when the file is executed as a script, never under Vitest",
    lines: 71 / 75,
    functions: 15 / 15,
  },
  {
    file: "scripts/lint-parity/diff.ts",
    reason:
      "the stale-entry and harness-problem report lines need a parity run that fails, which the fixtures never produce",
    lines: 61 / 63,
    functions: 27 / 27,
  },
  {
    file: "scripts/lint-parity/harness.ts",
    reason:
      "the cleanup-and-rethrow path and one report line need a harness crash that no test provokes",
    lines: 69 / 72,
    functions: 39 / 40,
  },
  {
    file: "scripts/lint-parity/run.ts",
    reason:
      "process entry that spawns Oxlint and ESLint over the parity fixtures; the harness it drives is unit tested directly",
    lines: 0,
    functions: 0,
  },
  {
    file: "scripts/repo-settings/check.ts",
    reason:
      "the default `gh` runner and its dependency factory shell out to the GitHub CLI; the tests inject fakes instead",
    lines: 15 / 23,
    functions: 3 / 6,
  },
  {
    file: "packages/animated-fluent-emojis/src/hooks/use-prefers-reduced-motion.ts",
    reason:
      "the server snapshot callback runs only during server rendering, which the browser tests never do",
    lines: 4 / 4,
    functions: 1 / 2,
  },
  {
    file: "packages/animated-fluent-emojis/src/svelte/FallbackHost.svelte",
    reason:
      "the snippet host is mounted only on the Svelte fallback path that the current browser tests do not reach",
    lines: 0,
    functions: 1 / 1,
  },
  {
    file: "packages/animated-fluent-emojis/src/utils/is-development.ts",
    reason:
      "the `catch` branch runs only where `process` is undefined, and Node and the browser project both define it",
    lines: 2 / 3,
    functions: 1 / 1,
  },
  {
    file: "apps/site/src/content.config.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 1,
  },
  {
    file: "apps/site/src/components/CodeBlock.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 26 / 40,
    functions: 8 / 12,
  },
  {
    file: "apps/site/src/components/CopyBurst.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 16 / 20,
    functions: 6 / 9,
  },
  {
    file: "apps/site/src/components/HeaderMenus.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/InstallBlock.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 4 / 6,
    functions: 2 / 5,
  },
  {
    file: "apps/site/src/components/gallery/ChipGroup.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 3 / 5,
    functions: 2 / 4,
  },
  {
    file: "apps/site/src/components/gallery/CopySnippetButton.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 8 / 16,
    functions: 3 / 7,
  },
  {
    file: "apps/site/src/components/gallery/EmojiDetail.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 34 / 43,
    functions: 10 / 18,
  },
  {
    file: "apps/site/src/components/gallery/EmojiPageDetail.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 21 / 32,
    functions: 7 / 14,
  },
  {
    file: "apps/site/src/components/gallery/EmojiSheet.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 18 / 39,
    functions: 3 / 15,
  },
  {
    file: "apps/site/src/components/gallery/FileActionButton.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 14 / 24,
    functions: 5 / 10,
  },
  {
    file: "apps/site/src/components/gallery/Gallery.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/gallery/GallerySidebar.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/gallery/SegmentedControl.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/gallery/StageToolbar.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 12 / 18,
    functions: 5 / 9,
  },
  {
    file: "apps/site/src/components/gallery/StatusToast.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 7 / 15,
    functions: 2 / 6,
  },
  {
    file: "apps/site/src/components/gallery/use-gallery-data.ts",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/ui/dropdown-menu.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 14 / 26,
    functions: 3 / 10,
  },
  {
    file: "apps/site/src/components/ui/input.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/ui/sheet.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 1 / 7,
    functions: 0,
  },
  {
    file: "apps/site/src/docs/code-focus.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/docs/i18n-status.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 1,
  },
  {
    file: "apps/site/src/docs/install-block-client.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/docs/loader.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/docs/route-metadata.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/docs/search-trusted-types.ts",
    reason: "a small error-path or fallback branch that no current unit test triggers",
    lines: 6 / 7,
    functions: 2 / 3,
  },
  {
    file: "apps/site/src/emoji-pages/data.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/emoji-pages/fetch-png.ts",
    reason: "a small error-path or fallback branch that no current unit test triggers",
    lines: 9 / 10,
    functions: 2 / 2,
  },
  {
    file: "apps/site/src/highlight/snippet-render.ts",
    reason: "a small error-path or fallback branch that no current unit test triggers",
    lines: 28 / 29,
    functions: 11 / 11,
  },
  {
    file: "apps/site/src/home/DemoPlayground.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 31 / 45,
    functions: 18 / 35,
  },
  {
    file: "apps/site/src/home/DockInstall.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 6 / 8,
    functions: 2 / 4,
  },
  {
    file: "apps/site/src/home/InstallCard.tsx",
    reason:
      "React island whose interaction paths are driven by the Playwright e2e suite rather than the Vitest unit tests",
    lines: 7 / 8,
    functions: 2 / 4,
  },
  {
    file: "apps/site/src/home/sections/styles.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 1,
  },
  {
    file: "apps/site/src/pages/[...slug].md.ts",
    reason:
      "Astro endpoint module that only the Astro build evaluates; the build-output and SEO tests run that build in a child process, so v8 never sees these lines",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/pages/og-site.png.ts",
    reason:
      "Astro endpoint module that only the Astro build evaluates; the build-output and SEO tests run that build in a child process, so v8 never sees these lines",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/pages/robots.txt.ts",
    reason:
      "Astro endpoint module that only the Astro build evaluates; the build-output and SEO tests run that build in a child process, so v8 never sees these lines",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/pages/sitemap.xml.ts",
    reason:
      "Astro endpoint module that only the Astro build evaluates; the build-output and SEO tests run that build in a child process, so v8 never sees these lines",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/pages/.well-known/security.txt.ts",
    reason:
      "Astro endpoint module that only the Astro build evaluates; the build-output and SEO tests run that build in a child process, so v8 never sees these lines",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/pages/og/[slug].png.ts",
    reason:
      "Astro endpoint module that only the Astro build evaluates; the build-output and SEO tests run that build in a child process, so v8 never sees these lines",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/pages/search-index/[locale].json.ts",
    reason:
      "Astro endpoint module that only the Astro build evaluates; the build-output and SEO tests run that build in a child process, so v8 never sees these lines",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/scripts/interaction-directive.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/scripts/interaction-integration.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/scripts/render-security-headers.ts",
    reason:
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/assets/sync.ts",
    reason:
      "the default dependency factory and the `import.meta.url` entry guard run only from the CLI, and the AggregateError formatter has no failing-sync test",
    lines: 125 / 132,
    functions: 20 / 21,
  },
  {
    file: "apps/assets/teams.ts",
    reason:
      "the empty-bundle warning and the manifest probe failure path need a live Teams response that the fixtures do not model",
    lines: 55 / 57,
    functions: 13 / 13,
  },
];
