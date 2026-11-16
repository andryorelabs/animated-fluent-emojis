import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Annotations from "../gallery/annotations";

const { loadPublicIndex, loadAnnotations } = vi.hoisted(() => ({
  loadPublicIndex: vi.fn(),
  loadAnnotations: vi.fn(),
}));

vi.mock("../gallery/public-index", () => ({ loadPublicIndex }));
vi.mock("../gallery/annotations", async (importOriginal) => ({
  ...(await importOriginal<typeof Annotations>()),
  loadAnnotations,
}));

import { loadEmojiPageData } from "./data";

const emojis = [
  { slug: "fire", unicode: "🔥", description: "fire", keywords: ["flame"] },
  { slug: "star", unicode: "⭐", description: "star", keywords: [] },
];

describe("loadEmojiPageData", () => {
  beforeEach(() => {
    loadPublicIndex.mockReset().mockResolvedValue(emojis);
    loadAnnotations.mockReset().mockResolvedValue(new Map());
  });

  it("keys the localized entries by slug", async () => {
    const data = await loadEmojiPageData("en");
    expect(data.emojis).toBe(emojis);
    expect(data.names.keys().toArray()).toEqual(["fire", "star"]);
  });

  it("loads each locale once and shares the result", async () => {
    const first = loadEmojiPageData("es");
    const second = loadEmojiPageData("es");
    expect(second).toBe(first);
    await first;
    expect(loadAnnotations).toHaveBeenCalledTimes(1);
    expect(loadAnnotations).toHaveBeenCalledWith("es");
  });
});
