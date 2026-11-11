# Troubleshooting

Problems grouped by what you see, each with the cause in the code and a fix. For
the full API see the [guide](usage.md).

- [The emoji shows but never animates](#the-emoji-shows-but-never-animates)
- [Nothing renders, or only the fallback shows](#nothing-renders-or-only-the-fallback-shows)
- [The manifest is blocked by CSP or the browser is offline](#the-manifest-is-blocked-by-csp-or-the-browser-is-offline)
- [Next.js reports an error for configureEmojis or Emoji](#nextjs-reports-an-error-for-configureemojis-or-emoji)
- [ERR_PACKAGE_PATH_NOT_EXPORTED or a require error](#err_package_path_not_exported-or-a-require-error)
- [Tests that render Emoji fail or never animate in jsdom](#tests-that-render-emoji-fail-or-never-animate-in-jsdom)
- [bun run test fails because Chromium is missing](#bun-run-test-fails-because-chromium-is-missing)
- [See also](#see-also)

## The emoji shows but never animates

**Symptom:** The poster frame renders at the right size, but it never plays, and
it does not react to `playOnHover` either.

**Cause:** The `emoji-play` keyframe and the hover rules live in
`src/components/Emoji.module.css`, which ships as the separate `style.css`
export. The `emoji-play` animation name and its keyframe both come from the
`.emojiImage` class in that stylesheet. The inline style from
`useEmojiAnimation` only sets the duration, the `steps()` timing and the pause
state, so without the stylesheet nothing names an animation and the sprite sheet
stays on its poster frame. See [CSS](architecture.md#css).

Other cases look the same and are not bugs:

- The user prefers reduced motion. `autoPlay` is ignored then and the emoji
  rests on its poster frame; only `playing` overrides it.
- The emoji is off screen, the tab is hidden, or the image has not loaded yet.
  Autoplay waits for all three.

**Fix:** Import the stylesheet once, at the root of the app:

```js
import "animated-fluent-emojis/style.css";
```

If you did import it and the emoji still rests, check the operating system's
reduced motion setting.

## Nothing renders, or only the fallback shows

**Symptom:** `Emoji` renders nothing, an empty box, or your `fallback` node
instead of the animation.

**Cause:** `Emoji` reads its entry from the manifest store (`useEmojiStyle`),
which ends in one of four states:

- `loading`: an empty, `aria-hidden` placeholder of the final size. The manifest
  is fetched on first use, with a 15 second timeout.
- `missing`: the id is not in the manifest. It renders `fallback`, or nothing,
  and does not call `onError`. In development it logs `Unknown emoji id "<id>".`
  once per id. A typo or an id from another version is the usual cause.
- `error`: the manifest request failed, timed out or answered a non-2xx status.
  The store logs `Error fetching emoji data:` with the reason to the console,
  calls `onError` without an event, and renders `fallback`, or nothing. The
  fallback glyph needs the manifest, so it does not appear in this state.
- `ready`, but the sprite sheet request fails: the fallback glyph renders
  (labelled with `alt`), or your `fallback`, and `onError` gets the image event.

**Fix:** Open the console and the network tab and look for the lines above.

- Unknown id: use a known id. `EmojiId` autocompletes them, and the `lookup`
  export can search them (see [Lookup](guide/lookup.md)).
- Failed manifest: confirm `<asset site>/v1/manifest.slim.json` answers 200 from
  the browser. A failed load is retried on the next mount, on `preloadEmojis`
  and when the browser comes back online.
- Pass a `fallback` if the emoji must never leave a hole in the layout. See
  [Fallback](guide/behavior.md#fallback).

## The manifest is blocked by CSP or the browser is offline

**Symptom:** The console shows a Content Security Policy violation, a network
error or `Failed to fetch the emoji manifest (<status>)`, and every `Emoji`
falls back.

**Cause:** The manifest is requested with `fetch` from
`<assetSiteUrl>/v1/manifest.slim.json` (`fetchManifest` in
`src/utils/emoji-manifest.ts`), and the sprite sheets are loaded as images from
the same origin. A policy without that origin in `connect-src` blocks the
manifest, and one without it in `img-src` blocks the sprites. Offline, the fetch
rejects and the store enters `error`, then retries once the browser fires
`online`. `configureEmojis` with a custom `assetSiteUrl` changes the origin you
need to allow.

**Fix:** Allow the asset site origin, by default
`https://animated-fluent-emojis-cdn.andryore.dev`, in `connect-src` and
`img-src`. The exact directives are in
[CSP requirements](security.md#csp-requirements). If you self-host, allow your
own origin instead and call `configureEmojis` before the first `Emoji` renders.
See [Asset site](guide/assets.md#asset-site).

## Next.js reports an error for configureEmojis or Emoji

**Symptom:** Next.js fails the build or the page with an error that a function
is being called from the server, naming `configureEmojis` or `preloadEmojis`.

**Cause:** The published bundle starts with a `"use client";` banner (see
[Build output](architecture.md#build-output)). That lets a Server Component
import and render `<Emoji>`, which becomes a client component, but every export
of the bundle is then a client reference. Calling `configureEmojis` or
`preloadEmojis` as a function inside a Server Component asks the server to run
client code. The manifest store also lives in browser memory, so the call would
not reach the client anyway. The `lookup` export has no banner, so it can be
imported on the server.

**Fix:** Call `configureEmojis` and `preloadEmojis` from a module that starts
with `"use client"`, and import `style.css` once in the root layout. See
[Next.js and server components](../README.md#nextjs-and-server-components) and
the [guide](usage.md).

## ERR_PACKAGE_PATH_NOT_EXPORTED or a require error

**Symptom:** `ERR_PACKAGE_PATH_NOT_EXPORTED` ("No "exports" main defined"),
`Cannot find module`, or `ERR_REQUIRE_ESM` when loading the package from
CommonJS.

**Cause:** The package is ESM only. `package.json` sets `"type": "module"` and
an `exports` map with `types` and `import` conditions, and no `require`
condition or `main` field. A `require('animated-fluent-emojis')` call fails
while Node resolves the exports map, before it checks whether the file is ESM,
so `ERR_PACKAGE_PATH_NOT_EXPORTED` is the usual error and `ERR_REQUIRE_ESM`
appears only in some tools. See [ADR 0003](adr/0003-esm-only-and-vite-8.md).

**Fix:** Use `import` syntax, from an ESM file or a bundler. Every maintained
React toolchain (Vite, Next.js, Remix, modern webpack) already does. In a
CommonJS file, load it with a dynamic `import()`. For Jest, which loads CommonJS
by default, switch to its ESM mode or to a runner with native ESM support such
as Vitest.

## Tests that render Emoji fail or never animate in jsdom

**Symptom:** A test of your own component fails on an unhandled network request
or a console error from `Emoji`, or an animation assertion never passes in
jsdom.

**Cause:** Two separate limits.

- **The manifest fetch.** The first `Emoji` render fetches
  `<assetSiteUrl>/v1/manifest.slim.json`. Without a mock it hits the network or
  fails, and every `Emoji` ends in the `error` state. The store is also module
  state, so a loaded or failed manifest carries over between tests in one file.
- **Animation.** Autoplay waits until the sprite image has loaded, and jsdom
  does not load images by default, so the run stays paused. There is no CSS
  animation engine either, so `animationend` never fires on its own and
  `onPlaybackEnd` is not called. `IntersectionObserver` and `matchMedia` are
  absent in jsdom, which the component handles: the emoji counts as on screen
  and as not preferring reduced motion.

**Fix:** Mock the manifest request and reset the module between tests. This
repository does it with MSW in `src/utils/emoji-manifest.test.ts`:

```ts
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("https://animated-fluent-emojis-cdn.andryore.dev/v1/manifest.slim.json", () =>
    HttpResponse.json(compactManifest),
  ),
);
```

`compactManifest` is the compact slim manifest shape; the fixture used here is
`src/test/manifest-fixture.ts`. Call `vi.resetModules()` in `afterEach` and
import the component again per test to get a fresh store. Assert on the rendered
`img` and its inline animation styles, and do not rely on `animationend`. For
real playback, use a browser runner such as Vitest Browser Mode, as this
repository does for its component tests.

## bun run test fails because Chromium is missing

**Symptom:** For contributors: `bun run test` fails at startup with a Playwright
error that the Chromium executable does not exist.

**Cause:** Component and hook tests run in headless Chromium through Vitest
Browser Mode and Playwright, and `bun install` does not download the browser.
See [Testing](development.md#testing).

**Fix:** Install it once:

```sh
bunx playwright install chromium
```

## See also

- [Guide](usage.md): props, fallback behavior, preloading and the asset site.
- [Security design](security.md): the CSP requirements and the threat model.
- [Architecture](architecture.md): the manifest store, CSS and build output.
- [Development](development.md): setup and testing.
- [ADR 0003](adr/0003-esm-only-and-vite-8.md): why the package is ESM only.
