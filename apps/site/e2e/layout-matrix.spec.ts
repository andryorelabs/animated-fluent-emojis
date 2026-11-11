import { expect, test } from "@playwright/test";

import { SAMPLED_PATHS } from "./routes";

const EDGE_TOLERANCE_PX = 1;

for (const path of SAMPLED_PATHS) {
  test(`${path} lays out inside the viewport`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    const header = page.locator("header.site-header");
    await expect(header).toBeVisible();
    const nav = header.locator("nav").first();
    const menuTrigger = header.locator('[data-slot="dropdown-menu-trigger"]').first();
    await expect(nav.or(menuTrigger).filter({ visible: true })).toHaveCount(1);

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();

    const viewportWidth = Number(await page.evaluate("document.documentElement.clientWidth"));
    const scrollWidth = Number(await page.evaluate("document.documentElement.scrollWidth"));
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);

    const box = await heading.boundingBox();
    expect(box?.x ?? -Infinity).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect((box?.x ?? Infinity) + (box?.width ?? Infinity)).toBeLessThanOrEqual(
      viewportWidth + EDGE_TOLERANCE_PX,
    );

    const mainClipsContent = await page
      .locator("main")
      .first()
      .evaluate((main) => main.scrollWidth > main.clientWidth + 1);
    expect(mainClipsContent).toBe(false);
  });
}
