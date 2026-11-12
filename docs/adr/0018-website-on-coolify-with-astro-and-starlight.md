# 0018: Website on Coolify with Astro and Starlight

## Status

Accepted. Extends [0015](0015-public-files-site.md).

Date: 2026-10-06

Revised: 2026-10-21, recorded the amendment relations in Status.

Revised: 2026-11-12, a change reaches `main`, and so the website, through a
promotion of `develop` ([ADR 0030](0030-develop-is-the-trunk.md)).

## Context

The project has no website. [ADR 0015](0015-public-files-site.md) reserved
`animated-fluent-emojis.andryore.dev` for a landing site and left it out of
scope. Visitors need to see the emojis move, read the docs outside GitHub, and
find any emoji to copy a snippet or download its public files, in several
languages, with no tracking ([ROADMAP](../../ROADMAP.md) rules out telemetry).

The library ships adapters for React, Vue, Svelte, Astro and an element
([ADR 0014](0014-multi-framework-support.md)), so the docs have to show demos
for all of them, not only React.

## Decision

Build one Astro app, `apps/site`, in the monorepo
([ADR 0016](0016-bun-workspaces-monorepo.md)):
[Starlight](https://starlight.astro.build) serves the docs, and the landing
page, the gallery and the emoji pages are custom Astro pages with React islands.
It follows `~/code/snug/apps/site`, which already runs the same shape.

- **Hosting**: a Docker image (bun build, then nginx) on Coolify Cloud,
  redeployed through the Coolify API on every merge to `main` that touches the
  site and after each asset sync. The asset and files sites stay on Cloudflare
  Pages. The website needs nginx-level redirects, headers and a masked access
  log, and it joins the maintainer's other Coolify sites.
- **Docs source**: the repository `docs/` folder stays the single source. The
  site renders a published allowlist and rewrites relative links; ADRs, brand
  and maintainer docs are not published.
- **Locales**: ten, with English at `/`. Translated docs record the hash of
  their English source; a missing or stale translation shows the English page
  with a notice. Emoji names and keywords come from Unicode CLDR annotations,
  joined by code point.
- **Gallery data**: read at build from the public index of the files site, so
  the build fails loudly when it is unreachable or invalid. Animations are
  rendered at runtime by the library.
- **Privacy**: no analytics and no third-party scripts or fonts.

Rejected:

- **Fumadocs**: best AI features, but a React-only app cannot render Vue or
  Svelte demos and its i18n is partial.
- **VitePress**: Vue-only, and v2 is still alpha.
- **Docusaurus**: heavy, and v4 is still canary.
- **Plain Astro**: rebuilds the sidebar, search and fallback notices Starlight
  already has.
- **A third Cloudflare Pages project**: the maintainer prefers Coolify and the
  site needs nginx behavior Pages does not offer.

## Consequences

- A fourth deploy target and a Coolify secret and app UUID to maintain.
- About 17,000 emoji pages (1,700 emojis times 10 locales): if the build gets
  too slow, fall back to English-only emoji pages.
- Translations of the docs go stale when English changes; a status script lists
  them and the site degrades to English meanwhile.
- `GLOSSARY.md` defines website, gallery, emoji page, snippet, locale, stale
  translation and localized name.
