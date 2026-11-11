import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";

import { FIXTURE_MANIFEST, MANIFEST_URL } from "../test/manifest-fixture.js";
import type { SkinTone } from "./types.js";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.resetModules();
});
afterAll(() => {
  server.close();
});

const importFreshModule = async () => import("./emoji-manifest.js");

const serveFixtureManifest = () => {
  server.use(http.get(MANIFEST_URL, () => HttpResponse.json(FIXTURE_MANIFEST)));
};

test("the compact manifest is normalized to full entries with restored defaults", async () => {
  serveFixtureManifest();
  const { loadEmojiManifest } = await importFreshModule();
  const manifest = await loadEmojiManifest();

  expect(manifest["waving-hand"]).toEqual({
    id: "waving-hand",
    description: "Waving hand",
    etag: "etag-wave",
    unicode: "👋",
    animation: { framesCount: 21, fps: 24, firstFrame: 1 },
    diverse: true,
    hd: true,
    category: "Smilies",
  });
  expect(manifest.cat).toMatchObject({
    diverse: false,
    hd: false,
    animation: { framesCount: 20, fps: 10, firstFrame: 1 },
  });
});

test("an unknown skin tone from a plain-JS caller maps to the default tone", async () => {
  serveFixtureManifest();
  const { loadEmojiManifest, getSpriteUrl } = await importFreshModule();
  const manifest = await loadEmojiManifest();
  const wave = manifest["waving-hand"];
  if (!wave) throw new Error("fixture changed");

  expect(getSpriteUrl(wave, "purple" as SkinTone)).toBe(getSpriteUrl(wave));
});

test("flattens the manifest and tags each emoji with its category", async () => {
  serveFixtureManifest();
  const { loadEmojiManifest } = await importFreshModule();

  const manifest = await loadEmojiManifest();

  expect(Object.keys(manifest)).toHaveLength(3);
  expect(manifest["grinning-face"]?.category).toBe("Smilies");
  expect(manifest.cat?.category).toBe("Animals");
});

test("fetches the manifest only once across lookups", async () => {
  let requestCount = 0;
  server.use(
    http.get(MANIFEST_URL, () => {
      requestCount += 1;
      return HttpResponse.json(FIXTURE_MANIFEST);
    }),
  );
  const { loadEmojiManifest } = await importFreshModule();

  await loadEmojiManifest();
  await loadEmojiManifest();

  expect(requestCount).toBe(1);
});

test("rejects when the asset site responds with an HTTP error", async () => {
  server.use(http.get(MANIFEST_URL, () => new HttpResponse("nope", { status: 500 })));
  const { loadEmojiManifest } = await importFreshModule();

  await expect(loadEmojiManifest()).rejects.toThrow();
});

test("getSpriteUrl versions the sprite by etag and encodes the category", async () => {
  serveFixtureManifest();
  const { loadEmojiManifest, getSpriteUrl } = await importFreshModule();
  const manifest = await loadEmojiManifest();

  const cat = manifest.cat;
  if (!cat) throw new Error("fixture changed");
  expect(getSpriteUrl({ ...cat, category: "Travel and places" })).toBe(
    "https://animated-fluent-emojis-cdn.andryore.dev/v1/sprites/Travel%20and%20places/cat.etag-cat.png",
  );
});

test("getSpriteUrl maps every skin tone for diverse emojis only", async () => {
  serveFixtureManifest();
  const { loadEmojiManifest, getSpriteUrl } = await importFreshModule();
  const manifest = await loadEmojiManifest();
  const wave = manifest["waving-hand"];
  const cat = manifest.cat;
  if (!wave || !cat) throw new Error("fixture changed");

  const suffixes = (
    ["default", "light", "medium-light", "medium", "medium-dark", "dark"] as const
  ).map((tone) => /waving-hand(.*)\.etag-wave\.png/.exec(getSpriteUrl(wave, tone))?.[1]);

  expect(suffixes).toEqual(["", "_s2", "_s3", "_s4", "_s5", "_s6"]);
  expect(getSpriteUrl(cat, "dark")).toContain("/cat.etag-cat.png");
});

test("importing the manifest module makes no request", async () => {
  let requestCount = 0;
  server.use(
    http.get(MANIFEST_URL, () => {
      requestCount += 1;
      return HttpResponse.json(FIXTURE_MANIFEST);
    }),
  );

  await importFreshModule();
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });

  expect(requestCount).toBe(0);
});

test("a failed fetch is retried on the next call", async () => {
  let requestCount = 0;
  server.use(
    http.get(MANIFEST_URL, () => {
      requestCount += 1;
      return requestCount === 1
        ? new HttpResponse("nope", { status: 500 })
        : HttpResponse.json(FIXTURE_MANIFEST);
    }),
  );
  const { loadEmojiManifest } = await importFreshModule();

  await expect(loadEmojiManifest()).rejects.toThrow();
  const manifest = await loadEmojiManifest();

  expect(manifest.cat?.id).toBe("cat");
  expect(requestCount).toBe(2);
});

test("a custom asset site serves the manifest and the sprite sheets", async () => {
  const requested: string[] = [];
  server.use(
    http.get("https://assets.example.com/v1/manifest.slim.json", ({ request }) => {
      requested.push(request.url);
      return HttpResponse.json(FIXTURE_MANIFEST);
    }),
  );
  const { configureEmojis, loadEmojiManifest, getSpriteUrl } = await importFreshModule();

  configureEmojis({ assetSiteUrl: "https://assets.example.com/" });
  const manifest = await loadEmojiManifest();
  const cat = manifest.cat;
  if (!cat) throw new Error("fixture changed");

  expect(requested).toEqual(["https://assets.example.com/v1/manifest.slim.json"]);
  expect(getSpriteUrl(cat)).toBe("https://assets.example.com/v1/sprites/Animals/cat.etag-cat.png");
});

test("getSpriteSourceSet describes the sheet and its @2x sheet by width for hd emojis only", async () => {
  serveFixtureManifest();
  const { loadEmojiManifest, getSpriteSourceSet } = await importFreshModule();
  const manifest = await loadEmojiManifest();
  const wave = manifest["waving-hand"];
  const cat = manifest.cat;
  if (!wave || !cat) throw new Error("fixture changed");

  const base = "https://animated-fluent-emojis-cdn.andryore.dev/v1/sprites/Smilies";
  expect(getSpriteSourceSet(wave, "medium-light")).toBe(
    `${base}/waving-hand_s3.etag-wave.png 100w, ${base}/waving-hand_s3.etag-wave@2x.png 200w`,
  );
  expect(getSpriteSourceSet(wave)).toBe(
    `${base}/waving-hand.etag-wave.png 100w, ${base}/waving-hand.etag-wave@2x.png 200w`,
  );
  expect(getSpriteSourceSet(cat)).toBeUndefined();
});
