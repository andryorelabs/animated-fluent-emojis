import { expect, test } from "vitest";

import { normalizeIterations, normalizeSize, toCssLength } from "./normalize.js";

test.each([
  [48, 48],
  [48.6, 49],
  [0, 100],
  [-5, 100],
  [0.4, 100],
  [NaN, 100],
  [Infinity, 100],
  ["", 100],
  [" ".repeat(3), 100],
  [" 64 ", 64],
  ["12.5", 12.5],
  [".5", 0.5],
  ["+8", 8],
  ["0", 100],
  ["-3", 100],
  ["2rem", "2rem"],
  ["var(--size)", "var(--size)"],
  [" 50% ", " 50% "],
])("normalizeSize(%j) is %j", (input, expected) => {
  expect(normalizeSize(input)).toBe(expected);
});

test("toCssLength appends px to numbers only", () => {
  expect(toCssLength(32)).toBe("32px");
  expect(toCssLength("2rem")).toBe("2rem");
});

test.each([
  ["infinite", "infinite"],
  [Infinity, "infinite"],
  [NaN, 0],
  [-1, 0],
  [0, 0],
  [3, 3],
  [1.5, 1.5],
] as const)("normalizeIterations(%j) is %j", (input, expected) => {
  expect(normalizeIterations(input)).toBe(expected);
});
