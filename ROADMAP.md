# Roadmap

This document describes the project's direction at a high level. It is reviewed
yearly; day-to-day planning happens in
[GitHub issues](https://github.com/andryorelabs/animated-fluent-emojis/issues),
which are the source of truth for what's actually being worked on next.

## Next 12 months

The focus for the next year is maintenance rather than new surface area:

- **Maintenance** — keeping dependencies, tooling, and CI current as the
  supported frameworks and the bundler ecosystem evolve.
- **Files site** — keeping the files site (the public GIF, WebP and PNG
  downloads) published and its URLs stable as the emoji catalog grows, alongside
  the asset site.
- **Website** — keeping the website
  (https://animated-fluent-emojis.andryore.dev) deployed, its docs in step with
  `docs/`, and its translations fresh; see
  [ADR 0018](docs/adr/0018-website-on-coolify-with-astro-and-starlight.md).
- **Framework support** — keeping the React, Vue, Svelte, Astro and
  `<fluent-emoji>` adapters in step with their frameworks, with the library
  shipped as ESM-only.
- **Bug fixes** — addressing defects as they're reported.
- **Issue triage** — keeping the issue tracker current so contributors and users
  know what's open, planned, or declined.

## Future enhancements under consideration

Nothing is queued at the moment. New ideas are welcome as
[GitHub issues](https://github.com/andryorelabs/animated-fluent-emojis/issues);
being listed here would never be a promise that they ship.

## Out of scope

The following are explicitly not planned:

- **Custom emoji artwork** — the library wraps Microsoft's Fluent emoji set and
  does not ship or accept original artwork.
- **Native Angular, Solid, Qwik and Ember adapters** — those frameworks use the
  `<fluent-emoji>` element until someone asks for more; see
  [ADR 0014](docs/adr/0014-multi-framework-support.md).
- **Backend services and telemetry** — the library is a client-side component
  set; its only network requests are the manifest and sprite sheets it loads
  from the asset site, and it collects no usage data.

## Where planning actually happens

This roadmap is intentionally coarse. Concrete, scheduled work lives in
[GitHub issues](https://github.com/andryorelabs/animated-fluent-emojis/issues).
Those are the places to check for what's happening next, and the places to
propose new work.
