import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

import {
  APPLE_TOUCH_SIZE,
  assertSpec as assertImageSpec,
  bannerHtml as buildBannerHtml,
  COVER_SCALE,
  encodeIco,
  ICO_SIZES,
  KB,
  MARK_SIZES,
  MB,
  WEBP_QUALITY,
} from "./brand-export-spec.mjs";

/**
 * Regenerates the derived raster assets of the brand kit from the SVG sources in
 * `docs/brand/logo`: the PNG marks, the README covers (`docs/assets/Cover.webp` and `Cover-light.webp`),
 * the GitHub social preview, the Open Graph image (`docs/brand/og/`) and the
 * site favicon set in `apps/site/public` (SVG, ICO and apple touch icon). Run with
 * `bun run brand:export`.
 *
 * Fonts are embedded from `docs/brand/brandbook/fonts`, so output does not
 * depend on fonts installed on the host. The three emojis on the cover come
 * from the README's own files in `docs/assets`. The script throws when an image
 * misses its exact pixel size or byte budget: GitHub rejects a social preview
 * over 1 MB, and the Open Graph image stays under 300 KB.
 */
const brandRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(brandRoot, "../..");
const siteIconsRoot = path.join(repositoryRoot, "apps/site/public");
const fontsRoot = path.join(brandRoot, "brandbook/fonts");
const assetsRoot = path.join(repositoryRoot, "docs/assets");

const browser = await chromium.launch();

const markSvg = await readFile(path.join(brandRoot, "logo/mark.svg"), "utf8");
const lockupSvgs = {
  dark: await readFile(path.join(brandRoot, "logo/lockup-horizontal-dark.svg"), "utf8"),
  light: await readFile(path.join(brandRoot, "logo/lockup-horizontal.svg"), "utf8"),
};

async function readBase64(filePath) {
  const buffer = await readFile(filePath);
  return buffer.toString("base64");
}

const fontRules = await Promise.all(
  [
    ["Figtree", "Figtree-var.woff2", "300 900"],
    ["Geist Mono", "GeistMono-var.woff2", "100 900"],
  ].map(async ([family, fileName, weight]) => {
    const data = await readBase64(path.join(fontsRoot, fileName));
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`;
  }),
);
const fontFaces = fontRules.join("");

const emojiFiles = ["rocket-launch.webp", "fire.webp", "hundred-points.webp"];
const emojiUris = await Promise.all(
  emojiFiles.map(async (fileName) => {
    const data = await readBase64(path.join(assetsRoot, fileName));
    return `data:image/webp;base64,${data}`;
  }),
);

async function renderMark(size, outPath) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<style>svg{display:block;width:100%;height:100%}</style>` +
      `<body style="margin:0;width:${size}px;height:${size}px">${markSvg}</body>`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, omitBackground: true });
  await page.close();
  await assertSpec(outPath, { width: size, height: size, maxBytes: 200 * KB });
}

function bannerHtml(width, height, theme) {
  return buildBannerHtml({
    width,
    height,
    theme,
    lockupSvg: lockupSvgs[theme],
    fontFaces,
    emojiUris,
  });
}

async function renderBanner({ width, height, scale = 1, theme = "dark" }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await page.setContent(bannerHtml(width, height, theme));
  await page.waitForFunction('document.fonts.status === "loaded"');
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  return buffer;
}

function assertSpec(outPath, spec) {
  return assertImageSpec(outPath, spec, { repositoryRoot });
}

try {
  for (const size of MARK_SIZES) {
    await renderMark(size, path.join(brandRoot, "logo/png", `mark-${size}.png`));
  }

  await mkdir(siteIconsRoot, { recursive: true });
  await copyFile(path.join(brandRoot, "logo/mark.svg"), path.join(siteIconsRoot, "favicon.svg"));
  const appleTouchPath = path.join(siteIconsRoot, "apple-touch-icon.png");
  await renderMark(APPLE_TOUCH_SIZE, appleTouchPath);
  const icoImages = await Promise.all(
    ICO_SIZES.map(async (size) => ({
      size,
      data: await readFile(path.join(brandRoot, "logo/png", `mark-${size}.png`)),
    })),
  );
  await writeFile(path.join(siteIconsRoot, "favicon.ico"), encodeIco(icoImages));

  const ogRoot = path.join(brandRoot, "og");
  await mkdir(ogRoot, { recursive: true });
  const socialPath = path.join(ogRoot, "social-preview.png");
  await sharp(await renderBanner({ width: 1280, height: 640 }))
    .png({ compressionLevel: 9 })
    .toFile(socialPath);
  await assertSpec(socialPath, { width: 1280, height: 640, maxBytes: 1 * MB });

  const ogPath = path.join(ogRoot, "og.png");
  await sharp(await renderBanner({ width: 1200, height: 630 }))
    .png({ compressionLevel: 9, palette: true })
    .toFile(ogPath);
  await assertSpec(ogPath, { width: 1200, height: 630, maxBytes: 300 * KB });

  const coverSpec = {
    width: 1280 * COVER_SCALE,
    height: 640 * COVER_SCALE,
    maxBytes: 300 * KB,
  };
  const coverPath = path.join(assetsRoot, "Cover.webp");
  await sharp(await renderBanner({ width: 1280, height: 640, scale: COVER_SCALE }))
    .webp({ quality: WEBP_QUALITY })
    .toFile(coverPath);
  await assertSpec(coverPath, coverSpec);

  const lightCoverPath = path.join(assetsRoot, "Cover-light.webp");
  await sharp(
    await renderBanner({
      width: 1280,
      height: 640,
      scale: COVER_SCALE,
      theme: "light",
    }),
  )
    .webp({ quality: WEBP_QUALITY })
    .toFile(lightCoverPath);
  await assertSpec(lightCoverPath, coverSpec);
} finally {
  await browser.close();
}
