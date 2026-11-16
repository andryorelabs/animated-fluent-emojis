import { describe, expect, it, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../../gallery/public-index";
import { LOCALES, localeSegment } from "../../i18n/locales";
import { GET, getStaticPaths } from "./[locale].json";

vi.mock("../../gallery/public-index", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    loadPublicIndex: () => Promise.resolve(parsePublicIndex(fixture)),
  };
});

function call(locale: string) {
  return GET({ params: { locale } } as unknown as Parameters<typeof GET>[0]);
}

describe("search index endpoint", () => {
  it("lists one path per locale segment", () => {
    expect(getStaticPaths()).toEqual(
      LOCALES.map((locale) => ({ params: { locale: localeSegment(locale) } })),
    );
  });

  it("serves the English index as JSON", async () => {
    const response = await call("en");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const entries = (await response.json()) as unknown[];
    expect(entries).toHaveLength(parsePublicIndex(fixture).length);
  });

  it("rejects an unknown locale segment", async () => {
    await expect(call("xx")).rejects.toThrow('Unknown locale "xx"');
  });
});
