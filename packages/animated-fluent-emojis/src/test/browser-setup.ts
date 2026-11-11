import { passthrough } from "msw";
import { setupWorker } from "msw/browser";
import { http, HttpResponse } from "msw/http";

import {
  FIXTURE_MANIFEST,
  MANIFEST_URL,
  SPRITE_URL_PATTERN,
  TRANSPARENT_PNG_BASE64,
} from "./manifest-fixture.js";

const respondWithSprite = () =>
  new HttpResponse(
    Uint8Array.from(atob(TRANSPARENT_PNG_BASE64), (character) => character.codePointAt(0) ?? 0),
    { headers: { "Content-Type": "image/png" } },
  );

/**
 * Source files such as `.svelte` are not on MSW's common-asset list, so the
 * dev server's module requests for them must be let through explicitly.
 * Tests that point the library at an isolated `*.test` asset site stub the
 * manifest themselves, but its sprites need a handler too: an unhandled
 * request fails and the image turns into the glyph fallback at a random time.
 */
const worker = setupWorker(
  http.get(/\.svelte(?:\?.*)?$/, () => passthrough()),
  http.get(MANIFEST_URL, () => HttpResponse.json(FIXTURE_MANIFEST)),
  http.get(SPRITE_URL_PATTERN, respondWithSprite),
  http.get(/^https:\/\/[^/]+\.test\/v1\/sprites\//, respondWithSprite),
);

await worker.start({ onUnhandledFrame: "error", quiet: true });
