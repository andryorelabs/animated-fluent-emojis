import { describe, expect, it, vi } from "vitest";

import { loadAnnotations, localizeEmojis, parseCldrAnnotations } from "./annotations";
import cldrEs from "./fixtures/cldr-es.json";
import publicIndexFixture from "./fixtures/public-index.json";
import { parsePublicIndex } from "./public-index";

const emojis = parsePublicIndex(publicIndexFixture);

describe("annotations", () => {
  const spanish = parseCldrAnnotations(cldrEs);

  it("joins annotations by unicode and falls back to English", () => {
    const localized = localizeEmojis(emojis, new Map());
    expect(localized.every((entry) => entry.fellBack)).toBe(true);
    expect(localized.find((entry) => entry.slug === "fire")?.name).toBe("Fire");
    expect(localizeEmojis(emojis, spanish).find((entry) => entry.slug === "fire")?.name).toBe(
      "fuego",
    );
  });

  it("rejects a document without annotations", () => {
    expect(() => parseCldrAnnotations({})).toThrow(/unexpected/);
  });

  it("downloads a locale once and fails on an HTTP error", async () => {
    const fetcher = vi.fn(() => Promise.resolve(Response.json(cldrEs)));
    await loadAnnotations("es", fetcher);
    await loadAnnotations("es", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/es/"));
    await expect(
      loadAnnotations("de", () => Promise.resolve(new Response("", { status: 404 }))),
    ).rejects.toThrow(/404/);
  });

  it("uses no annotations for English", async () => {
    const table = await loadAnnotations("en");
    expect(table.size).toBe(0);
  });
});
