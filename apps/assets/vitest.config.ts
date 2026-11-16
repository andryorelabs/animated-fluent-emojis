import { defineConfig } from "vitest/config";

import { floorFor } from "../../tools/coverage/floors.ts";

export default defineConfig({
  test: {
    environment: "node",
    include: ["*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["*.ts"],
      exclude: ["*.test.ts", "test-support.ts", "vitest.config.ts"],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: floorFor("apps/assets"),
    },
  },
});
