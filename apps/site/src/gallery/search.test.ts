import { describe, expect, it } from "vitest";

import { parseCldrAnnotations } from "./annotations";
import cldrEs from "./fixtures/cldr-es.json";
import publicIndexFixture from "./fixtures/public-index.json";
import { parsePublicIndex } from "./public-index";
import { buildSearchIndex, searchEmojis } from "./search";

const emojis = parsePublicIndex(publicIndexFixture);

describe("search", () => {
  const spanishIndex = buildSearchIndex(emojis, parseCldrAnnotations(cldrEs));

  it('finds the fire emoji for "fuego" in es', () => {
    expect(searchEmojis(spanishIndex, "fuego")[0]).toBe("fire");
  });

  it("still finds English terms in es", () => {
    expect(searchEmojis(spanishIndex, "waving")).toContain("waving-hand");
  });

  it("searches English when a locale has no annotations", () => {
    const fallbackIndex = buildSearchIndex(emojis, new Map());
    expect(searchEmojis(fallbackIndex, "fire")[0]).toBe("fire");
    expect(searchEmojis(fallbackIndex, "fuego")).toEqual([]);
  });

  it("ranks exact names above prefixes and keywords", () => {
    const index = [
      { slug: "keyword", name: "Other", keywords: ["face"] },
      { slug: "prefix", name: "Faceplant", keywords: [] },
      { slug: "exact", name: "Face", keywords: [] },
    ];
    expect(searchEmojis(index, "face")).toEqual(["exact", "prefix", "keyword"]);
  });

  it("ignores accents and blank queries", () => {
    expect(searchEmojis(spanishIndex, "FUEGO ")).toContain("fire");
    expect(searchEmojis(spanishIndex, "  ")).toEqual([]);
  });
});
