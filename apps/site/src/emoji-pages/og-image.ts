import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const EMOJI_SIZE = 340;
const NAME_FONT_SIZE = 76;
const MAX_NAME_CHARACTERS = 20;

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function nameLines(name: string): string[] {
  const lines: string[] = [""];
  for (const word of name.split(" ")) {
    const current = lines.at(-1) ?? "";
    if (current === "") {
      lines[lines.length - 1] = word;
    } else if (`${current} ${word}`.length > MAX_NAME_CHARACTERS) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  return lines.slice(0, 3);
}

const BACKGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${String(HEIGHT)}">
<defs><radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="880" cy="300" r="560"><stop offset="0" stop-color="#133930"/><stop offset="0.5" stop-color="#0e1f1c"/><stop offset="0.75" stop-color="#0d1915"/><stop offset="1" stop-color="#0d1715"/></radialGradient></defs>
<rect width="${String(WIDTH)}" height="${String(HEIGHT)}" fill="url(#glow)"/>
</svg>`;

const KEPT_TEMPLATE_REGIONS = [
  { left: 60, top: 160, width: 500, height: 90 },
  { left: 60, top: 570, width: 300, height: 30 },
] as const;

/**
 * SVG layer that writes the emoji's name where the template has its headline.
 * @param name - The emoji's English name.
 * @returns The SVG markup, sized like the template.
 */
export function buildOverlaySvg(name: string): string {
  const lines = nameLines(name);
  const firstBaseline = 400 - ((lines.length - 1) * NAME_FONT_SIZE) / 2;
  const text = lines
    .map(
      (line, index) =>
        `<text x="78" y="${String(firstBaseline + index * NAME_FONT_SIZE)}" font-family="Figtree, Helvetica, Arial, sans-serif" font-weight="800" font-size="${String(NAME_FONT_SIZE)}" fill="#f2f7f5">${escapeXml(line)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${String(HEIGHT)}">${text}</svg>`;
}

/**
 * Composes an emoji's Open Graph image: a background matching the brand
 * template, its logo and footer lines, the emoji's PNG on the right and its
 * English name on the left.
 * @param template - The brand `og.png` bytes.
 * @param emojiPng - The emoji's PNG bytes.
 * @param name - The emoji's English name.
 * @returns A 1200x630 PNG.
 */
export async function composeOgImage(
  template: Uint8Array,
  emojiPng: Uint8Array,
  name: string,
): Promise<Buffer> {
  const emoji = await sharp(emojiPng)
    .resize(EMOJI_SIZE, EMOJI_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const kept = await Promise.all(
    KEPT_TEMPLATE_REGIONS.map(async (region) => ({
      input: await sharp(template).extract(region).png().toBuffer(),
      top: region.top,
      left: region.left,
    })),
  );
  return sharp(Buffer.from(BACKGROUND_SVG))
    .composite([
      ...kept,
      { input: Buffer.from(buildOverlaySvg(name)), top: 0, left: 0 },
      {
        input: emoji,
        top: Math.round((HEIGHT - EMOJI_SIZE) / 2) - 20,
        left: 750,
      },
    ])
    .png()
    .toBuffer();
}
