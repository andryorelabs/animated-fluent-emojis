# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `playOnHover` now only replays on hover for hover-capable, fine pointers
  (`@media (hover: hover) and (pointer: fine)`) in the React component, the
  Astro component and `<fluent-emoji>`. On touch devices a tap no longer leaves
  a sticky `:hover` that loops the animation until the user taps elsewhere;
  keyboard focus (`:focus-visible`) playback is unchanged.
- Every optional `EmojiOptions` property accepts an explicit `undefined`, so
  `controller.update({ fallback: undefined })` type-checks for consumers that
  compile with `exactOptionalPropertyTypes`. Runtime behavior is unchanged.

### Fixed

- A manifest load that failed is no longer fetched a second time when an older load, superseded by `configureEmojis`, settles afterwards. `onError` fired twice for one failure in that case.

## [0.8.0] - 2026-10-06

### Added

- A public files site, `https://animated-fluent-emojis-files.andryore.dev`, with
  every emoji and skin tone as an animated GIF, an animated WebP and a
  poster-frame PNG at stable URLs such as `/gif/<slug>.gif`, plus an
  `/index.json`. Slugs are frozen in a committed registry. The artwork is
  Microsoft's, see [ADR 0015](docs/adr/0015-public-files-site.md).
- The emoji lists show a preview and links to the public files of each emoji.

### Changed

- The asset site default URL is now
  `https://animated-fluent-emojis-cdn.andryore.dev`. Consumers with a strict
  Content Security Policy must allow that host in `img-src` and `connect-src`.
  The old `pages.dev` URL keeps working.

## [0.7.0] - 2026-10-06

### Removed

- **Breaking:** the root `Emoji` export, deprecated in 0.6. Change the import
  path to `animated-fluent-emojis/react`, nothing else; props and behavior are
  identical:

  ```diff
  -import { Emoji } from 'animated-fluent-emojis'
  +import { Emoji } from 'animated-fluent-emojis/react'
  ```

- **Breaking:** the `EmojiProps` type at the root. Import it from
  `animated-fluent-emojis/react`. `configureEmojis`, `preloadEmojis`,
  `createEmoji`, `EmojiId`, `DiverseEmojiId` and `SkinTone` stay at the root.

### Changed

- `react` and `react-dom` are now optional peer dependencies, so Vue, Svelte and
  Astro installs no longer get a React peer warning.

## [0.6.0] - 2026-10-06

### Added

- Multi-framework support behind subpath exports, see
  [ADR 0014](docs/adr/0014-multi-framework-support.md):
  - `animated-fluent-emojis/react` exports `Emoji` and its types.
  - `animated-fluent-emojis/vue` exports a native Vue 3 `Emoji` with a
    `fallback` slot and `load`, `error` and `playbackEnd` events.
  - `animated-fluent-emojis/svelte` exports a native Svelte 5 `Emoji` with a
    `fallback` snippet.
  - `animated-fluent-emojis/astro` exports an Astro `Emoji` that renders at
    build time and starts playback with a small client script.
  - `animated-fluent-emojis/element` registers `<fluent-emoji>`, a Web Component
    for Angular, Solid, Preact, Lit, Alpine, htmx and plain HTML. It has a
    `slot="fallback"` and the `emoji-load`, `emoji-error` and `playback-end`
    events.
  - `createEmoji` at the root renders an emoji into any DOM node and returns a
    controller with `update` and `destroy`.
- Install and usage steps for every framework in the
  [usage guide](docs/guide/frameworks.md), how-tos for
  [Angular](docs/how-to/use-with-angular.md),
  [Solid](docs/how-to/use-with-solid.md) and
  [Preact](docs/how-to/use-with-preact.md), and a "Works with" table in the
  README.
- `vue`, `svelte`, `astro`, `solid-js` and `preact` as optional peer
  dependencies.

### Changed

- The playback logic moved to a framework-free core shared by every adapter, and
  one conformance suite checks that they behave alike.

### Deprecated

- The root `Emoji` export, removed in 0.7. Migrate by changing the import path
  to `animated-fluent-emojis/react`, nothing else. `configureEmojis` and
  `preloadEmojis` stay at the root. In 0.7 `react` also becomes an optional peer
  dependency.

## [0.5.3] - 2026-10-06

### Changed

- Relicensed the code from ISC to MIT, see
  [ADR 0013](docs/adr/0013-relicense-to-mit.md). Versions up to 0.5.2 stay ISC.
- The package description, keywords and README intro describe what the component
  does today. The "Exclusive Feature" callout is removed.
- Added a brand kit in `docs/brand/` and the `bun run brand:export` script that
  generates its rasters.

## [0.5.2] - 2026-10-05

### Fixed

- **Behavior change (lookup):** `findEmojiByUnicode` requires the variation
  selector (U+FE0F) for text-default symbols such as `©` and `™`, which no
  longer match as a bare character.
- **Behavior change (lookup):** a text with mixed skin tones resolves to the
  base emoji, with no `skinTone`.
- **Behavior change (lookup):** `extractEmojis` no longer rejects without
  `Intl.Segmenter`; it falls back to a code point grouper.
- **Behavior change (lookup):** a `searchEmojis` `limit` that is not a positive
  number means no limit, and `0` returns nothing.
- The manifest record has no prototype, so ids such as `constructor` resolve
  like any other, and a load superseded by `configureEmojis` returns the current
  load's result.
- A run that the playback gate blocks mid-run is paused on its frame instead of
  restarting.
- `onError` fires once per failure, and a numeric string `size` such as `"48"`
  is treated as a number. A string `size` gets `sizes="auto"`.
- `Emoji` shares one `online` listener across all instances.
- The sync records `skippedIds` and `limited` in `version.json` and rebuilds
  until the site is complete; `--limit` must be a positive whole number.
- Legacy `/sprites/*` files are cached for one day instead of a year, since
  their URLs are not content-addressed.
- `assets:verify-live` checks the live v1 layout and pipeline version, and the
  release workflow runs it before publishing.
- The release workflow publishes prereleases under their own dist tag.
- The sync smoke test waits for the deployed `builtAt` and retries its fetches.

- **Behavior change (lookup):** when several catalog entries share a glyph,
  `findEmojiByUnicode` and `extractEmojis` return the canonical emoji (the id
  prefixed with its code points, otherwise a reviewed override, otherwise the
  first in catalog order) instead of the last entry indexed, so `❤️` no longer
  resolves to a variant. A skin tone falls back to an entry sharing the glyph
  that has tones.
- **Behavior change (lookup):** ZWJ sequences match without the variation
  selector (minimally qualified), and a fractional `searchEmojis` `limit` is
  rounded down.
- Invalid numeric string sizes such as `"-5"` fall back to 100, like numeric
  sizes; `".5"` is 0.5px and `"2rem"` stays a CSS length.
- `preloadEmojis` sets `sizes` next to `srcset` for HD sheets, and the manifest
  load times out after 15 seconds without `AbortSignal.timeout` (Safari before
  16).
- `skippedIds` lists only real failures. An HD frame count mismatch ships the
  emoji without HD instead of keeping the site stale, so scheduled syncs no
  longer rebuild forever; `assets:verify-live` retries its fetch.
- The sync workflow runs its smoke checks on every run, pins Wrangler, times out
  after 90 minutes, and its changelog job only looks at `[Unreleased]`.
- Prereleases are published as GitHub prereleases, never "Latest", and numeric
  prereleases publish under the `next` dist tag.
- `engines.bun` is removed from the published package.

### Changed

- Renovate manages dependency updates; `@types/node` is held below 25 and the
  `npm` pin in the workflows is tracked.
- The shared manifest chunk has a stable name, `chunks/manifest-[hash].js`.
- Bumped `eslint-plugin-unicorn` to 77 and `@types/node` to 24.

## [0.5.1] - 2026-10-05

0.5.0 was tagged but never published to npm; 0.5.1 carries all of its changes
plus the release workflow fix below.

### Added

- `className` and `style` on `Emoji`, merged with the component's own, and any
  other `<span>` attribute (`data-*`, `aria-*`, event handlers), passed to the
  root span.
- `ref` on `Emoji`, forwarded to the root span, on React 18 and 19.
- `fallback` prop: a node rendered when the sprite sheet or the manifest fails
  to load. `fallback={null}` renders nothing.
- `onLoad` and `onError` props. `onError` also runs, without an event, when the
  manifest fails to load.
- `preloadEmojis(ids?, { skinTone })` starts the manifest load before the first
  render and warms the sprite sheets of the given ids.
- The slim manifest carries `unicode` for every emoji, used as the fallback
  glyph.
- The asset site publishes asset layout version `v1`: `/v1/manifest.slim.json`,
  `/v1/version.json` and etag-named sprite sheets under `/v1/sprites/`, with
  immutable caching. The legacy layout is still published for 0.4.x.
- The asset site keeps the previous sprite generation for one more sync, so a
  manifest cached just before a sync still resolves.
- Sync guards: the sync fails when Teams discovery fails on both advertised
  sources, when more than 5% of the catalog would be removed (both bypassed by
  `force`), and always above 19,000 output files. A post-deploy smoke test, a
  `sync-assets failing` issue and a
  [rollback how-to](docs/how-to/roll-back-the-asset-site.md) back them up.

- `playing` prop: `true` plays and overrides `autoPlay` and reduced motion,
  `false` pauses, `undefined` keeps the default. `onPlaybackEnd` fires once when
  a finite run ends.
- `size` accepts any CSS length string (`2rem`, `var(--size)`) as well as a
  number.
- `animated-fluent-emojis/lookup`: `findEmojiByUnicode`, `extractEmojis` and
  `searchEmojis`, with no React and the manifest shared with `Emoji`.
- `DiverseEmojiId`, generated with `EmojiId`, and a `skinTone` typed against it.
- Sync inputs `rebuild` and `bypass_guards`, a layout-aware trigger that
  publishes `/v1/` when it is missing or the pipeline version changed, and a v1
  smoke test that always runs.

### Changed

- **Behavior change:** when a sprite sheet fails to load, `Emoji` now shows the
  fallback glyph, the emoji's Unicode character, instead of nothing. Pass
  `fallback={null}` to restore the previous behavior.
- The runtime reads `/v1/manifest.slim.json` and etag-named sprite sheets
  instead of the unversioned paths and the `?v=<etag>` query.
- `srcSet` is width-based (`100w`, `200w`) with `sizes` set to the rendered
  size.
- Autoplay waits until the image has loaded, the emoji is on screen (one shared
  `IntersectionObserver`) and the tab is visible; hidden tabs pause playback.
- `size` is rounded, and anything but a finite positive number falls back
  to 100. `animationIterations` is normalized: `Infinity` is `'infinite'`, and
  `NaN` or a negative value disables autoplay.
- The v1 slim manifest is compact: defaults (`fps` 24, `firstFrame` 1, `diverse`
  and `hd` false) are omitted and restored by the runtime. The legacy manifest
  is unchanged.
- **Behavior change:** only emojis with at most 81 frames get an HD sheet, so
  the sheet stays under Chromium's 16,384 px limit; validation rejects a taller
  one. Ten emojis lose their HD sheet and use the standard one.
- An unknown `id` renders `fallback` (nothing by default) instead of always
  `null`, warns once in development and never calls `onError`.
- While autoplay is held, the emoji shows its poster frame.
- Visibility and reduced-motion listeners are shared at module level instead of
  one per emoji.
- The sync replaces `force` with `rebuild` and `bypass_guards`. The removal
  guard runs on the planned catalog before conversion; the file-count guard is
  never bypassed.
- The release workflow is split into a `verify` job (`contents: read`) and a
  `publish` job (`id-token: write`, no dependency install) that skips when the
  version already exists, and it checks that `/v1/version.json` is live.
- `build.ts` is split into deep modules, with no behaviour change.
- **First sync:** the first sync after this change converts every sprite again,
  because the live site has no `/v1/` files to seed from, and publishes the
  whole `/v1/` layout.
- The asset build downloads unchanged sprite sheets from the live site instead
  of converting them again, decodes each official source once, and fetches with
  retries, backoff and a 60 second timeout.

### Fixed

- Changing the `id` of a mounted `Emoji` resets its animation state, so the new
  emoji plays its initial run.
- A manifest that failed to load is retried on the next mount, on
  `preloadEmojis` and when the browser comes back online, instead of only on the
  next render.

- The manifest request times out after 15 seconds instead of waiting forever.
- State resets when the sprite changes, not only when the `id` does, and a
  failed sprite is retried on a source change or when the browser goes online.
- An unknown `skinTone` falls back to the default sheet.

- The release workflow passed the tarball to `npm publish` without a leading
  `./`, so npm read it as a GitHub shorthand and the 0.5.0 publish failed.

### Security

- The release workflow gives `id-token: write` only to the job that publishes,
  which installs nothing and runs no repository scripts.
- Pipeline validation rejects undecodable or oversized sprites, and the removal
  guard stops a sync that would drop more than 5% of the catalog before any
  conversion.

### Migration

- If you relied on an empty box when a sprite sheet fails, pass
  `fallback={null}`.
- An unknown `id` now renders `fallback`; it still renders nothing by default.
- If you mirror the asset site, publish the `v1` layout with the 0.5 pipeline;
  see [ADR 0010](docs/adr/0010-versioned-asset-layout-and-live-seeding.md).

## [0.4.0] - 2026-10-05

### Added

- `alt` prop on `Emoji`: accessible text, defaulting to the emoji description;
  an empty string marks the emoji as decorative.
- `configureEmojis({ assetSiteUrl })` to serve the manifest and sprite sheets
  from your own asset site.
- HD (`@2x`, 200px) sprite sheets for every emoji with an official counterpart,
  served through `srcSet`.
- `playOnHover` also plays when the emoji sits inside a focused `<button>` or
  `<a>`.
- `EmojiId`, `EmojiProps` and `SkinTone` are exported from the package.
- The bundle starts with `"use client";`, so `Emoji` works from Next.js server
  components.

### Changed

- **Breaking:** while the manifest loads, `Emoji` renders an empty `aria-hidden`
  placeholder of the final size instead of `null`. It still renders `null` for
  an unknown id or a failed load.
- **Breaking:** under `prefers-reduced-motion: reduce`, `autoPlay` is ignored
  and the emoji rests on its poster frame; with `playOnHover`, hover and focus
  still play it.
- **Breaking:** images are rendered with `loading="lazy"` and
  `decoding="async"`, so offscreen emojis load when they approach the viewport.
- **Breaking:** the `id` prop is typed `EmojiId | (string & {})` instead of
  `string`. Known ids autocomplete; any string still compiles.
- **Breaking:** the runtime fetches `manifest.slim.json` instead of
  `manifest.json`, on first render instead of at import. Asset sites that mirror
  the catalog must publish the slim manifest.
- Etags of converted sprites are content hashes that include a pipeline version,
  and the animation frame rate is exact instead of rounded.
- The asset build validates every animation and sprite sheet and fails on any
  problem.

### Fixed

- Emojis animate again: no per-emoji `<style>` with a
  `transform: ... !important` rule overrides the keyframe anymore.
- A failed manifest fetch is retried on the next render instead of leaving every
  emoji blank.

### Migration

- Make sure `animated-fluent-emojis/style.css` is imported: it carries the
  animation keyframes.
- If you styled or tested around `null` while loading, handle the placeholder
  `<span aria-hidden="true">` instead.
- If you mirror the asset site, publish `manifest.slim.json` and, optionally,
  the `@2x` sheets, and call `configureEmojis` before the first render.
- To get type checking against published ids, type your ids as `EmojiId`; plain
  `string` values keep compiling.

## [0.3.0] - 2026-10-05

### Added

- `skinTone` prop on `Emoji` to pick a skin tone for emojis with variants.
- The 40 official Fluent animated emojis that Teams does not ship, such as
  flags, 😀, 🖕 and the "facing right" variants.
- Sprite URLs carry the emoji `etag` so updated sprites are never served stale.

### Changed

- The manifest and sprites are served from
  `https://animated-fluent-emojis.pages.dev` and refreshed automatically each
  week.

### Fixed

- Emojis no longer fail to load now that `cdn.animated-fluent-emojis.com` no
  longer exists.

## [0.2.0] - 2026-10-05

### Added

- `animated-fluent-emojis/style.css` export for importing the component styles.
- React 19 support in the `react` and `react-dom` peer dependency ranges.

### Changed

- **Breaking:** the package is now ESM-only. The UMD and CommonJS builds were
  removed.

### Fixed

- `sideEffects` now declares the stylesheet so bundlers no longer drop the
  component styles during tree shaking.

## [0.1.2] - 2024-09-02

### Changed

- Version bump with no source changes since 0.1.1.

## [0.1.1] - 2024-08-22

### Added

- Emoji list and preview images in the documentation.

### Changed

- Package metadata in `package.json` (description, keywords, repository, bugs
  and homepage links, `sideEffects`).
- Renamed the `lib` directory to `src` and removed demo code.

### Fixed

- Emoji image source URL.
- Type declarations are now included in the build output.
- CSS classes of the emoji container.

## [0.1.0] - 2024-08-21

### Added

- Initial release of the animated Fluent emoji React components.

[Unreleased]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.5.3...v0.6.0
[0.5.3]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.4.0...v0.5.1
[0.4.0]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/andryorelabs/animated-fluent-emojis/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/andryorelabs/animated-fluent-emojis/releases/tag/v0.1.2
[0.1.1]: https://github.com/andryorelabs/animated-fluent-emojis/releases/tag/v0.1.1
[0.1.0]: https://github.com/andryorelabs/animated-fluent-emojis/releases/tag/v0.1.0
