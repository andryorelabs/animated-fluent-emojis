# Documentation index

An index of every document in this repository.

## Core

- [`README.md`](../README.md): user-facing portal with install and usage.
- [`usage.md`](usage.md): the Guide overview, linking to one page per topic in
  [`guide/`](guide/): frameworks, props, behavior, assets, lookup and types.
- [`guide/frameworks.md`](guide/frameworks.md),
  [`guide/props.md`](guide/props.md), [`guide/behavior.md`](guide/behavior.md),
  [`guide/assets.md`](guide/assets.md), [`guide/lookup.md`](guide/lookup.md) and
  [`guide/types.md`](guide/types.md): the Guide pages.
- [`troubleshooting.md`](troubleshooting.md): fixes for common problems, by
  symptom.
- [`CHANGELOG.md`](../CHANGELOG.md): release notes, newest first.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): contribution setup, branch and commit
  format, merging and CI.
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md): community standards.
- [`GOVERNANCE.md`](../GOVERNANCE.md): decision process and project continuity.
- [`ROADMAP.md`](../ROADMAP.md): project direction.
- [`SECURITY.md`](../.github/SECURITY.md): how to report vulnerabilities.
- [`security.md`](security.md): the security design and assurance case.
- Website: <https://animated-fluent-emojis.andryore.dev>, the landing page,
  emoji gallery and docs in ten languages (`apps/site`).
- [`PRODUCT.md`](../PRODUCT.md): product context for agents.
- [`apps/site/DESIGN.md`](../apps/site/DESIGN.md): the website's design rules.
- [`AGENTS.md`](../AGENTS.md): instructions for coding agents (`CLAUDE.md`
  imports it).

## Development

- [`development.md`](development.md): setup, workspaces, scripts, git hooks, CI,
  conventions, testing, playground and repository settings.
- [`architecture.md`](architecture.md): code map of the core, the adapters,
  manifest, animation, asset pipeline and CSS.
- [`how-to/cut-a-release.md`](how-to/cut-a-release.md): releasing and the npm
  trusted publisher setup.
- [`how-to/set-up-asset-hosting.md`](how-to/set-up-asset-hosting.md): creating
  the Cloudflare Pages project and the secrets behind the asset site.
- [`how-to/roll-back-the-asset-site.md`](how-to/roll-back-the-asset-site.md):
  restoring an earlier asset site deployment.
- [`how-to/translate-the-website.md`](how-to/translate-the-website.md): adding
  or refreshing a website translation.

## How-to guides

- [`how-to/README.md`](how-to/README.md): index of the how-to guides.
- [`how-to/use-without-code.md`](how-to/use-without-code.md): using the emojis
  in Slack, Notion, Google Docs, email or a README from a link, with no code.
- [`how-to/self-host-the-assets.md`](how-to/self-host-the-assets.md): serving
  the asset site from your own origin, with the CSP.
- [`how-to/use-with-nextjs.md`](how-to/use-with-nextjs.md): the client boundary,
  stylesheet and preloading in Next.js.
- [`how-to/preload-for-a-picker.md`](how-to/preload-for-a-picker.md): warming
  the manifest and sprite sheets for an emoji picker.
- [`how-to/use-with-angular.md`](how-to/use-with-angular.md): `<fluent-emoji>`
  in Angular.
- [`how-to/use-with-solid.md`](how-to/use-with-solid.md): `<fluent-emoji>` in
  Solid.
- [`how-to/use-with-preact.md`](how-to/use-with-preact.md): `<fluent-emoji>` or
  `preact/compat` in Preact.

## Architecture decision records

- [`adr/README.md`](adr/README.md): ADR index and status table.
- [`adr/0001-public-repo-security-posture.md`](adr/0001-public-repo-security-posture.md)
- [`adr/0002-tsdoc-only-code-comments.md`](adr/0002-tsdoc-only-code-comments.md)
- [`adr/0003-esm-only-and-vite-8.md`](adr/0003-esm-only-and-vite-8.md)
- [`adr/0004-vitest-browser-mode.md`](adr/0004-vitest-browser-mode.md)
- [`adr/0005-npm-trusted-publishing.md`](adr/0005-npm-trusted-publishing.md)
- [`adr/0006-cloudflare-pages-asset-hosting.md`](adr/0006-cloudflare-pages-asset-hosting.md)
- [`adr/0007-pinned-official-emoji-ids.md`](adr/0007-pinned-official-emoji-ids.md)
- [`adr/0008-static-keyframes-and-lazy-slim-manifest.md`](adr/0008-static-keyframes-and-lazy-slim-manifest.md)
- [`adr/0009-hd-sprite-sheets-and-strict-validation.md`](adr/0009-hd-sprite-sheets-and-strict-validation.md)
- [`adr/0010-versioned-asset-layout-and-live-seeding.md`](adr/0010-versioned-asset-layout-and-live-seeding.md)
- [`adr/0011-compact-slim-manifest-and-hd-frame-cap.md`](adr/0011-compact-slim-manifest-and-hd-frame-cap.md)
- [`adr/0012-brand-kit-in-docs-brand.md`](adr/0012-brand-kit-in-docs-brand.md)
- [`adr/0013-relicense-to-mit.md`](adr/0013-relicense-to-mit.md)
- [`adr/0014-multi-framework-support.md`](adr/0014-multi-framework-support.md)
- [`adr/0015-public-files-site.md`](adr/0015-public-files-site.md)
- [`adr/0016-bun-workspaces-monorepo.md`](adr/0016-bun-workspaces-monorepo.md)
- [`adr/0017-personal-token-for-the-emoji-lists-pr.md`](adr/0017-personal-token-for-the-emoji-lists-pr.md)
- [`adr/0018-website-on-coolify-with-astro-and-starlight.md`](adr/0018-website-on-coolify-with-astro-and-starlight.md)
- [`adr/0019-shadcn-on-base-ui-for-the-website.md`](adr/0019-shadcn-on-base-ui-for-the-website.md)
- [`adr/0020-build-time-code-highlighting.md`](adr/0020-build-time-code-highlighting.md)
- [`adr/0021-css-scroll-driven-motion.md`](adr/0021-css-scroll-driven-motion.md)
- [`adr/0022-shortcodes-derive-from-ids.md`](adr/0022-shortcodes-derive-from-ids.md)
- [`adr/0023-practices-parity-with-snug.md`](adr/0023-practices-parity-with-snug.md)
- [`adr/0024-site-csp-served-as-a-header-with-build-time-hashes.md`](adr/0024-site-csp-served-as-a-header-with-build-time-hashes.md)
- [`adr/0025-release-notes-on-the-website.md`](adr/0025-release-notes-on-the-website.md)
- [`adr/0026-robots-allows-search-and-answer-crawlers-and-blocks-ai-training-crawlers.md`](adr/0026-robots-allows-search-and-answer-crawlers-and-blocks-ai-training-crawlers.md)
- [`adr/0027-oxc-toolchain-replaces-prettier-and-most-of-eslint.md`](adr/0027-oxc-toolchain-replaces-prettier-and-most-of-eslint.md)
- [`adr/0028-ci-runner-standard-and-a-parallel-site-quality-workflow.md`](adr/0028-ci-runner-standard-and-a-parallel-site-quality-workflow.md)
- [`adr/0029-andryorelabs-cross-repo-standard.md`](adr/0029-andryorelabs-cross-repo-standard.md)

## Brand

- [`brand/README.md`](brand/README.md): the brand kit, with the brief, naming,
  voice, copy, logo, tokens and brand book.
- [`brand/brief.md`](brand/brief.md): the brand brief.
- [`brand/naming.md`](brand/naming.md): the name and how to write it.
- [`brand/voice.md`](brand/voice.md): voice and tone.
- [`brand/copy.md`](brand/copy.md): the public copy, the source for the slogan
  and the package description.
- [`brand/competitors.md`](brand/competitors.md): the competitor review.
- [`brand/apply-spec.md`](brand/apply-spec.md): where the brand is applied, and
  the repository settings with the commands that apply them.
- [`design/README.md`](design/README.md): design notes.

## Agent workflow

- [`agents/domain.md`](agents/domain.md): domain docs layout.
- [`agents/issue-tracker.md`](agents/issue-tracker.md): the Linear tracker.
- [`agents/triage-labels.md`](agents/triage-labels.md): triage label vocabulary.
- [`agents/emet.md`](agents/emet.md): emet operational specifics.

## Emoji reference

- [`EMOJI_LIST.md`](EMOJI_LIST.md): index of all emojis, linking one list per
  category.
