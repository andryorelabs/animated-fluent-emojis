import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { hreflangAlternates, localePath, LOCALES, localeUrl } from "../i18n/locales";
import { emojiPagePath, ogImagePath } from "./emoji-page";

const SLUGS = ["fire", "waving-hand"];
const OUT_DIR = path.resolve(process.cwd(), "dist/emoji-pages-test");
const BUILD_TIMEOUT_MILLISECONDS = 240_000;

function readPage(locale: (typeof LOCALES)[number], slug: string): string {
  const pagePath = localePath(locale, emojiPagePath(slug));
  return readFileSync(path.resolve(OUT_DIR, `.${pagePath}index.html`), "utf8");
}

describe("emoji pages in the build output", () => {
  let sitemap = "";

  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true });
    execFileSync("bun", ["run", "astro", "build", "--outDir", OUT_DIR], {
      env: { ...process.env, SITE_EMOJI_SLUGS: SLUGS.join(",") },
      stdio: "pipe",
    });
    sitemap = readFileSync(path.resolve(OUT_DIR, "sitemap.xml"), "utf8");
  }, BUILD_TIMEOUT_MILLISECONDS);

  describe.each(SLUGS)("%s", (slug) => {
    it.each(LOCALES)("has a %s page with canonical and hreflang", (locale) => {
      const html = readPage(locale, slug);
      const url = localeUrl(locale, emojiPagePath(slug));
      expect(html).toContain(`<link rel="canonical" href="${url}"`);
      const alternates = hreflangAlternates(emojiPagePath(slug));
      for (const { hreflang, href } of alternates) {
        expect(html).toContain(`hreflang="${hreflang}" href="${href}"`);
      }
      expect(html).toContain('"@type":"ImageObject"');
      expect(sitemap).toContain(`<loc>${url}</loc>`);
    });

    it("has an Open Graph image that every page references", async () => {
      const file = path.resolve(OUT_DIR, `.${ogImagePath(slug)}`);
      expect(existsSync(file)).toBe(true);
      expect(await sharp(file).metadata()).toMatchObject({
        width: 1200,
        height: 630,
      });
      for (const locale of LOCALES) {
        expect(readPage(locale, slug)).toContain(
          `property="og:image" content="${localeUrl("en", ogImagePath(slug))}"`,
        );
      }
    });
  });
});
