/* eslint-disable unicorn-js/isolated-functions -- the evaluated callback runs in the browser */
import { expect, test, type Page } from "@playwright/test";

const HEADER = "header.site-header";
const SCROLL_DISTANCE_PX = 400;

const PAGES = [
  { name: "landing", path: "/" },
  { name: "gallery", path: "/emojis/" },
  { name: "emoji", path: "/emojis/fire/" },
  { name: "404", path: "/this-page-does-not-exist/" },
] as const;

const readSurfaceOpacity = (page: Page) =>
  page.locator(HEADER).evaluate((element) => Number(getComputedStyle(element, "::before").opacity));

const readHeaderTop = (page: Page) =>
  page.locator(HEADER).evaluate((element) => element.getBoundingClientRect().top);

const scrollTo = async (page: Page, top: number) => {
  await page.evaluate((target) => {
    window.scrollTo(0, target);
  }, top);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(top);
};

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { name, path } of PAGES) {
    test(`the header stays pinned on the ${name} page`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(HEADER)).toBeVisible();
      expect(await readHeaderTop(page)).toBe(0);

      const scrollable = await page.evaluate(
        (distance) => document.documentElement.scrollHeight - window.innerHeight >= distance,
        SCROLL_DISTANCE_PX,
      );
      if (scrollable) await scrollTo(page, SCROLL_DISTANCE_PX);
      expect(await readHeaderTop(page)).toBe(0);
    });
  }

  test("the surface fades in over the first 64px of scroll", async ({ page }) => {
    await page.goto("/");
    const supported = await page.evaluate(() => CSS.supports("animation-timeline: scroll()"));
    test.skip(!supported, "scroll timelines are not supported");

    expect(await readSurfaceOpacity(page)).toBe(0);

    await scrollTo(page, 32);
    await expect.poll(() => readSurfaceOpacity(page)).toBeGreaterThan(0.3);
    expect(await readSurfaceOpacity(page)).toBeLessThan(0.7);

    await scrollTo(page, SCROLL_DISTANCE_PX);
    await expect.poll(() => readSurfaceOpacity(page)).toBe(1);
  });
});

/* eslint-enable unicorn-js/isolated-functions -- end of browser-evaluated code */
