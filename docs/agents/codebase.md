# Codebase map

Where things live. For the design behind them see [`architecture.md`](../architecture.md).

## Workspaces

A bun-workspaces monorepo orchestrated by Turborepo ([ADR 0016](../adr/0016-bun-workspaces-monorepo.md)).

| Workspace                                                                  | What it is                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`packages/animated-fluent-emojis`](../../packages/animated-fluent-emojis) | The published library: core, React, Vue, Svelte and Astro adapters, `<fluent-emoji>`. |
| [`apps/assets`](../../apps/assets)                                         | The private asset pipeline: sync, validate, sprites, manifests and the files site.    |
| [`apps/site`](../../apps/site)                                             | The private website: Astro, Starlight and Tailwind, in ten languages.                 |

## Entry points

- Library: `packages/animated-fluent-emojis/src`, built by `vite.config.ts` in library mode; the playground is in `playground/`.
- Asset pipeline: `apps/assets/sync.ts` and `build.ts`.
- Site: `apps/site/astro.config.ts`, with pages and sections under `apps/site/src`.

## Tests

- Library and asset pipeline: colocated `*.test.ts` files, run by Vitest (Browser Mode for the library).
- Site: unit tests beside the code, and Playwright suites in `apps/site/e2e` and `apps/site/e2e-visual`.
- Repository invariants: `scripts/*.test.ts` and `scripts/conventions/*.test.ts`. `scripts/standard-invariants.test.ts` covers retired names, public copy, the docs index and the skills lock; `scripts/conventions/environment-docs.test.ts` covers [`configuration.md`](../configuration.md).
- Architecture decisions: `docs/adr/adr-invariants.test.ts`.

## Scripts

- The root `package.json` scripts are the entry point: `bun run check` and `bun run test`.
- Repository tooling lives in `scripts/`: commit and docs linting, lint parity, repo settings, workflow rules and locks.

## Docs

[`docs/README.md`](../README.md) indexes every document. The brand kit is in `docs/brand`.
