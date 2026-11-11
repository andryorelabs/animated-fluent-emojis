import { describe, expect, it } from "vitest";

import { parseGalleryUrl, serializeGalleryUrl } from "./url-state";

describe("gallery url state", () => {
  it("round-trips the filters and the size", () => {
    const state = {
      query: "fire",
      tone: "dark",
      category: "Smilies",
      size: 128,
    } as const;
    expect(parseGalleryUrl(serializeGalleryUrl(state))).toEqual(state);
  });

  it("serializes to an empty string with no filter", () => {
    expect(
      serializeGalleryUrl({
        query: " ",
        tone: undefined,
        category: undefined,
        size: 64,
      }),
    ).toBe("");
  });

  it("drops unknown tones and blank categories", () => {
    expect(parseGalleryUrl("?tone=purple&c=")).toEqual({
      query: "",
      tone: undefined,
      category: undefined,
      size: 64,
    });
  });

  it("writes the size only when it is not 64", () => {
    const base = { query: "", tone: undefined, category: undefined };
    expect(serializeGalleryUrl({ ...base, size: 96 })).toBe("?s=96");
    expect(serializeGalleryUrl({ ...base, size: 64 })).toBe("");
  });

  it("falls back to 64 for unknown sizes", () => {
    expect(parseGalleryUrl("?s=100").size).toBe(64);
    expect(parseGalleryUrl("?s=abc").size).toBe(64);
    expect(parseGalleryUrl("?s=96").size).toBe(96);
  });

  it("keeps non-ASCII queries", () => {
    const state = {
      query: "fuego ñ",
      tone: undefined,
      category: undefined,
      size: 64,
    } as const;
    expect(parseGalleryUrl(serializeGalleryUrl(state)).query).toBe("fuego ñ");
  });
});
