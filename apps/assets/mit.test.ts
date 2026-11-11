import { expect, test } from "vitest";

import { buildMitMediaUrl, groupTreeByEmoji, loadMitIndex } from "./mit.js";
import { createFakeFetch } from "./test-support.js";

const SHA = "f".repeat(40);
const API = "https://api.github.com/repos/microsoft/fluentui-emoji-animated";

const blob = (path: string, sha = "abcdef123456") => ({
  path,
  type: "blob",
  sha,
});

const TREE = [
  blob("assets/Middle finger/metadata.json"),
  blob("assets/Middle finger/animated/middle_finger_animated.png", "111111aa"),
  blob("assets/Thumbs up/metadata.json"),
  blob("assets/Thumbs up/Default/animated/thumbs_up_animated_default.png"),
  blob("assets/Thumbs up/Dark/animated/thumbs_up_animated_dark.png"),
  blob("assets/Thumbs up/Medium-Light/animated/thumbs_up_animated_medium-light.png"),
  blob("assets/No sprites/metadata.json"),
  blob("README.md"),
];

const metadata = (unicode: string, cldr: string) => ({
  body: {
    cldr,
    glyph: "x",
    group: "People & Body",
    keywords: ["k"],
    unicode,
  },
});

test("groupTreeByEmoji maps plain and skin tone sprites", () => {
  const grouped = groupTreeByEmoji(TREE);

  expect(grouped.get("Middle finger")?.sprites.map((s) => s.toneSuffix)).toEqual([""]);
  expect(grouped.get("Thumbs up")?.sprites.map((sprite) => sprite.toneSuffix)).toEqual([
    "",
    "_s6",
    "_s3",
  ]);
  expect(grouped.get("No sprites")?.sprites).toEqual([]);
  expect(grouped.has("README.md")).toBe(false);
});

test("buildMitMediaUrl encodes each path segment", () => {
  expect(buildMitMediaUrl(SHA, "assets/Thumbs up/Default/a.png")).toBe(
    `https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/${SHA}/assets/Thumbs%20up/Default/a.png`,
  );
});

test("loadMitIndex reads the commit, tree and metadata of emojis with sprites", async () => {
  const { fetch } = createFakeFetch({
    [`GET ${API}/commits/main`]: { body: { sha: SHA } },
    [`GET ${API}/git/trees/${SHA}?recursive=1`]: {
      body: { truncated: false, tree: TREE },
    },
    [`GET https://raw.githubusercontent.com/microsoft/fluentui-emoji-animated/${SHA}/assets/Middle%20finger/metadata.json`]:
      metadata("1f595", "middle finger"),
    [`GET https://raw.githubusercontent.com/microsoft/fluentui-emoji-animated/${SHA}/assets/Thumbs%20up/metadata.json`]:
      metadata("1F44D FE0F", "thumbs up"),
  });

  const index = await loadMitIndex(fetch);

  expect(index.commitSha).toBe(SHA);
  expect(index.emojis.map((emoji) => emoji.codepoints)).toEqual(["1f595", "1f44d"]);
  expect(index.emojis[1]?.sprites).toHaveLength(3);
});

test("loadMitIndex rejects a truncated tree", async () => {
  const { fetch } = createFakeFetch({
    [`GET ${API}/commits/main`]: { body: { sha: SHA } },
    [`GET ${API}/git/trees/${SHA}?recursive=1`]: {
      body: { truncated: true, tree: [] },
    },
  });

  await expect(loadMitIndex(fetch)).rejects.toThrow("truncated");
});

test("loadMitIndex names the emoji whose metadata is invalid", async () => {
  const { fetch } = createFakeFetch({
    [`GET ${API}/commits/main`]: { body: { sha: SHA } },
    [`GET ${API}/git/trees/${SHA}?recursive=1`]: {
      body: { truncated: false, tree: TREE },
    },
    [`GET https://raw.githubusercontent.com/microsoft/fluentui-emoji-animated/${SHA}/assets/Middle%20finger/metadata.json`]:
      metadata("1f595", "middle finger"),
    [`GET https://raw.githubusercontent.com/microsoft/fluentui-emoji-animated/${SHA}/assets/Thumbs%20up/metadata.json`]:
      { body: { cldr: "thumbs up" } },
  });

  await expect(loadMitIndex(fetch)).rejects.toThrow(
    "Invalid metadata for official emoji at assets/Thumbs up/metadata.json",
  );
});

test("every tone sprite of the official repository resolves to a media URL", () => {
  const sprites = groupTreeByEmoji(TREE).get("Thumbs up")?.sprites ?? [];

  expect(sprites.map((sprite) => sprite.toneSuffix).toSorted((a, b) => a.localeCompare(b))).toEqual(
    ["", "_s3", "_s6"],
  );
  for (const sprite of sprites) {
    expect(buildMitMediaUrl(SHA, sprite.path)).toBe(
      `https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/${SHA}/${sprite.path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`,
    );
  }
});
