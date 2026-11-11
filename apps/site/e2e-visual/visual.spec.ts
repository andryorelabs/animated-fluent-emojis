import { expect, test, type Page } from "@playwright/test";

const LOCALE_PREFIXES = [
  { name: "en", prefix: "" },
  { name: "de", prefix: "/de" },
] as const;

const DEFAULT_VIEWPORT_HEIGHT = 900;

const PAGES: readonly {
  name: string;
  path: string;
  viewportHeight?: number;
}[] = [
  { name: "landing", path: "/" },
  { name: "gallery", path: "/emojis/" },
  { name: "emoji", path: "/emojis/fire/" },
  { name: "docs", path: "/docs/", viewportHeight: 16_000 },
];

const VIEWPORT_WIDTHS = [1280, 768, 375, 320] as const;
const COLOR_SCHEMES = ["light", "dark"] as const;

/**
 * Playwright finishes every animation before a screenshot, which would leave
 * the scroll-linked header surface fully opaque at scroll 0. Hiding the layer
 * keeps the baselines identical to the header at rest.
 */
const HEADER_SURFACE_HIDDEN = ".site-header::before { display: none !important; }";

async function settlePage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { document: doc, window: win } = globalThis;
    await doc.fonts.ready;
    for (const image of doc.images) image.loading = "eager";
    const step = win.innerHeight;
    for (let y = 0; y < doc.body.scrollHeight; y += step) {
      win.scrollTo(0, y);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 150));
    }
    win.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...globalThis.document.images].every((image) => image.complete && image.naturalWidth > 0),
      ),
    )
    .toBe(true);
}

for (const { name: localeName, prefix } of LOCALE_PREFIXES) {
  for (const { name: pageName, path, viewportHeight } of PAGES) {
    for (const colorScheme of COLOR_SCHEMES) {
      test.describe(`${localeName} ${pageName} ${colorScheme}`, () => {
        test.use({ colorScheme, reducedMotion: "reduce" });

        for (const width of VIEWPORT_WIDTHS) {
          test(`${String(width)}px`, { tag: "@visual" }, async ({ page }) => {
            await page.setViewportSize({
              width,
              height: viewportHeight ?? DEFAULT_VIEWPORT_HEIGHT,
            });
            await page.goto(`${prefix}${path}`, { waitUntil: "networkidle" });
            await settlePage(page);
            await page.addStyleTag({ content: HEADER_SURFACE_HIDDEN });
            await expect(page).toHaveScreenshot(
              `${localeName}-${pageName}-${colorScheme}-${String(width)}.png`,
              {
                fullPage: true,
                animations: "disabled",
                caret: "hide",
                mask: [page.locator("time")],
              },
            );
          });
        }
      });
    }
  }
}
