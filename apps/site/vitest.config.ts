import { configDefaults, defineConfig } from "vitest/config";

import { coverageTimeout, floorFor } from "../../tools/coverage/floors.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    testTimeout: coverageTimeout(5000),
    hookTimeout: coverageTimeout(10_000),
    exclude: [...configDefaults.exclude, "e2e/**", "e2e-visual/**", "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: floorFor("apps/site"),
    },
  },
});
