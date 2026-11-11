/* eslint-disable unicorn-js/isolated-functions -- the evaluated callbacks run in the browser */
import { expect, test, type Page } from "@playwright/test";

const INSTALL = '[aria-labelledby="install-title"]';
const PHONE_WIDTH = 343;

async function openInstall(page: Page) {
  await page.goto("/");
  const section = page.locator(INSTALL);
  await section.scrollIntoViewIfNeeded();
  const island = section.locator('astro-island[component-url*="InstallCard"]');
  await expect(island).not.toHaveAttribute("ssr", /.*/);
  return section;
}

test.describe("install card", () => {
  test.use({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });

  test("the tabs are 32px tall and switching one swaps code and preview", async ({ page }) => {
    const section = await openInstall(page);
    const tabs = section.getByRole("tab");
    await expect(tabs).toHaveText(["React", "Vue", "Svelte", "Astro", "HTML"]);
    const box = await tabs.first().boundingBox();
    expect(box?.height).toBe(32);

    const preview = section.getByTestId("install-preview");
    const readSize = () =>
      preview.evaluate((element) => [
        (element as HTMLElement).offsetWidth,
        (element as HTMLElement).offsetHeight,
      ]);
    const before = await readSize();
    await expect(section.locator('[data-preview-id="react"]')).toHaveAttribute(
      "data-active",
      "true",
    );

    await section.getByRole("tab", { name: "Vue" }).click();

    await expect(section.getByRole("tab", { name: "Vue" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(section.locator('[data-preview-id="vue"]')).toHaveAttribute("data-active", "true");
    await expect(section.getByRole("tabpanel").filter({ hasText: "<script setup" })).toBeVisible();
    const after = await readSize();
    expect(after).toEqual(before);
  });

  test("copying writes the active snippet, morphs the icon and bursts", async ({ page }) => {
    const section = await openInstall(page);
    await section.getByRole("tab", { name: "Svelte" }).click();
    await section.getByRole("button", { name: "Copy code" }).click();

    await expect(section.getByRole("button", { name: "Copied" })).toBeVisible();
    await expect(section.locator("[data-copy-burst]")).toBeAttached();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("animated-fluent-emojis/svelte");
  });

  test("the steps sit in three columns and the shortcode demo is present", async ({ page }) => {
    const section = await openInstall(page);
    const steps = section.locator("[data-install-steps] > li");
    await expect(steps).toHaveCount(3);
    const tops = await steps.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);
    await expect(section.locator("[data-shortcode-demo]")).toContainText(":launch:");
    await expect(section.locator("[data-install-architecture]")).toContainText("core");
  });

  test("the steps read Install, Import, Use and the panels follow the canvas", async ({ page }) => {
    const section = await openInstall(page);
    const titles = section.locator("[data-install-steps] h3");
    await expect(titles).toHaveText(["Install", "Import", "Use"]);
    await expect(section.locator("[data-install-steps] p")).toHaveCount(0);

    const demo = await section.locator("[data-shortcode-demo]").boundingBox();
    expect(demo?.height).toBeGreaterThanOrEqual(48);
    await expect(section.locator("[data-shortcode-panel]")).toContainText("Shortcodes");

    const cells = section.locator("[data-install-architecture] li");
    await expect(cells).toHaveCount(4);
    await expect(cells.first()).toContainText("manifest + CSS");
    await expect(cells.nth(1)).toContainText("React");
    await expect(cells.nth(1)).toContainText("ready");
    await expect(cells.nth(2)).toContainText("vue / svelte");
    await expect(cells.nth(2)).toContainText("Vue, Svelte");
    await expect(cells.nth(3)).toContainText("astro / html");
    await expect(cells.nth(3)).toContainText("Astro, HTML");
    await expect(section.locator("[data-install-architecture]")).not.toContainText("adapter");
  });

  test("each step card lights its border in turn", async ({ page }) => {
    const section = await openInstall(page);
    const cards = section.locator("[data-install-steps] > li > .install-step");
    await expect(cards).toHaveCount(3);
    const lit = await cards.evaluateAll((items) =>
      items.map((card) => {
        const animation = card
          .getAnimations()
          .find((entry) => (entry as CSSAnimation).animationName === "step-lit");
        if (!animation) return null;
        const timing = animation.effect?.getComputedTiming();
        const primary = getComputedStyle(card).getPropertyValue("--primary").trim();
        animation.pause();
        animation.currentTime = (timing?.delay ?? 0) + 100;
        const context = document.createElement("canvas").getContext("2d", {
          willReadFrequently: true,
        });
        const toRgb = (color: string) => {
          if (!context) return "";
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].join(",");
        };
        return {
          border: toRgb(getComputedStyle(card).borderTopColor),
          expected: toRgb(primary),
          delay: timing?.delay,
        };
      }),
    );
    expect(lit.map((entry) => entry?.delay)).toEqual([0, 2000, 4000]);
    for (const entry of lit) expect(entry?.border).toBe(entry?.expected);
  });

  test("the preview chip names the active tab and the shortcode panel shares a row with the architecture", async ({
    page,
  }) => {
    const section = await openInstall(page);
    const chip = section.getByTestId("install-preview-chip");
    await expect(chip).toHaveText("react");
    await section.getByRole("tab", { name: "Vue" }).click();
    await expect(chip).toHaveText("vue");

    const panelTop = await section
      .locator("[data-shortcode-panel]")
      .evaluate((element) => Math.round(element.getBoundingClientRect().top));
    const architectureTop = await section
      .locator("[data-install-architecture]")
      .evaluate((element) => Math.round(element.getBoundingClientRect().top));
    expect(panelTop).toBe(architectureTop);
    await expect(section.locator("[data-install-command]")).toContainText("animated-fluent-emojis");
  });
});

test.describe("narrow viewports", () => {
  test("the steps stack under 860px", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    const section = await openInstall(page);
    const lefts = await section
      .locator("[data-install-steps] > li")
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).offsetLeft));
    expect(new Set(lefts).size).toBe(1);
  });

  test("the code scrolls inside its block and the page does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: PHONE_WIDTH, height: 800 });
    await openInstall(page);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(PHONE_WIDTH);
  });
});

test.describe("reduced motion", () => {
  test.use({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });

  test("the shortcode demo rests on the last shortcode and copying shows no burst", async ({
    page,
  }) => {
    const section = await openInstall(page);
    const opacities = await section
      .locator("[data-shortcode-demo] > .sc-item")
      .evaluateAll((items) => items.map((item) => getComputedStyle(item).opacity));
    expect(opacities).toEqual(["0", "0", "1"]);

    await section.getByRole("button", { name: "Copy code" }).click();
    await expect(section.getByRole("button", { name: "Copied" })).toBeVisible();
    await expect(section.locator("[data-copy-burst]")).toHaveCount(0);
  });
});
/* eslint-enable unicorn-js/isolated-functions -- end of browser-evaluated code */
