import { defineConfig } from "vitest/config";

import { floorFor } from "./tools/coverage/floors.ts";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: [
      "scripts/**/*.test.ts",
      "tools/**/*.test.ts",
      "eslint-rules/**/*.test.ts",
      "oxlint-plugins/**/*.test.ts",
      "docs/adr/**/*.test.ts",
      "docs/brand/tools/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: [
        "scripts/**/*.ts",
        "tools/**/*.ts",
        "eslint-rules/**/*.mjs",
        "oxlint-plugins/**/*.mjs",
        "docs/brand/tools/**/*.mjs",
      ],
      exclude: [
        "scripts/**/*.test.ts",
        "tools/**/*.test.ts",
        "eslint-rules/**/*.test.ts",
        "oxlint-plugins/**/*.test.ts",
        "docs/brand/tools/**/*.test.ts",
      ],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: floorFor("."),
    },
  },
});
