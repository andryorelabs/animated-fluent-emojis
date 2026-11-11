import { defineConfig } from "@playwright/test";

/**
 * Visual regression run against the site as the container serves it (nginx).
 * Baselines are only valid when produced inside the pinned Playwright image,
 * so run it through `scripts/visual.sh`.
 */
export default defineConfig({
  testDir: "./e2e-visual",
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: { baseURL: process.env.SITE_URL ?? "http://127.0.0.1:8081" },
});
