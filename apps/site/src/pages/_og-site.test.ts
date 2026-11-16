import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import fixture from "../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../gallery/public-index";

const { fetchPng } = vi.hoisted(() => ({ fetchPng: vi.fn() }));

vi.mock("../emoji-pages/fetch-png", () => ({ fetchPng }));
vi.mock("../gallery/public-index", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    loadPublicIndex: () => Promise.resolve(parsePublicIndex(fixture)),
  };
});

import { GET } from "./og-site.png";

async function stubPng(): Promise<ArrayBuffer> {
  const buffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 255, g: 120, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer).buffer;
}

describe("og-site.png endpoint", () => {
  it("composes the site card from the fire emoji", async () => {
    fetchPng.mockResolvedValue(await stubPng());
    const response = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(String(fetchPng.mock.calls[0]?.[0])).toContain("fire");
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(metadata).toMatchObject({ format: "png", width: 1200, height: 630 });
  });
});
