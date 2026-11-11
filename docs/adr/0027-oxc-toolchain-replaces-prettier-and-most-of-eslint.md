# 0027: Oxc toolchain replaces Prettier and most of ESLint

## Status

Accepted. Partly supersedes [0002](0002-tsdoc-only-code-comments.md),
[0019](0019-shadcn-on-base-ui-for-the-website.md) and
[0023](0023-practices-parity-with-snug.md).

Date: 2026-11-02
Revised: 2026-11-11, dropped the Oxfmt style overrides (semicolons off, single quotes, width 80, prose wrap always) in favor of the Oxfmt defaults (standard v1 rule E8).

## Context

`bun run lint` ran ESLint with typescript-eslint `strictTypeChecked` (about 590
resolved rules on TypeScript files) and took 50-58 s. Prettier `--check` took
14.5 s and the TypeScript 6 typecheck about 10 s. Agents and CI waited on all
three. The same migration was done in Snug and andryore-web, so a shared
approach also serves [practices parity](0023-practices-parity-with-snug.md).

The constraint was to stop running ESLint on everything except `.astro`
templates without losing or loosening a single rule the repository enforces.

## Decision

- **Oxfmt replaces Prettier.** `.oxfmtrc.json` reproduces the Prettier options,
  Tailwind class sorting (`./apps/site/src/styles/global.css`, `cn`, `cva`,
  `clsx`), `astro` formatting and import sorting (`sortImports`, with a group
  for `astro`, `astro/**` and `astro:*`). The formatted file set is unchanged,
  so `**/*.html` is still not formatted. One `style:` commit reformatted about
  31 files and is listed in `.git-blame-ignore-revs`.
- **Oxlint replaces ESLint on `ts`, `tsx` and `mjs`.** `oxlint.config.ts`
  enforces every rule the old config did, with the same options and severity:
  native rules, tsgolint (`--type-aware`) for the typed ones, and jsPlugins for
  rules without a native port or whose native port diverges (`unicorn-js/*`,
  `jsdoc-js/*`, `react-hooks-js/*`, `vitest-js/*`, `typescript-js/*`). The
  original `@eslint-react/no-leaked-conditional-rendering` runs through a local
  shim (`oxlint-plugins/typed-react.mjs`) that hands the rule a TypeScript 6
  `Program` as parser services.
- **A minimal ESLint stays for `**/*.astro` only**, because Oxlint cannot see
  `.astro` templates (oxc#23207). It runs `eslint-plugin-astro`, jsx-a11y,
  unicorn, `@shadcn/lint` on `apps/site/**`, `local/no-non-doc-comments`,
  `local/no-astro-style-blocks` and eslint-comments. On the `<script>` blocks of
  `.astro` files, which Oxlint never sees, it also keeps the TypeScript, React,
  hooks and jsdoc rule sets the old config ran there, so no rule is loosened.
  Nothing else runs in it.
- **TypeScript 7.1 runs `tsc`** through the exact alias `typescript7`
  (`npm:typescript@7.1.0-beta`). `typescript` stays on 6.x because
  `vite-plugin-dts`, `@astrojs/check`, typescript-eslint, `astro-eslint-parser`
  and the shim need the classic JS API. Under bun, `node_modules/.bin/tsc`
  resolves to the 6.x bin, so scripts call `node_modules/typescript7/bin/tsc`
  explicitly and `scripts/typescript-alias/version.test.ts` asserts it.
- **`astro check` stays on TypeScript 6.** A probe replaced it with `tsc` 7.1
  plus `@astrojs/ts-content-mapper` (astro 7.4.4). It caught every seeded error
  class (frontmatter, template expression, content collection and bad props) but
  added 10 false errors from unresolved `virtual:starlight/*` and
  `virtual:astro-expressive-code/*` modules. Filtering by path would hide real
  errors in components that wrap those files, so the replacement was rejected.
- **The golden rule: no rule is disabled, downgraded or narrowed to make Oxlint
  pass.** Fix the code, or swap a diverging native port for the original
  ESLint-engine rule through a jsPlugin. A rule Oxlint cannot run is enforced by
  the `.astro` ESLint pass or the shim, never dropped.
- **A differential parity gate** (`bun scripts/lint-parity/run.ts`) compares the
  frozen full ESLint config with Oxlint plus the minimal ESLint per
  `(file, line, rule)` over violation fixtures, this repository and an external
  TypeScript and React corpus. The gate is zero unexplained ESLint-only
  findings. A gap that cannot be closed is reported and decided by the
  maintainer; it is never auto-accepted (`accepted.json` stays empty). The
  result is in the [parity report](../../scripts/lint-parity/report.md).
- **Policy lives in one module.** `lint-policy.mjs` holds
  `shadcnNoRestyleContracts`, `shadcnAllowedInlineProperties` and
  `shadcnAllowedUnknownClasses`; both configs import it.
- **Versions are exact-pinned** (`oxlint`, `oxfmt`, `oxlint-tsgolint`,
  `typescript7`) in a Renovate group named `oxc` with no automerge. A bump can
  change lint or format output repository-wide, so each one is reviewed by hand.
  The `eslint` group covers only what remains.

### Measured

| Step      | Before                     | After                               |
| --------- | -------------------------- | ----------------------------------- |
| Lint      | ESLint, 50-58 s            | Oxlint type-aware, about 8 s + shim |
| Format    | Prettier `--check`, 14.5 s | Oxfmt, 1.8 s                        |
| Typecheck | TypeScript 6, about 10 s   | TypeScript 7, about 1.4 s           |

The shim adds about 10 s because it builds a TypeScript 6 `Program` per
tsconfig.

### Rejected alternatives

- **Keep ESLint and Prettier**: nothing is lost, but every gate stays an order
  of magnitude slower.
- **Oxlint only, dropping `.astro` linting**: loses the `shadcn/*`, a11y and
  `no-non-doc-comments` checks on templates.
- **Accept diverging native ports**: shortest path, but it narrows rules, which
  the golden rule forbids.
- **Replace `astro check` with `tsc` 7.1**: see the probe above.

## Consequences

- Day-to-day gates are far faster. `bun run check` and the pre-commit hook wait
  on Oxlint and Oxfmt instead of ESLint and Prettier.
- Two linters run side by side: Oxlint for code, ESLint for `.astro`. A lint
  directive must name the linter that runs the rule, and a rule moved to a
  jsPlugin uses its alias (`unicorn-js/x`, not `unicorn/x`).
- The shim reaches into typescript-eslint-style parser services through a
  `Proxy`, relies on an alpha Oxlint jsPlugin API and costs about 10 s per run.
  An Oxlint bump can break it. It has `RuleTester` coverage and a parity fixture
  to catch that. A file no tsconfig covers fails lint loudly instead of being
  skipped.
- Eight ESLint-only findings remain in the parity report. None is a missing
  rule: all come from how Oxlint scopes directive comments (an unlimited
  `eslint-disable` also suppresses jsPlugin reports on its own line, and some
  unused-directive ranges land on a different line). They are recorded, not
  accepted, and wait on the maintainer's decision.
- Two TypeScript versions are installed. `typescript` must stay 6.x while any
  tool needs the classic API, and `astro check` stays on it.
- Editor and tsserver behaviour on TypeScript 7 is out of scope.
- The ESLint and Prettier parts of [0002](0002-tsdoc-only-code-comments.md),
  [0019](0019-shadcn-on-base-ui-for-the-website.md) and
  [0023](0023-practices-parity-with-snug.md) are replaced by this decision.
  Their decisions (TSDoc-only comments, shadcn on Base UI, practices parity)
  still stand.
