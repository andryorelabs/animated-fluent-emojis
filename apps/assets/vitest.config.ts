import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["*.ts"],
      exclude: ["*.test.ts", "test-support.ts", "vitest.config.ts"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
