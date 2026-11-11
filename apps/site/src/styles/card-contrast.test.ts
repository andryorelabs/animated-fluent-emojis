import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(
  new URL("../../../../docs/brand/tokens.css", import.meta.url),
  "utf8",
);

type Rgb = [number, number, number];

function themeBlock(selector: string): string {
  const start = tokensCss.indexOf(`${selector} {`);
  return tokensCss.slice(start, tokensCss.indexOf("\n}", start));
}

function resolveToken(block: string, name: string): string {
  const match = new RegExp(String.raw`--${name}:\s*([^;]+);`).exec(block);
  if (!match) throw new Error(`Missing --${name}`);
  const value = (match[1] ?? "").trim();
  const reference = /^var\(--([\w-]+)\)$/.exec(value);
  return reference ? resolveToken(block, reference[1] ?? "") : value;
}

function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function color(block: string, name: string): Rgb {
  const value = resolveToken(block, name);
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  if (!match) throw new Error(`Unsupported colour for --${name}: ${value}`);
  return oklchToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: Rgb, second: Rgb): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

const TEXT_PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-text", "background"],
  ["primary-text", "card"],
  ["primary-foreground", "primary"],
] as const;

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("%s theme surfaces", (_name, selector) => {
  const block = themeBlock(selector);

  it.each(TEXT_PAIRS)("keeps --%s at least 4.5:1 on --%s", (text, surface) => {
    expect(contrast(color(block, text), color(block, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the card border visible against the card", () => {
    expect(contrast(color(block, "border"), color(block, "card"))).toBeGreaterThanOrEqual(1.05);
  });
});
