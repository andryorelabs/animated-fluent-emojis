# AGENTS.md

Instructions for coding agents working in this repository.

## Layout

A bun-workspaces monorepo ([ADR 0016](docs/adr/0016-bun-workspaces-monorepo.md))
orchestrated by Turborepo. TypeScript (strict), ESM-only, managed with bun. The
root holds tooling only:

- [`packages/animated-fluent-emojis`](packages/animated-fluent-emojis/AGENTS.md):
  the published component library, with adapters for React, Vue, Svelte, Astro
  and a `<fluent-emoji>` element. Built with Vite 8 library mode, tested with
  Vitest Browser Mode.
- [`apps/assets`](apps/assets/AGENTS.md): the private asset pipeline.
- [`apps/site`](apps/site/AGENTS.md): the private static website (Astro,
  Starlight, Tailwind).

The code map is [`docs/architecture.md`](docs/architecture.md). Skills stay in
the root `.claude/skills`.

## Running scripts

Always use `bun run <script>` — never call the underlying tool directly, and
never use another package manager (this repo uses `bun.lock`). Read
`package.json`'s `scripts` before inventing a command.

- `bun run check` — Oxfmt check, lint (Oxlint, plus ESLint on `.astro` only),
  typecheck (TypeScript 7.1 through `typescript7`), knip and package lint. Run
  this after any change.
- `bun run test` — the Vitest suite. Run this after any change.
- `bun run brand:export` — regenerates the brand rasters. Run it after changing
  a logo SVG or the export copy; never edit the generated rasters by hand.
- `bun run build` — **do not run unless explicitly asked.** It is slow; `check`
  already builds once through `lint:package`.

## Architecture decision records

A new ADR must add its row to [`docs/adr/README.md`](docs/adr/README.md);
`docs/adr/adr-invariants.test.ts` fails when an ADR is missing from the index.
ADRs are living documents: edit one in place to keep it true and add a
`Revised: YYYY-MM-DD, what changed` line under its `Date:`. A reversed or
replaced decision gets a new ADR.

## Branch and commit conventions

Branches are `<type>/<slug>`. Commits and PR titles are
`type: emoji lowercase subject`, for example `feat: ✨ add confetti emoji`.
Detail:
[`docs/development.md#branch-naming`](docs/development.md#branch-naming),
[`docs/development.md#commit-format`](docs/development.md#commit-format).

## Code comments

Every code comment is a TSDoc block on a non-obvious export. No `//` or
non-JSDoc `/* */` comments, except lint or type directives. Detail:
[`docs/development.md#code-documentation`](docs/development.md#code-documentation),
[ADR 0002](docs/adr/0002-tsdoc-only-code-comments.md).

## Escalating a `@shadcn/lint` finding

When `bun run lint` reports a `shadcn/*` finding (e.g. `shadcn/no-restyle`) on a
site component you're changing (Oxlint for `ts` and `tsx`, ESLint for `.astro`),
work up this ladder — never disable the rule file-wide or project-wide:

1. Use an existing variant in `apps/site/src/components/ui` that already covers
   the styling you need
   ([ADR 0019](docs/adr/0019-shadcn-on-base-ui-for-the-website.md)).
2. Add a new variant to the component if no existing one fits.
3. Add or change a `no-restyle` contract in `shadcnNoRestyleContracts`
   (`lint-policy.mjs`, shared by `oxlint.config.ts` and `eslint.config.mjs`),
   encoding one real, bounded design decision. Detail:
   [`docs/development.md#adding-a-shadcnlint-contract`](docs/development.md#adding-a-shadcnlint-contract).
4. Last resort: a single-line `oxlint-disable-next-line -- <reason>` (or
   `eslint-disable-next-line` in `.astro`) on the exact offending line. Never a
   file-level or project-level disable.

## Quirks and gotchas

- Library rules (test projects and Playwright, MSW manifest mocking, ESM-only,
  `style.css`, and the coverage manifest requirement for new modules) live in
  [`packages/animated-fluent-emojis/AGENTS.md`](packages/animated-fluent-emojis/AGENTS.md).
- The coverage manifest is `scripts/coverage-manifest.test.ts`, with one
  exemption list keyed by repo-relative paths.
- The asset pipeline lives in `apps/assets`, with its own rules:
  [`apps/assets/AGENTS.md`](apps/assets/AGENTS.md).
- Actions are SHA-pinned and workflows are linted; edit them with care:
  [`docs/development.md#ci`](docs/development.md#ci).
- Repository settings live in `.github/rulesets` and `docs/brand/apply-spec.md`
  and are applied by hand; `bun run repo-settings:check` reports drift:
  [`docs/development.md#repository-settings`](docs/development.md#repository-settings).
- Releases are tag-driven with npm OIDC; never run `npm publish` locally:
  [`docs/how-to/cut-a-release.md`](docs/how-to/cut-a-release.md).
