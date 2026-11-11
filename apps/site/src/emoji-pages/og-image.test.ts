import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { buildOverlaySvg, composeOgImage } from "./og-image";

const TEMPLATE = path.resolve(process.cwd(), "../../docs/brand/og/og.png");

async function emojiStub(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 255, g: 120, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("og image", () => {
  it("composes a 1200x630 PNG from the brand template", async () => {
    const image = await composeOgImage(await readFile(TEMPLATE), await emojiStub(), "Fire");
    const metadata = await sharp(image).metadata();
    expect(metadata).toMatchObject({ format: "png", width: 1200, height: 630 });
  });

  it("escapes the name and wraps long names", () => {
    const svg = buildOverlaySvg("Face <with> & a very long name here");
    expect(svg).toContain("&lt;with&gt; &amp;");
    expect(svg.match(/<text/g)?.length).toBeGreaterThan(1);
  });
});
