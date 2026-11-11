/* eslint-disable unicorn-js/isolated-functions -- the evaluated callback runs in the browser */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { SAMPLED_PATHS } from "./routes";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

type AxeViolations = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"];

/**
 * Drops the `label-content-name-mismatch` finding that axe 4.14 raises on
 * Starlight's search button, whose visible shortcut hint is not part of its
 * label. Every other rule and every other element stay checked.
 * @param violations - The violations axe reported for the page.
 * @returns The violations without the search button's label mismatch.
 */
function withoutStarlightSearchMismatch(violations: AxeViolations): AxeViolations {
  return violations
    .map((violation) =>
      violation.id === "label-content-name-mismatch"
        ? {
            ...violation,
            nodes: violation.nodes.filter((node) => !node.html.includes("data-open-modal")),
          }
        : violation,
    )
    .filter((violation) => violation.nodes.length > 0);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    for (const path of SAMPLED_PATHS) {
      test(`${path} has no axe violations`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.locator("body").evaluate((body) =>
          Promise.all(
            body
              .getAnimations({ subtree: true })
              .filter((animation) => animation instanceof CSSTransition)
              .map((animation) => animation.finished),
          ),
        );
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(withoutStarlightSearchMismatch(results.violations)).toEqual([]);
      });
    }
  });
}

test.describe("320px viewport", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of SAMPLED_PATHS) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test("the language menu opens by role and navigates to the Japanese site", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('astro-island[component-url*="HeaderMenus"]')).not.toHaveAttribute(
    "ssr",
    /.*/,
  );
  const trigger = page.getByRole("button", { name: "Language" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /English/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("menuitem", { name: /日本語/ }).click();
  await expect(page).toHaveURL(/\/ja\/$/);
});

/* eslint-enable unicorn-js/isolated-functions -- end of browser-evaluated code */
