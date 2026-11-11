import { createHash } from "node:crypto";
import { expect, test } from "vitest";

import {
  buildCatalog,
  buildHdOutputPath,
  buildOutputPath,
  hashEtag,
  hashHdEtag,
  PIPELINE_VERSION,
  resolveCategory,
} from "./catalog.js";
import { glyphToCodepoints } from "./codepoints.js";
import type { MitEmoji } from "./mit.js";
import { createTeamsManifest } from "./test-support.js";

const mitEmoji = (overrides: Partial<MitEmoji> = {}): MitEmoji => ({
  codepoints: "1f3c1",
  glyph: "🏁",
  cldr: "chequered flag",
  group: "Flags",
  keywords: ["flag"],
  sprites: [
    {
      toneSuffix: "",
      path: "assets/Chequered flag/a.png",
      blobSha: "deadbeefcafe",
    },
  ],
  ...overrides,
});

const createHashWithVersion = (version: number, identifiers: readonly string[]): string =>
  createHash("sha256")
    .update(JSON.stringify([version, ...identifiers]))
    .digest("hex")
    .slice(0, 8);

const allEmoticons = (catalog: ReturnType<typeof buildCatalog>) =>
  catalog.manifest.categories.flatMap((category) => category.emoticons);

test("buildOutputPath nests sprites by category and tone", () => {
  expect(buildOutputPath("Hand gestures", "1f44b_wavinghand", "_s2")).toBe(
    "sprites/Hand gestures/1f44b_wavinghand_s2.png",
  );
});

test("keeps every Teams emoticon and plans its sprites with tones", () => {
  const catalog = buildCatalog(createTeamsManifest(), []);

  expect(allEmoticons(catalog).map((emoticon) => emoticon.id)).toEqual([
    "1f603_grinningfacewithbigeyes",
    "1f44b_wavinghand",
  ]);
  const waving = catalog.tasks.filter((task) => task.id === "1f44b_wavinghand");
  expect(waving.map((task) => task.toneSuffix)).toEqual(["", "_s2", "_s3", "_s4", "_s5", "_s6"]);
  expect(waving.every((task) => task.source === "teams")).toBe(true);
  expect(waving[1]?.sourceUrl).toContain("/1f44b_wavinghand/default/100_anim_f_s2.png");
});

test("drops earlier duplicates of an id, as the library does", () => {
  const manifest = createTeamsManifest();
  const duplicate = manifest.categories[0]?.emoticons[0];
  if (!duplicate) throw new Error("fixture changed");
  manifest.categories[2]?.emoticons.push({ ...duplicate });

  const catalog = buildCatalog(manifest, []);

  expect(catalog.manifest.categories[0]?.emoticons).toEqual([]);
  expect(catalog.manifest.categories[2]?.emoticons).toHaveLength(1);
  expect(catalog.tasks.filter((task) => task.id === duplicate.id)).toHaveLength(1);
});

test("adds official emojis Teams does not have, by codepoints", () => {
  const catalog = buildCatalog(createTeamsManifest(), [
    mitEmoji(),
    mitEmoji({
      codepoints: "1f603",
      glyph: "😃",
      cldr: "grinning face with big eyes",
      group: "Smileys & Emotion",
    }),
  ]);

  const added = allEmoticons(catalog).filter((emoticon) => catalog.mitEmojiIds.has(emoticon.id));
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({
    id: "1f3c1_chequeredflag",
    description: "Chequered flag",
    unicode: "🏁",
    etag: hashEtag([":deadbeefcafe"]),
    diverse: false,
  });
  expect(
    catalog.manifest.categories
      .find((category) => category.title === "Symbols")
      ?.emoticons.map((emoticon) => emoticon.id),
  ).toEqual(["1f3c1_chequeredflag"]);
  expect(catalog.tasks.at(-1)).toMatchObject({
    source: "mit",
    outputPath: "sprites/Symbols/1f3c1_chequeredflag.png",
    mitPath: "assets/Chequered flag/a.png",
  });
});

test("official emojis with skin tones are marked diverse and get tone tasks", () => {
  const catalog = buildCatalog(createTeamsManifest(), [
    mitEmoji({
      codepoints: "1f595",
      glyph: "🖕",
      cldr: "middle finger",
      group: "People & Body",
      sprites: [
        { toneSuffix: "", path: "a", blobSha: "11111111aa" },
        { toneSuffix: "_s6", path: "b", blobSha: "22222222bb" },
      ],
    }),
  ]);

  const added = allEmoticons(catalog).find((emoticon) => emoticon.id === "1f595_middlefinger");
  expect(added?.diverse).toBe(true);
  expect(
    catalog.tasks.filter((task) => task.id === "1f595_middlefinger").map((task) => task.outputPath),
  ).toEqual([
    "sprites/Hand gestures/1f595_middlefinger.png",
    "sprites/Hand gestures/1f595_middlefinger_s6.png",
  ]);
});

test("resolveCategory maps groups and throws on unknown ones", () => {
  expect(resolveCategory(mitEmoji({ group: "Travel & Places" }))).toBe("Travel and places");
  expect(() => resolveCategory(mitEmoji({ group: "Mystery" }))).toThrow(
    "Unmapped official emoji group",
  );
});

const middleFinger = (): MitEmoji =>
  mitEmoji({
    codepoints: "1f595",
    glyph: "🖕",
    cldr: "middle finger",
    group: "People & Body",
  });

const previousManifestPinning = () => {
  const manifest = createTeamsManifest();
  manifest.categories[1]?.emoticons.push({
    id: "1f595_middlefinger",
    description: "Middle finger",
    shortcuts: [],
    unicode: "🖕",
    etag: "old",
    diverse: false,
    animation: { fps: 0, framesCount: 0, firstFrame: 1 },
    keywords: [],
    origin: "official",
  });
  return manifest;
};

test("marks added official emojis with origin official", () => {
  const catalog = buildCatalog(createTeamsManifest(), [mitEmoji()]);

  expect(
    allEmoticons(catalog).find((emoticon) => emoticon.id === "1f3c1_chequeredflag")?.origin,
  ).toBe("official");
});

test("clamps a Teams poster frame that points past the last frame", () => {
  const teams = createTeamsManifest();
  teams.categories[1]?.emoticons.push({
    id: "lips_teams",
    description: "Lips",
    shortcuts: [],
    unicode: "👄",
    etag: "v1",
    diverse: false,
    animation: { fps: 24, framesCount: 1, firstFrame: 36 },
    keywords: [],
  });

  const catalog = buildCatalog(teams, [], undefined);

  const lips = allEmoticons(catalog).find((emoticon) => emoticon.id === "lips_teams");
  expect(lips?.animation.firstFrame).toBe(1);
});

test("keeps a pinned official id when Teams now has the emoji", () => {
  const teams = createTeamsManifest();
  teams.categories[1]?.emoticons.push({
    id: "middlefinger_teams",
    description: "Middle finger",
    shortcuts: [],
    unicode: "🖕",
    etag: "v1",
    diverse: false,
    animation: { fps: 24, framesCount: 10, firstFrame: 1 },
    keywords: [],
  });

  const catalog = buildCatalog(teams, [middleFinger()], previousManifestPinning());

  const ids = allEmoticons(catalog).map((emoticon) => emoticon.id);
  expect(ids).toContain("middlefinger_teams");
  expect(ids).toContain("1f595_middlefinger");
  expect(catalog.mitEmojiIds.has("1f595_middlefinger")).toBe(true);
  expect(
    catalog.tasks.find((task) => task.id === "1f595_middlefinger" && task.source === "mit"),
  ).toBeDefined();
});

test("fails naming a pinned id whose official source vanished", () => {
  expect(() =>
    buildCatalog(createTeamsManifest(), [mitEmoji()], previousManifestPinning()),
  ).toThrow("1f595_middlefinger");
});

test("every official codepoint is present in the final manifest", () => {
  const mitEmojis = [
    mitEmoji(),
    mitEmoji({
      codepoints: "1f603",
      glyph: "😃",
      cldr: "grinning face with big eyes",
      group: "Smileys & Emotion",
    }),
    mitEmoji({
      codepoints: "1f44b",
      glyph: "👋",
      cldr: "waving hand",
      group: "People & Body",
    }),
  ];

  const catalog = buildCatalog(createTeamsManifest(), mitEmojis);

  const published = new Set(
    allEmoticons(catalog).map((emoticon) => glyphToCodepoints(emoticon.unicode)),
  );
  for (const emoji of mitEmojis) {
    expect(published.has(emoji.codepoints), emoji.cldr).toBe(true);
  }
});

const toneSprites = (toneSha: string): MitEmoji["sprites"] => [
  { toneSuffix: "", path: "a.png", blobSha: "aaaa" },
  { toneSuffix: "_s2", path: "b.png", blobSha: toneSha },
];

const officialEtagFor = (toneSha: string): string | undefined => {
  const catalog = buildCatalog(createTeamsManifest(), [
    mitEmoji({ sprites: toneSprites(toneSha) }),
  ]);
  return allEmoticons(catalog).find((emoticon) => emoticon.id === "1f3c1_chequeredflag")?.etag;
};

test("an official etag changes when any tone source changes", () => {
  expect(officialEtagFor("bbbb")).toBe(officialEtagFor("bbbb"));
  expect(officialEtagFor("bbbb")).not.toBe(officialEtagFor("cccc"));
});

test("hashEtag depends on the pipeline version", () => {
  const current = hashEtag(["aaaa"]);
  expect(current).toMatch(/^[\da-f]{8}$/);
  expect(PIPELINE_VERSION).toBeGreaterThan(0);
  const bumped = createHashWithVersion(PIPELINE_VERSION + 1, ["aaaa"]);
  expect(bumped).not.toBe(current);
});

const TONE_SUFFIXES = ["", "_s2", "_s3", "_s4", "_s5", "_s6"];

const wavingHand = (suffixes: readonly string[]): MitEmoji =>
  mitEmoji({
    codepoints: "1f44b",
    glyph: "👋",
    cldr: "waving hand",
    group: "People & Body",
    sprites: suffixes.map((toneSuffix) => ({
      toneSuffix,
      path: `assets/Waving hand/${toneSuffix}.png`,
      blobSha: `wave${toneSuffix}`,
    })),
  });

test("buildHdOutputPath puts @2x before the extension, after the tone", () => {
  expect(buildHdOutputPath("Smilies", "1f603_x", "")).toBe("sprites/Smilies/1f603_x@2x.png");
  expect(buildHdOutputPath("Hand gestures", "1f44b_wavinghand", "_s3")).toBe(
    "sprites/Hand gestures/1f44b_wavinghand_s3@2x.png",
  );
});

test("plans HD tasks for Teams emojis matching an official one, every tone", () => {
  const catalog = buildCatalog(createTeamsManifest(), [wavingHand(TONE_SUFFIXES)]);

  const waving = catalog.tasks.filter((task) => task.id === "1f44b_wavinghand");
  expect(waving.map((task) => task.hdOutputPath)).toEqual(
    TONE_SUFFIXES.map((suffix) => `sprites/Hand gestures/1f44b_wavinghand${suffix}@2x.png`),
  );
  expect(waving[1]).toMatchObject({
    hdMitPath: "assets/Waving hand/_s2.png",
    hdBlobSha: "wave_s2",
  });
  const smiley = catalog.tasks.find((task) => task.id === "1f603_grinningfacewithbigeyes");
  expect(smiley?.hdOutputPath).toBeUndefined();
  expect(catalog.hdSkipped).toEqual([]);
});

test("gives no HD to a diverse emoji whose official source lacks a tone", () => {
  const catalog = buildCatalog(createTeamsManifest(), [wavingHand(["", "_s2", "_s3"])]);

  const waving = catalog.tasks.filter((task) => task.id === "1f44b_wavinghand");
  expect(waving.some((task) => task.hdOutputPath !== undefined)).toBe(false);
  expect(catalog.hdSkipped).toHaveLength(1);
  expect(catalog.hdSkipped[0]?.id).toBe("1f44b_wavinghand");
  expect(catalog.hdSkipped[0]?.reason).toContain("_s4, _s5, _s6");
});

test("plans HD for official-only emojis from their own sprites", () => {
  const catalog = buildCatalog(createTeamsManifest(), [mitEmoji()]);

  expect(catalog.tasks.at(-1)).toMatchObject({
    source: "mit",
    hdOutputPath: "sprites/Symbols/1f3c1_chequeredflag@2x.png",
    hdMitPath: "assets/Chequered flag/a.png",
    hdBlobSha: "deadbeefcafe",
  });
});

test("hashHdEtag changes with the HD source and is independent of order", () => {
  const sources = [
    { toneSuffix: "", blobSha: "a" },
    { toneSuffix: "_s2", blobSha: "b" },
  ];
  const hash = hashHdEtag("v5", sources);

  expect(hashHdEtag("v5", sources.toReversed())).toBe(hash);
  const changedSources = [
    { toneSuffix: "", blobSha: "a2" },
    { toneSuffix: "_s2", blobSha: "b" },
  ];
  expect(hashHdEtag("v5", changedSources)).not.toBe(hash);
  expect(hashHdEtag("v6", sources)).not.toBe(hash);
  expect(hash).not.toBe(hashEtag(["v5"]));
});
