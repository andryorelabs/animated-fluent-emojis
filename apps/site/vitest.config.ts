import { configDefaults, defineConfig } from "vitest/config";

import { coverageTimeout, floorFor } from "../../tools/coverage/floors.ts";

/**
 * File-name convention for tests that need a DOM: `*.dom.test.tsx` (or
 * `*.dom.test.ts`). Those files run in the `dom` project under happy-dom, so
 * React islands can be rendered with Testing Library and driven with events,
 * effects and portals. Every other test runs in the `node` project. A per-file
 * environment docblock is not used because code comments are TSDoc-only.
 */
const DOM_TEST_GLOB = "src/**/*.dom.test.{ts,tsx}";

const sharedExclude = [...configDefaults.exclude, "e2e/**", "e2e-visual/**", "dist/**"];

/**
 * Site test config with two projects that share one coverage run: `node` for
 * plain tests and `dom` (happy-dom) for files named by {@link DOM_TEST_GLOB}.
 * happy-dom was chosen over jsdom because it renders Base UI portals, focus
 * management and pointer events well enough for the shadcn primitives, and is
 * faster to boot. The `dom` project turns on `globals` only so Testing Library
 * registers its automatic `cleanup` after each test; tests still import
 * `expect`, `test` and `vi` from `vitest`.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    testTimeout: coverageTimeout(5000),
    hookTimeout: coverageTimeout(10_000),
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          exclude: [...sharedExclude, DOM_TEST_GLOB],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: [DOM_TEST_GLOB],
          exclude: sharedExclude,
          globals: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text", "lcov", "json-summary"],
      thresholds: floorFor("apps/site"),
    },
  },
});
