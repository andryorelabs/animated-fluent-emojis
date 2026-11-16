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
      "build-time or browser-entry module that the Astro build, a CLI or the page script runs; no unit test imports it",
    lines: 0,
    functions: 1,
  },
  {
    file: "apps/site/src/components/CodeBlock.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 26 / 40,
    functions: 8 / 12,
  },
  {
    file: "apps/site/src/components/CopyBurst.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 16 / 20,
    functions: 6 / 9,
  },
  {
    file: "apps/site/src/components/HeaderMenus.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/InstallBlock.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 4 / 6,
    functions: 2 / 5,
  },
  {
    file: "apps/site/src/components/gallery/ChipGroup.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 3 / 5,
    functions: 2 / 4,
  },
  {
    file: "apps/site/src/components/gallery/CopySnippetButton.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 8 / 16,
    functions: 3 / 7,
  },
  {
    file: "apps/site/src/components/gallery/EmojiDetail.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 34 / 43,
    functions: 10 / 18,
  },
  {
    file: "apps/site/src/components/gallery/EmojiPageDetail.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 21 / 32,
    functions: 7 / 14,
  },
  {
    file: "apps/site/src/components/gallery/EmojiSheet.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 18 / 39,
    functions: 3 / 15,
  },
  {
    file: "apps/site/src/components/gallery/FileActionButton.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 14 / 24,
    functions: 5 / 10,
  },
  {
    file: "apps/site/src/components/gallery/Gallery.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/gallery/GallerySidebar.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/gallery/SegmentedControl.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/components/gallery/StageToolbar.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 12 / 18,
    functions: 5 / 9,
  },
  {
    file: "apps/site/src/components/gallery/StatusToast.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 7 / 15,
    functions: 2 / 6,
  },
  {
    file: "apps/site/src/components/gallery/use-gallery-data.ts",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 0,
    functions: 0,
  },
  {
    file: "apps/site/src/docs/code-focus.ts",
    reason:
      "browser-entry script run by the page; its happy-dom test is scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
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
      "browser-entry script run by the page; its happy-dom test is scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
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
    file: "apps/site/src/home/DemoPlayground.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 31 / 45,
    functions: 18 / 35,
  },
  {
    file: "apps/site/src/home/DockInstall.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 6 / 8,
    functions: 2 / 4,
  },
  {
    file: "apps/site/src/home/InstallCard.tsx",
    reason:
      "React island exercised by the Playwright e2e suite; its Vitest dom tests (*.dom.test.tsx) are scheduled in the batches F, G and H tickets (AO-3231, AO-3232, AO-3233)",
    lines: 7 / 8,
    functions: 2 / 4,
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
    file: "apps/assets/sync.ts",
    reason:
      "the `import.meta.url` entry guard runs only when the module is executed as a CLI entry",
    lines: 128 / 132,
    functions: 21 / 21,
  },
];
