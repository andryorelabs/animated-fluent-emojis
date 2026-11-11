import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { getViteConfig } from "astro/config";
import { msw } from "msw/vite";
import { defineConfig } from "vitest/config";

const isCoverageRun = process.argv.includes("--coverage");

const astroProject = await getViteConfig({
  test: {
    name: "astro",
    environment: "node",
    include: ["src/astro/Emoji.test.ts"],
  },
})({ command: "serve", mode: "test" });

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx,svelte}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
        "src/utils/types.ts",
        "src/utils/emoji-id.generated.ts",
      ],
      reporter: ["text", "lcov"],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
    projects: [
      {
        extends: true,
        plugins: [
          react(),
          svelte({ compilerOptions: { hmr: false } }),
          msw({ mode: "worker-only" }),
        ],
        optimizeDeps: { include: ["svelte"] },
        test: {
          name: "browser",
          include: [
            "src/components/**/*.test.tsx",
            "src/hooks/**/*.test.{ts,tsx}",
            "src/react/**/*.test.{ts,tsx}",
            "src/vanilla/**/*.test.ts",
            "src/element/**/*.test.ts",
            "src/vue/**/*.test.ts",
            "src/astro/client.test.ts",
            "src/test/conformance/**/*.test.{ts,tsx}",
          ],
          setupFiles: ["src/test/browser-setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            commands: {
              emulateReducedMotion: async ({ page }, value: "reduce" | "no-preference") => {
                await page.emulateMedia({ reducedMotion: value });
              },
            },
            instances: isCoverageRun
              ? [{ browser: "chromium" }]
              : [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
          },
        },
      },
      {
        extends: true,
        plugins: [svelte()],
        test: {
          name: "node",
          environment: "node",
          exclude: ["src/test/conformance/**"],
          include: [
            "src/core/**/*.test.ts",
            "src/utils/**/*.test.ts",
            "src/lookup/**/*.test.ts",
            "src/astro/{markup,server}.test.ts",
            "src/test/**/*.test.ts",
          ],
        },
      },
      astroProject,
    ],
  },
});
