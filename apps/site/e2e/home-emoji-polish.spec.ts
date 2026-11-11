import { devices, expect, test } from "@playwright/test";

const LONG_NAME_SLUG = "person-in-motorized-wheelchair-facing-right";
const LONG_NAME_VIEWPORT_WIDTH = 343;

test.describe("long emoji names at 343px", () => {
  test.use({ viewport: { width: LONG_NAME_VIEWPORT_WIDTH, height: 800 } });

  test("the emoji page heading wraps inside the viewport", async ({ page }) => {
    const response = await page.goto(`/emojis/${LONG_NAME_SLUG}/`);
    expect(response?.status()).toBe(200);
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? Infinity)).toBeLessThanOrEqual(LONG_NAME_VIEWPORT_WIDTH);
    const scrollWidth = await page.evaluate("document.documentElement.scrollWidth");
    expect(scrollWidth).toBeLessThanOrEqual(LONG_NAME_VIEWPORT_WIDTH);
  });
});

test.describe("touch emulation", () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("the hover play reads Hover / tap and starts when the stage is tapped", async ({ page }) => {
    await page.goto("/");
    const island = page.locator('astro-island[component-url*="DemoPlayground"]');
    await expect(island).not.toHaveAttribute("ssr", /.*/);
    await expect(page.getByRole("tab", { name: "Hover / tap" })).toBeVisible();

    const stage = page.getByTestId("demo-stage");
    await stage.tap({ position: { x: 20, y: 90 } });
    const image = stage.locator("img");
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((element) => element.getAnimations().length))
      .toBeGreaterThan(0);
  });
});
