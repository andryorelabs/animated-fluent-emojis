import { describe, expect, test } from "vitest";

import directiveAliasesPlugin, { renameDirectiveAliases } from "./directive-aliases.mjs";

describe("renameDirectiveAliases", () => {
  test.each([
    [
      "/* eslint-disable unicorn-js/isolated-functions -- why */",
      "/* eslint-disable unicorn/isolated-functions -- why */",
    ],
    [
      "// eslint-disable-next-line typescript-js/no-unused-vars, jsdoc-js/tag-lines -- why",
      "// eslint-disable-next-line @typescript-eslint/no-unused-vars, jsdoc/tag-lines -- why",
    ],
    [
      "/* eslint-enable typed-react/no-leaked-conditional-rendering -- end */",
      "/* eslint-enable @eslint-react/no-leaked-conditional-rendering -- end */",
    ],
    [
      "// eslint-disable-line eslint-js/no-console -- why",
      "// eslint-disable-line no-console -- why",
    ],
  ])("renames %s", (input, expected) => {
    expect(renameDirectiveAliases(input)).toBe(expected);
  });

  test("leaves lines without a directive and plain ESLint ids alone", () => {
    const text = [
      "const name = 'unicorn-js/isolated-functions'",
      "// eslint-disable-next-line unicorn/no-array-sort -- why",
      "/* eslint-disable @scope/unicorn-js/x -- why */",
    ].join("\n");
    expect(renameDirectiveAliases(text)).toBe(text);
  });

  test("keeps the line count", () => {
    const text = "a\n/* eslint-disable unicorn-js/x -- y */\nb\n";
    expect(renameDirectiveAliases(text).split("\n")).toHaveLength(4);
  });
});

test("the processor lints the renamed text as one block", () => {
  const processor = directiveAliasesPlugin.processors?.aliases;
  expect(processor?.preprocess?.("// eslint-disable-line unicorn-js/x -- y", "a.ts")).toStrictEqual(
    ["// eslint-disable-line unicorn/x -- y"],
  );
  const message = {
    ruleId: "r",
    message: "m",
    line: 1,
    column: 1,
    severity: 2 as const,
  };
  expect(processor?.postprocess?.([[message]], "a.ts")).toStrictEqual([message]);
});
