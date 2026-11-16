import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "../../gallery/fixtures/public-index.json";
import { parsePublicIndex } from "../../gallery/public-index";

const { fetchPng } = vi.hoisted(() => ({ fetchPng: vi.fn() }));

vi.mock("../../emoji-pages/fetch-png", () => ({ fetchPng }));
vi.mock("../../gallery/public-index", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    loadPublicIndex: () => Promise.resolve(parsePublicIndex(fixture)),
  };
});

import { GET, getStaticPaths } from "./[slug].png";

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

function call(slug: string) {
  return GET({ params: { slug } } as unknown as Parameters<typeof GET>[0]);
}

describe("og emoji image endpoint", () => {
  beforeEach(async () => {
    fetchPng.mockReset().mockResolvedValue(await stubPng());
  });

  it("lists one path per emoji", async () => {
    const paths = await getStaticPaths();
    expect(paths).toHaveLength(parsePublicIndex(fixture).length);
    expect(paths).toContainEqual({ params: { slug: "fire" } });
  });

  it("composes a 1200x630 PNG for a known emoji", async () => {
    const response = await call("fire");
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(metadata).toMatchObject({ format: "png", width: 1200, height: 630 });
  });

  it("rejects an unknown emoji", async () => {
    await expect(call("nope")).rejects.toThrow('Unknown emoji "nope"');
  });
});
