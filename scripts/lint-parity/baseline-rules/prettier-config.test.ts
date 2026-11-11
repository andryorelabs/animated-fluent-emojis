import { expect, test } from "vitest";

import prettierConfig from "./prettier-config.mjs";

test("the frozen copy turns off every rule eslint-config-prettier 10.1.8 did", () => {
  expect(Object.keys(prettierConfig.rules)).toHaveLength(358);
  const enabled = Object.values(prettierConfig.rules).filter(
    (entry) => entry !== "off" && entry !== 0,
  );
  expect(enabled).toStrictEqual([]);
});

test("the frozen copy turns off the unicorn layout rules", () => {
  expect(prettierConfig.rules).toMatchObject({
    "unicorn/empty-brace-spaces": "off",
    "unicorn/no-nested-ternary": "off",
    "unicorn/number-literal-case": "off",
    "unicorn/template-indent": 0,
  });
});
