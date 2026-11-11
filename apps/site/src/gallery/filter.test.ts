import { describe, expect, it } from "vitest";

import { parseCldrAnnotations } from "./annotations";
import { effectiveTone, filterEmojis, listCategories, urlsForTone } from "./filter";
import cldrEs from "./fixtures/cldr-es.json";
import publicIndexFixture from "./fixtures/public-index.json";
import { parsePublicIndex } from "./public-index";
import { buildSearchIndex } from "./search";

const emojis = parsePublicIndex(publicIndexFixture);
const spanish = buildSearchIndex(emojis, parseCldrAnnotations(cldrEs));

describe("gallery filter", () => {
  it("lists categories in first-seen order", () => {
    expect(listCategories(emojis)).toEqual([...new Set(emojis.map((emoji) => emoji.category))]);
  });

  it("returns everything for a blank query", () => {
    expect(filterEmojis(emojis, spanish, { query: "", category: undefined })).toHaveLength(
      emojis.length,
    );
  });

  it("searches the localized names", () => {
    const hits = filterEmojis(emojis, spanish, {
      query: "fuego",
      category: undefined,
    });
    expect(hits[0]?.slug).toBe("fire");
  });

  it("narrows a search by category", () => {
    const hits = filterEmojis(emojis, spanish, {
      query: "fuego",
      category: "Smilies",
    });
    expect(hits.every((emoji) => emoji.category === "Smilies")).toBe(true);
  });

  it("ignores a tone the emoji does not have", () => {
    const plain = emojis.find((emoji) => emoji.tones.length === 0);
    expect(plain && effectiveTone(plain, "dark")).toBeUndefined();
    const diverse = emojis.find((emoji) => emoji.tones.length > 0);
    const first = diverse?.tones[0]?.tone;
    expect(diverse && effectiveTone(diverse, first)).toBe(first);
  });

  it("picks the files of the applied tone and falls back to the base ones", () => {
    const diverse = emojis.find((emoji) => emoji.tones.length > 0);
    const variant = diverse?.tones[0];
    expect(diverse && urlsForTone(diverse, variant?.tone)).toBe(variant?.urls);
    expect(diverse && urlsForTone(diverse, undefined)).toBe(diverse?.urls);
    const plain = emojis.find((emoji) => emoji.tones.length === 0);
    expect(plain && urlsForTone(plain, "dark")).toBe(plain?.urls);
  });
});
