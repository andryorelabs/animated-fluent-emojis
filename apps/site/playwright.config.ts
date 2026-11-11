import { defineConfig, devices } from "@playwright/test";

/**
 * Specs that run on every device project, not only on desktop Chromium.
 */
const LAYOUT_SPECS = /layout-matrix\.spec\.ts$/;

/**
 * Runs the browser specs against the site as the container serves it (nginx).
 * Start the container first and point `SITE_URL` at it. The device projects
 * emulate phones, a tablet and odd viewports in Chromium and run only the
 * layout matrix.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  ...(process.env.CI && { workers: "100%" }),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: { baseURL: process.env.SITE_URL ?? "http://127.0.0.1:8080" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone-se",
      testMatch: LAYOUT_SPECS,
      use: { ...devices["iPhone SE"], browserName: "chromium" },
    },
    {
      name: "narrow-320",
      testMatch: LAYOUT_SPECS,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 640 },
      },
    },
    {
      name: "pixel-7",
      testMatch: LAYOUT_SPECS,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "ipad-mini",
      testMatch: LAYOUT_SPECS,
      use: { ...devices["iPad Mini"], browserName: "chromium" },
    },
    {
      name: "landscape-phone",
      testMatch: LAYOUT_SPECS,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
