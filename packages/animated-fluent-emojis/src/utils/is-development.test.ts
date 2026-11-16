import { afterEach, expect, test, vi } from "vitest";

import { isDevelopment } from "./is-development.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("is true outside production", () => {
  vi.stubGlobal("process", { env: { NODE_ENV: "development" } });

  expect(isDevelopment()).toBe(true);
});

test("is false in production", () => {
  vi.stubGlobal("process", { env: { NODE_ENV: "production" } });

  expect(isDevelopment()).toBe(false);
});

test("is false where process does not exist", () => {
  vi.stubGlobal("process", undefined);

  expect(isDevelopment()).toBe(false);
});
