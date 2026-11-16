import { describe, expect, it, vi } from "vitest";

import fixture from "../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../gallery/public-index";
import { GET } from "./sitemap.xml";

vi.mock("../gallery/public-index", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    loadPublicIndex: () => Promise.resolve(parsePublicIndex(fixture)),
  };
});

describe("sitemap.xml endpoint", () => {
  it("serves the sitemap of every registered source as XML", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body.match(/<loc>/g)).toHaveLength(180 + parsePublicIndex(fixture).length * 10);
  });
});
