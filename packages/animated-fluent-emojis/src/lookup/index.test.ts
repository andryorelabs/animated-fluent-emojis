import { readFileSync } from "node:fs";
import path from "node:path";
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";

import { FIXTURE_MANIFEST, MANIFEST_URL } from "../test/manifest-fixture.js";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.resetModules();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

const serveFixtureManifest = () => {
  let requests = 0;
  server.use(
    http.get(MANIFEST_URL, () => {
      requests += 1;
      return HttpResponse.json(FIXTURE_MANIFEST);
    }),
  );
  return () => requests;
};

const importFresh = async () => import("./index.js");

test("findEmojiByUnicode finds a plain emoji and tolerates VS16", async () => {
  serveFixtureManifest();
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("😀")).toEqual({ id: "grinning-face" });
  expect(await findEmojiByUnicode("😀️")).toEqual({ id: "grinning-face" });
});

test("findEmojiByUnicode maps skin tone modifiers for diverse emojis only", async () => {
  serveFixtureManifest();
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("👋🏽")).toEqual({
    id: "waving-hand",
    skinTone: "medium",
  });
  expect(await findEmojiByUnicode("👋🏿")).toEqual({
    id: "waving-hand",
    skinTone: "dark",
  });
  expect(await findEmojiByUnicode("🐱🏽")).toBeUndefined();
});

test("findEmojiByUnicode returns undefined for an unknown character", async () => {
  serveFixtureManifest();
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("Z")).toBeUndefined();
});

test("extractEmojis returns matches with offsets", async () => {
  serveFixtureManifest();
  const { extractEmojis } = await importFresh();

  expect(await extractEmojis("hi 😀 and 👋🏻 ok")).toEqual([
    { id: "grinning-face", text: "😀", index: 3, length: 2 },
    {
      id: "waving-hand",
      skinTone: "light",
      text: "👋🏻",
      index: 10,
      length: 4,
    },
  ]);
});

test("extractEmojis keeps a ZWJ sequence whole and skips unknown ones", async () => {
  serveFixtureManifest();
  const { extractEmojis } = await importFresh();

  expect(await extractEmojis("🐱‍⬛")).toEqual([]);
  expect(await extractEmojis("no emojis here")).toEqual([]);
});

test("searchEmojis matches descriptions ignoring case and honours the limit", async () => {
  serveFixtureManifest();
  const { searchEmojis } = await importFresh();

  expect(await searchEmojis("FACE")).toEqual([{ id: "grinning-face" }]);
  expect(await searchEmojis("a", { limit: 1 })).toHaveLength(1);
  expect(await searchEmojis(" ".repeat(3))).toEqual([]);
  expect(await searchEmojis("zzz")).toEqual([]);
});

test("lookups share one manifest fetch with the Emoji store", async () => {
  const requestCount = serveFixtureManifest();
  const { findEmojiByUnicode, searchEmojis, extractEmojis } = await importFresh();
  const { loadEmojiManifest } = await import("../utils/emoji-manifest.js");

  await Promise.all([
    findEmojiByUnicode("😀"),
    searchEmojis("cat"),
    extractEmojis("🐱"),
    loadEmojiManifest(),
  ]);

  expect(requestCount()).toBe(1);
});

test("every lookup resolves empty when the manifest fails", async () => {
  server.use(http.get(MANIFEST_URL, () => HttpResponse.error()));
  vi.spyOn(console, "error").mockImplementation(() => 0 as never);
  const { findEmojiByUnicode, searchEmojis, extractEmojis } = await importFresh();

  expect(await findEmojiByUnicode("😀")).toBeUndefined();
  expect(await extractEmojis("😀")).toEqual([]);
  expect(await searchEmojis("face")).toEqual([]);
});

test("the lookup module does not import React", () => {
  const source = readFileSync(path.resolve(import.meta.dirname, "index.ts"), "utf8");

  expect(source).not.toMatch(/from\s+['"]react/);
  expect(source).not.toContain("use client");
});

const TEXT_SYMBOL_MANIFEST = {
  categories: [
    {
      id: "symbols",
      title: "Symbols",
      description: "Symbols",
      emoticons: [
        {
          id: "copyright",
          description: "Copyright",
          etag: "e1",
          unicode: "©️",
          animation: { framesCount: 10 },
        },
        {
          id: "trade-mark",
          description: "Trade mark",
          etag: "e2",
          unicode: "™️",
          animation: { framesCount: 10 },
        },
        {
          id: "keycap-1",
          description: "Keycap 1",
          etag: "e3",
          unicode: "1️⃣",
          animation: { framesCount: 10 },
        },
        {
          id: "grinning-face",
          description: "Grinning face",
          etag: "e4",
          unicode: "\u{1F600}",
          animation: { framesCount: 10 },
        },
        {
          id: "waving-hand",
          description: "Waving hand",
          etag: "e5",
          unicode: "\u{1F44B}",
          animation: { framesCount: 10 },
          diverse: true,
        },
        {
          id: "people-holding-hands",
          description: "People holding hands",
          etag: "e6",
          unicode: "\u{1F9D1}‍\u{1F91D}‍\u{1F9D1}",
          animation: { framesCount: 10 },
          diverse: true,
        },
        {
          id: "family",
          description: "Family",
          etag: "e7",
          unicode: "\u{1F468}‍\u{1F469}‍\u{1F467}",
          animation: { framesCount: 10 },
        },
      ],
    },
  ],
};

const serveSymbolManifest = () => {
  server.use(http.get(MANIFEST_URL, () => HttpResponse.json(TEXT_SYMBOL_MANIFEST)));
};

test("text presentation bases require VS16 while emoji presentation bases do not", async () => {
  serveSymbolManifest();
  const { extractEmojis, findEmojiByUnicode } = await importFresh();

  expect(await extractEmojis("© 2024 Acme™")).toEqual([]);
  expect(await extractEmojis("©️")).toEqual([{ id: "copyright", text: "©️", index: 0, length: 2 }]);
  expect(await findEmojiByUnicode("™")).toBeUndefined();
  expect(await findEmojiByUnicode("™︎")).toBeUndefined();
  expect(await findEmojiByUnicode("™️")).toEqual({ id: "trade-mark" });
  expect(await findEmojiByUnicode("\u{1F600}")).toEqual({ id: "grinning-face" });
  expect(await findEmojiByUnicode("\u{1F600}️")).toEqual({
    id: "grinning-face",
  });
});

test("a zwj sequence still resolves without the VS16 it carries inside", async () => {
  server.use(
    http.get(MANIFEST_URL, () =>
      HttpResponse.json({
        categories: [
          {
            id: "people",
            title: "People",
            description: "People",
            emoticons: [
              {
                id: "woman-running",
                description: "Woman running",
                etag: "e9",
                unicode: "\u{1F3C3}\u{200D}\u{2640}\u{FE0F}",
                animation: { framesCount: 10 },
              },
            ],
          },
        ],
      }),
    ),
  );
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("\u{1F3C3}\u{200D}\u{2640}")).toEqual({
    id: "woman-running",
  });
  expect(await findEmojiByUnicode("\u{1F3C3}\u{200D}\u{2640}\u{FE0F}")).toEqual({
    id: "woman-running",
  });
});

test("keycap sequences resolve whole", async () => {
  serveSymbolManifest();
  const { extractEmojis } = await importFresh();

  expect(await extractEmojis("a 1️⃣")).toEqual([
    { id: "keycap-1", text: "1️⃣", index: 2, length: 3 },
  ]);
  expect(await extractEmojis("1⃣")).toEqual([]);
});

test("two different skin tones resolve to the base id, one tone is kept", async () => {
  serveSymbolManifest();
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("\u{1F9D1}\u{1F3FB}‍\u{1F91D}‍\u{1F9D1}\u{1F3FF}")).toEqual({
    id: "people-holding-hands",
  });
  expect(await findEmojiByUnicode("\u{1F9D1}\u{1F3FB}‍\u{1F91D}‍\u{1F9D1}\u{1F3FB}")).toEqual({
    id: "people-holding-hands",
    skinTone: "light",
  });
});

test("extractEmojis works without Intl.Segmenter", async () => {
  serveSymbolManifest();
  vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
  const { extractEmojis } = await importFresh();

  const found = await extractEmojis("hi \u{1F44B}\u{1F3FD} \u{1F468}‍\u{1F469}‍\u{1F467} 1️⃣");
  vi.unstubAllGlobals();

  expect(found).toEqual([
    {
      id: "waving-hand",
      skinTone: "medium",
      text: "\u{1F44B}\u{1F3FD}",
      index: 3,
      length: 4,
    },
    {
      id: "family",
      text: "\u{1F468}‍\u{1F469}‍\u{1F467}",
      index: 8,
      length: 8,
    },
    { id: "keycap-1", text: "1️⃣", index: 17, length: 3 },
  ]);
});

test("searchEmojis treats a non finite positive limit as unlimited and 0 as empty", async () => {
  serveSymbolManifest();
  const { searchEmojis } = await importFresh();

  expect(await searchEmojis("a", { limit: 0 })).toEqual([]);
  expect(await searchEmojis("a", { limit: NaN })).toHaveLength(6);
  expect(await searchEmojis("a", { limit: -3 })).toHaveLength(6);
  expect(await searchEmojis("a", { limit: Infinity })).toHaveLength(6);
  expect(await searchEmojis("a", { limit: 2 })).toHaveLength(2);
});

const buildManifest = (emoticons: { id: string; unicode: string; diverse?: true }[]) => ({
  categories: [
    {
      id: "all",
      title: "All",
      description: "All",
      emoticons: emoticons.map((emoticon) => ({
        ...emoticon,
        description: emoticon.id,
        etag: emoticon.id,
        animation: { framesCount: 10 },
      })),
    },
  ],
});

const serveManifest = (manifest: ReturnType<typeof buildManifest>) => {
  server.use(http.get(MANIFEST_URL, () => HttpResponse.json(manifest)));
};

test("a shared glyph resolves to the first entry in catalog order", async () => {
  serveManifest(
    buildManifest([
      { id: "base", unicode: "❤" },
      { id: "variant", unicode: "❤️" },
    ]),
  );
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("❤")).toEqual({ id: "base" });
});

test("a code point prefixed id wins over catalog order and overrides", async () => {
  serveManifest(
    buildManifest([
      { id: "holdon", unicode: "⌛" },
      { id: "recycle", unicode: "♻" },
      { id: "windturbine", unicode: "♻" },
      { id: "267b_recycling", unicode: "♻" },
      { id: "231b_hourglassdone", unicode: "⌛" },
    ]),
  );
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("⌛")).toEqual({ id: "231b_hourglassdone" });
  expect(await findEmojiByUnicode("♻")).toEqual({ id: "267b_recycling" });
});

test("an override wins only when its id exists in the manifest", async () => {
  serveManifest(
    buildManifest([
      { id: "windturbine", unicode: "♻" },
      { id: "recycle", unicode: "♻" },
      { id: "bartlett", unicode: "⚽" },
      { id: "other", unicode: "⚽" },
    ]),
  );
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("♻")).toEqual({ id: "recycle" });
  expect(await findEmojiByUnicode("⚽")).toEqual({ id: "bartlett" });
});

test("the live shared groups resolve to the canonical emoji", async () => {
  serveManifest(
    buildManifest([
      { id: "heart", unicode: "❤️" },
      { id: "rainbowheart2", unicode: "❤️" },
      { id: "cactuslove", unicode: "❤️" },
      { id: "windturbine", unicode: "♻️" },
      { id: "vegetablegarden", unicode: "♻️" },
      { id: "recycle", unicode: "♻️" },
      { id: "hearteyes", unicode: "😍" },
      { id: "hearteyeskoala", unicode: "😍" },
      { id: "holdon", unicode: "⌛" },
      { id: "231b_hourglassdone", unicode: "⌛" },
      { id: "cooldog", unicode: "🐶" },
      { id: "smiledog", unicode: "🐶" },
      { id: "coolkoala", unicode: "🐨" },
      { id: "koala", unicode: "🐨" },
      { id: "sarcastic", unicode: "👏" },
      { id: "clap", unicode: "👏" },
      { id: "thewave1", unicode: "🙌" },
      { id: "handsinair", unicode: "🙌" },
      { id: "bartlett", unicode: "⚽" },
      { id: "soccerball", unicode: "⚽" },
      { id: "wingleft", unicode: "🪽" },
      { id: "wing", unicode: "🪽" },
    ]),
  );
  const { findEmojiByUnicode } = await importFresh();

  const resolved = await Promise.all(
    ["❤️", "♻️", "😍", "⌛", "🐶", "🐨", "👏", "🙌", "⚽", "🪽"].map(async (glyph) => {
      const match = await findEmojiByUnicode(glyph);
      return match?.id;
    }),
  );

  expect(resolved).toEqual([
    "heart",
    "recycle",
    "hearteyes",
    "231b_hourglassdone",
    "smiledog",
    "koala",
    "clap",
    "handsinair",
    "soccerball",
    "wing",
  ]);
});

test("a skin tone falls back to a diverse entry sharing the glyph", async () => {
  serveManifest(
    buildManifest([
      { id: "like", unicode: "👍" },
      { id: "yes", unicode: "👍", diverse: true },
    ]),
  );
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("👍")).toEqual({ id: "like" });
  expect(await findEmojiByUnicode("👍🏽")).toEqual({
    id: "yes",
    skinTone: "medium",
  });
});

test("a skin tone is ignored when no entry sharing the glyph is diverse", async () => {
  serveManifest(buildManifest([{ id: "soccerball", unicode: "⚽" }]));
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("⚽🏻")).toBeUndefined();
});

test("a skin tone applies when the canonical entry is diverse", async () => {
  serveManifest(
    buildManifest([
      { id: "other", unicode: "👋" },
      { id: "1f44b_wavinghand", unicode: "👋", diverse: true },
    ]),
  );
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("👋🏻")).toEqual({
    id: "1f44b_wavinghand",
    skinTone: "light",
  });
});

test("ZWJ catalog glyphs match with or without VS16 while text bases still need it", async () => {
  serveManifest(
    buildManifest([
      { id: "heart-on-fire", unicode: "❤️‍🔥" },
      { id: "rainbow-flag", unicode: "🏳️‍🌈" },
      { id: "copyright", unicode: "©️" },
    ]),
  );
  const { findEmojiByUnicode } = await importFresh();

  expect(await findEmojiByUnicode("❤‍🔥")).toEqual({ id: "heart-on-fire" });
  expect(await findEmojiByUnicode("❤️‍🔥")).toEqual({ id: "heart-on-fire" });
  expect(await findEmojiByUnicode("🏳‍🌈")).toEqual({ id: "rainbow-flag" });
  expect(await findEmojiByUnicode("©")).toBeUndefined();
  expect(await findEmojiByUnicode("©️")).toEqual({ id: "copyright" });
});

test("searchEmojis floors a fractional limit", async () => {
  serveSymbolManifest();
  const { searchEmojis } = await importFresh();

  expect(await searchEmojis("a", { limit: 2.5 })).toHaveLength(2);
  expect(await searchEmojis("a", { limit: 0.5 })).toEqual([]);
});

const SHORTCODE_MANIFEST = buildManifest([
  { id: "1f603_grinningfacewithbigeyes", unicode: "😃" },
  { id: "1f680_launch", unicode: "🚀" },
  { id: "1f983_turkey", unicode: "🦃" },
  { id: "turkey", unicode: "🍗" },
  { id: "2602_umbrella", unicode: "☂" },
  { id: "umbrella", unicode: "☔" },
  { id: "1f4f7_camera", unicode: "📷" },
  { id: "camera", unicode: "📸" },
  { id: "fire", unicode: "🔥" },
]);

test("findEmojiByShortcode resolves exact ids and ids without their prefix", async () => {
  serveManifest(SHORTCODE_MANIFEST);
  const { findEmojiByShortcode } = await importFresh();

  expect(await findEmojiByShortcode(":fire:")).toEqual({ id: "fire" });
  expect(await findEmojiByShortcode(":launch:")).toEqual({
    id: "1f680_launch",
  });
  expect(await findEmojiByShortcode(":grinningfacewithbigeyes:")).toEqual({
    id: "1f603_grinningfacewithbigeyes",
  });
  expect(await findEmojiByShortcode(":1f680_launch:")).toEqual({
    id: "1f680_launch",
  });
});

test("plain ids win collisions and prefixed ids stay reachable", async () => {
  serveManifest(SHORTCODE_MANIFEST);
  const { findEmojiByShortcode } = await importFresh();

  for (const name of ["turkey", "umbrella", "camera"]) {
    expect(await findEmojiByShortcode(`:${name}:`)).toEqual({ id: name });
  }
  expect(await findEmojiByShortcode(":1f983_turkey:")).toEqual({
    id: "1f983_turkey",
  });
  expect(await findEmojiByShortcode(":2602_umbrella:")).toEqual({
    id: "2602_umbrella",
  });
  expect(await findEmojiByShortcode(":1f4f7_camera:")).toEqual({
    id: "1f4f7_camera",
  });
});

test("findEmojiByShortcode ignores case and rejects unknown input", async () => {
  serveManifest(SHORTCODE_MANIFEST);
  const { findEmojiByShortcode } = await importFresh();

  expect(await findEmojiByShortcode(":FIRE:")).toEqual({ id: "fire" });
  expect(await findEmojiByShortcode(":Launch:")).toEqual({ id: "1f680_launch" });
  expect(await findEmojiByShortcode(":nope:")).toBeUndefined();
  expect(await findEmojiByShortcode("fire")).toBeUndefined();
  expect(await findEmojiByShortcode(":fire")).toBeUndefined();
  expect(await findEmojiByShortcode("::")).toBeUndefined();
});

test("extractEmojis finds several shortcodes next to emojis in order", async () => {
  serveManifest(SHORTCODE_MANIFEST);
  const { extractEmojis } = await importFresh();
  const text = "a :launch: b 🔥 c :FIRE: d :nope: e :turkey:";

  expect(await extractEmojis(text)).toEqual([
    { id: "1f680_launch", text: ":launch:", index: 2, length: 8 },
    { id: "fire", text: "🔥", index: 13, length: 2 },
    { id: "fire", text: ":FIRE:", index: 18, length: 6 },
    { id: "turkey", text: ":turkey:", index: 36, length: 8 },
  ]);
});
