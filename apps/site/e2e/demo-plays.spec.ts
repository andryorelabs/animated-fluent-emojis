import { expect, test } from "@playwright/test";

test("the landing demo snippet follows the selected play", async ({ page }) => {
  await page.goto("/");
  const demo = page.locator(".demo-code");
  const island = page.locator('astro-island[component-url*="DemoPlayground"]');
  await expect(island).not.toHaveAttribute("ssr", /.*/);

  await expect(demo).toContainText("playOnHover");

  await page.getByRole("tab", { name: "Loop" }).click();
  await expect(demo).toContainText('animationIterations="infinite"');
  await expect(demo).not.toContainText("playOnHover");

  await page.getByRole("tab", { name: "On load" }).click();
  await expect(demo).not.toContainText("animationIterations");
  await expect(demo).not.toContainText("playOnHover");

  await page.getByRole("tab", { name: "Loop" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(demo).toContainText("playOnHover");
});
