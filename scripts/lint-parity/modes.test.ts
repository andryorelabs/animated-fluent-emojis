import { expect, test } from "vitest";

import { MODES, parseMode } from "./modes";

test.each(MODES)("parseMode accepts %s", (mode) => {
  expect(parseMode(mode)).toBe(mode);
});

test("parseMode rejects an unknown mode", () => {
  expect(() => parseMode("everything")).toThrow(/--mode/);
});
