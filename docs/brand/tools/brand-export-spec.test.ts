import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  APPLE_TOUCH_SIZE,
  assertSpec,
  bannerHtml,
  COVER_SCALE,
  encodeIco,
  ICO_SIZES,
  KB,
  MARK_SIZES,
  MB,
  WEBP_QUALITY,
} from "./brand-export-spec.mjs";

const emojiUris = ["data:a", "data:b", "data:c"] as const;

function render(theme: "dark" | "light", width = 1280) {
  return bannerHtml({
    width,
    height: width / 2,
    theme,
    lockupSvg: '<svg id="lockup"></svg>',
    fontFaces: "@font-face{font-family:X}",
    emojiUris,
  });
}

describe("constants", () => {
  it("exposes the export sizes and budgets", () => {
    expect(MARK_SIZES).toEqual([16, 32, 48, 128, 512]);
    expect(MB).toBe(1024 * KB);
    expect(COVER_SCALE).toBe(1.5);
    expect(WEBP_QUALITY).toBe(86);
  });
});

describe("favicon constants", () => {
  it("exposes the apple touch and ico sizes", () => {
    expect(APPLE_TOUCH_SIZE).toBe(180);
    expect(ICO_SIZES).toEqual([16, 32, 48]);
  });
});

describe("encodeIco", () => {
  it("packs PNG payloads behind a directory", () => {
    const first = Buffer.from("aaaa");
    const second = Buffer.from("bb");
    const ico = encodeIco([
      { size: 16, data: first },
      { size: 32, data: second },
    ]);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt32LE(14)).toBe(4);
    expect(ico.readUInt32LE(18)).toBe(38);
    expect(ico.readUInt8(22)).toBe(32);
    expect(ico.readUInt32LE(30)).toBe(2);
    expect(ico.readUInt32LE(34)).toBe(42);
    expect(ico.subarray(38, 42)).toEqual(first);
    expect(ico.subarray(42)).toEqual(second);
  });
});

describe("bannerHtml", () => {
  it("renders the dark theme", () => {
    const html = render("dark");
    expect(html).toContain("#0D1715");
    expect(html).toContain("color:#EAF4F1");
    expect(html).toContain("rgba(46,196,160,0.22");
    expect(html).not.toContain("oklch");
  });

  it("renders the light theme", () => {
    const html = render("light");
    expect(html).toContain("oklch(0.983 0.003 174.5)");
    expect(html).toContain("rgba(46,196,160,0.16");
    expect(html).not.toContain("#0D1715");
  });

  it("embeds the lockup, fonts, copy and emojis", () => {
    const html = render("dark");
    expect(html).toContain('<svg id="lockup"></svg>');
    expect(html).toContain("@font-face{font-family:X}");
    expect(html).toContain("Fluent emojis,<br>but they move.");
    expect(html).toContain("Not affiliated with or endorsed by Microsoft.");
    for (const uri of emojiUris) expect(html).toContain(`src="${uri}"`);
  });

  it("scales layout from the 1280px design width", () => {
    expect(render("dark", 1280)).toContain("left:80px");
    expect(render("dark", 640)).toContain("left:40px");
    expect(render("dark", 640)).toContain("width:640px;height:320px");
  });
});

describe("assertSpec", () => {
  let directory: string;
  let imagePath: string;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "brand-spec-"));
    imagePath = path.join(directory, "image.png");
    await sharp({
      create: { width: 16, height: 8, channels: 3, background: "#2ec4a0" },
    })
      .png()
      .toFile(imagePath);
  });

  afterAll(() => rm(directory, { recursive: true, force: true }));

  it("passes and logs the relative path and size", async () => {
    const log = vi.fn();
    await assertSpec(
      imagePath,
      { width: 16, height: 8, maxBytes: 10 * KB },
      { repositoryRoot: directory, log },
    );
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^image\.png \d+ KB$/));
  });

  it("logs through console.log by default", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(vi.fn());
    await assertSpec(imagePath, { width: 16, height: 8, maxBytes: 10 * KB });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("throws on a wrong width", async () => {
    await expect(
      assertSpec(imagePath, { width: 32, height: 8, maxBytes: 10 * KB }),
    ).rejects.toThrow("image.png is 16x8, expected 32x8");
  });

  it("throws on a wrong height", async () => {
    await expect(
      assertSpec(imagePath, { width: 16, height: 16, maxBytes: 10 * KB }),
    ).rejects.toThrow("image.png is 16x8, expected 16x16");
  });

  it("throws when over the byte budget", async () => {
    await expect(assertSpec(imagePath, { width: 16, height: 8, maxBytes: 1 })).rejects.toThrow(
      /image\.png is \d+ bytes, over 1/,
    );
  });
});
