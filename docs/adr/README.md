# Architecture decision records

Decisions are recorded in
[Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
`# NNNN: Title`, then `## Status` with a `Date: YYYY-MM-DD` line, `## Context`,
`## Decision` (with the options that were rejected) and `## Consequences`.
`adr-invariants.test.ts` enforces the header format, unique ascending numbers,
`Revised:` lines, and that this index lists every ADR.

To add one, copy the next number, write the file, and add a row below. The rules
for editing and replacing ADRs are in
[`AGENTS.md`](../../AGENTS.md#architecture-decision-records).

| Number | Title                                                                                                                                                        | Status   | Superseded or amended by |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------ |
| 0001   | [Public repo security posture](0001-public-repo-security-posture.md)                                                                                         | Accepted | 0030                     |
| 0002   | [TSDoc-only code comments](0002-tsdoc-only-code-comments.md)                                                                                                 | Accepted | 0027 (partly)            |
| 0003   | [ESM-only and Vite 8](0003-esm-only-and-vite-8.md)                                                                                                           | Accepted | -                        |
| 0004   | [Vitest Browser Mode](0004-vitest-browser-mode.md)                                                                                                           | Accepted | 0008                     |
| 0005   | [npm trusted publishing](0005-npm-trusted-publishing.md)                                                                                                     | Accepted | -                        |
| 0006   | [Cloudflare Pages asset hosting](0006-cloudflare-pages-asset-hosting.md)                                                                                     | Accepted | 0007, 0009, 0010         |
| 0007   | [Pinned official emoji ids](0007-pinned-official-emoji-ids.md)                                                                                               | Accepted | -                        |
| 0008   | [Static sprite keyframes and a lazy slim manifest](0008-static-keyframes-and-lazy-slim-manifest.md)                                                          | Accepted | 0010                     |
| 0009   | [HD sprite sheets, content-hashed etags and strict validation](0009-hd-sprite-sheets-and-strict-validation.md)                                               | Accepted | 0011                     |
| 0010   | [Versioned asset layout and live seeding](0010-versioned-asset-layout-and-live-seeding.md)                                                                   | Accepted | 0011                     |
| 0011   | [Compact slim manifest, HD frame cap and layout-aware sync](0011-compact-slim-manifest-and-hd-frame-cap.md)                                                  | Accepted | -                        |
| 0012   | [Brand kit lives in docs/brand](0012-brand-kit-in-docs-brand.md)                                                                                             | Accepted | -                        |
| 0013   | [Relicense to MIT](0013-relicense-to-mit.md)                                                                                                                 | Accepted | -                        |
| 0014   | [Multi-framework support through subpath adapters](0014-multi-framework-support.md)                                                                          | Accepted | -                        |
| 0015   | [Public files site on a second Pages project](0015-public-files-site.md)                                                                                     | Accepted | 0018                     |
| 0016   | [Bun-workspaces monorepo](0016-bun-workspaces-monorepo.md)                                                                                                   | Accepted | -                        |
| 0017   | [Personal token for the emoji-lists pull request](0017-personal-token-for-the-emoji-lists-pr.md)                                                             | Accepted | -                        |
| 0018   | [Website on Coolify with Astro and Starlight](0018-website-on-coolify-with-astro-and-starlight.md)                                                           | Accepted | -                        |
| 0019   | [shadcn on Base UI for the website](0019-shadcn-on-base-ui-for-the-website.md)                                                                               | Accepted | 0027 (partly)            |
| 0020   | [Build-time code highlighting](0020-build-time-code-highlighting.md)                                                                                         | Accepted | -                        |
| 0021   | [CSS scroll-driven motion](0021-css-scroll-driven-motion.md)                                                                                                 | Accepted | -                        |
| 0022   | [Shortcodes derive from ids](0022-shortcodes-derive-from-ids.md)                                                                                             | Accepted | -                        |
| 0023   | [Practices parity with Snug](0023-practices-parity-with-snug.md)                                                                                             | Accepted | 0027 (partly)            |
| 0024   | [Site CSP served as a header with build-time hashes](0024-site-csp-served-as-a-header-with-build-time-hashes.md)                                             | Accepted | -                        |
| 0025   | [Release notes on the website](0025-release-notes-on-the-website.md)                                                                                         | Accepted | -                        |
| 0026   | [Robots allows search and answer crawlers and blocks AI-training crawlers](0026-robots-allows-search-and-answer-crawlers-and-blocks-ai-training-crawlers.md) | Accepted | -                        |
| 0027   | [Oxc toolchain replaces Prettier and most of ESLint](0027-oxc-toolchain-replaces-prettier-and-most-of-eslint.md)                                             | Accepted | -                        |
| 0028   | [CI runner standard and a parallel Site Quality workflow](0028-ci-runner-standard-and-a-parallel-site-quality-workflow.md)                                   | Accepted | -                        |
| 0029   | [Adopt the andryorelabs cross-repo standard v1](0029-andryorelabs-cross-repo-standard.md)                                                                    | Accepted | -                        |
| 0030   | [develop is the trunk, promoted to main by merge commit](0030-develop-is-the-trunk.md)                                                                       | Accepted | -                        |
