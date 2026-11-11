import { describe, expect, test } from "vitest";

import {
  diffFindings,
  findingKey,
  normalizeOxlintRule,
  parseAccepted,
  parseEslintJson,
  parseOxlintJson,
  resolveGate,
  UNUSED_DIRECTIVE_RULE,
  type AcceptedEntry,
  type Finding,
} from "./diff";

const finding = (file: string, line: number, rule: string): Finding => ({
  file,
  line,
  rule,
});

describe("diffFindings", () => {
  test("splits findings into common, eslint-only and oxlint-only", () => {
    const eslint = [finding("a.ts", 1, "no-console"), finding("a.ts", 2, "x")];
    const oxlint = [finding("a.ts", 1, "no-console"), finding("b.ts", 3, "y")];
    const diff = diffFindings(eslint, oxlint);
    expect(diff.common).toEqual([finding("a.ts", 1, "no-console")]);
    expect(diff.eslintOnly).toEqual([finding("a.ts", 2, "x")]);
    expect(diff.oxlintOnly).toEqual([finding("b.ts", 3, "y")]);
  });

  test("collapses duplicates and sorts deterministically", () => {
    const eslint = [finding("b.ts", 2, "r"), finding("a.ts", 9, "r"), finding("a.ts", 9, "r")];
    const diff = diffFindings(eslint, []);
    expect(diff.eslintOnly).toEqual([finding("a.ts", 9, "r"), finding("b.ts", 2, "r")]);
  });

  test("a different line or rule is a different finding", () => {
    const diff = diffFindings(
      [finding("a.ts", 1, "r")],
      [finding("a.ts", 2, "r"), finding("a.ts", 1, "s")],
    );
    expect(diff.common).toEqual([]);
    expect(diff.eslintOnly).toHaveLength(1);
    expect(diff.oxlintOnly).toHaveLength(2);
  });
});

describe("parseAccepted", () => {
  test("accepts entries with a reason", () => {
    const entries = parseAccepted(
      JSON.stringify([{ file: "a.ts", line: 1, rule: "r", reason: "why" }]),
    );
    expect(entries).toEqual([{ file: "a.ts", line: 1, rule: "r", reason: "why" }]);
  });

  test("rejects an entry without a reason", () => {
    expect(() => parseAccepted(JSON.stringify([{ file: "a.ts", line: 1, rule: "r" }]))).toThrow(
      /reason/,
    );
  });

  test("rejects a blank reason", () => {
    expect(() =>
      parseAccepted(JSON.stringify([{ file: "a.ts", rule: "r", reason: " ".repeat(3) }])),
    ).toThrow(/reason/);
  });

  test("rejects a non-array document", () => {
    expect(() => parseAccepted("{}")).toThrow(/array/);
  });

  test("a missing line means every line of that file and rule", () => {
    const [entry] = parseAccepted(JSON.stringify([{ file: "a.ts", rule: "r", reason: "why" }]));
    expect(entry?.line).toBeUndefined();
  });
});

describe("resolveGate", () => {
  const accepted: AcceptedEntry[] = [
    { file: "a.ts", line: 1, rule: "r", reason: "explained" },
    { file: "b.ts", rule: "s", reason: "whole file" },
    { file: "gone.ts", line: 5, rule: "z", reason: "stale" },
  ];

  test("fails on unexplained eslint-only findings", () => {
    const result = resolveGate([finding("c.ts", 1, "r")], accepted);
    expect(result.unexplained).toEqual([finding("c.ts", 1, "r")]);
    expect(result.exitCode).toBe(1);
  });

  test("passes when every eslint-only finding is accepted", () => {
    const result = resolveGate([finding("a.ts", 1, "r"), finding("b.ts", 40, "s")], accepted);
    expect(result.unexplained).toEqual([]);
    expect(result.explained.map((item) => item.reason)).toEqual(["explained", "whole file"]);
    expect(result.exitCode).toBe(0);
  });

  test("reports accepted entries that matched nothing as stale", () => {
    const result = resolveGate([finding("a.ts", 1, "r")], accepted);
    expect(result.stale.map((entry) => entry.file)).toEqual(["b.ts", "gone.ts"]);
  });

  test("a line-specific entry does not cover another line", () => {
    const result = resolveGate([finding("a.ts", 2, "r")], accepted);
    expect(result.unexplained).toHaveLength(1);
  });
});

describe("normalizeOxlintRule", () => {
  test.each([
    ["eslint(no-console)", "no-console"],
    ["typescript-eslint(no-explicit-any)", "@typescript-eslint/no-explicit-any"],
    ["unicorn(no-null)", "unicorn/no-null"],
    ["react-hooks(rules-of-hooks)", "react-hooks/rules-of-hooks"],
    ["next(no-img-element)", "@next/next/no-img-element"],
    ["nextjs(no-img-element)", "@next/next/no-img-element"],
    ["jsx-a11y(alt-text)", "jsx-a11y/alt-text"],
    ["eslint-js(no-restricted-syntax)", "no-restricted-syntax"],
    ["shadcn(no-restyle)", "shadcn/no-restyle"],
    ["unicorn-js(no-for-each)", "unicorn/no-for-each"],
    ["jsdoc-js(no-types)", "jsdoc/no-types"],
    ["react-hooks-js(exhaustive-deps)", "react-hooks/exhaustive-deps"],
    ["vitest-js(no-focused-tests)", "vitest/no-focused-tests"],
    [
      "typed-react(no-leaked-conditional-rendering)",
      "@eslint-react/no-leaked-conditional-rendering",
    ],
    ["typescript-js(prefer-optional-chain)", "@typescript-eslint/prefer-optional-chain"],
    ["no-bare-code", "no-bare-code"],
  ])("%s -> %s", (code, expected) => {
    expect(normalizeOxlintRule(code)).toBe(expected);
  });
});

describe("linter output parsers", () => {
  test("parseEslintJson makes paths relative and keeps rule ids", () => {
    const output = JSON.stringify([
      {
        filePath: "/repo/src/a.ts",
        messages: [
          { ruleId: "no-console", line: 3 },
          { ruleId: null, line: 1 },
        ],
      },
    ]);
    expect(parseEslintJson(output, "/repo")).toEqual([finding("src/a.ts", 3, "no-console")]);
  });

  test("parseEslintJson throws on fatal messages instead of dropping the file", () => {
    const output = JSON.stringify([
      {
        filePath: "/repo/src/a.ts",
        messages: [{ ruleId: null, line: 1, fatal: true, message: "Parsing error" }],
      },
    ]);
    expect(() => parseEslintJson(output, "/repo")).toThrow("Parsing error");
  });

  test("parseEslintJson keeps unused-directive reports under one pseudo rule", () => {
    const output = JSON.stringify([
      {
        filePath: "/repo/a.ts",
        messages: [
          {
            ruleId: null,
            line: 2,
            message: "Unused eslint-disable directive (no problems were reported from 'x').",
          },
        ],
      },
    ]);
    expect(parseEslintJson(output, "/repo")).toEqual([finding("a.ts", 2, UNUSED_DIRECTIVE_RULE)]);
  });

  test("parseOxlintJson maps unused-directive diagnostics to the pseudo rule", () => {
    const output = JSON.stringify({
      diagnostics: [
        {
          code: "",
          message: "Unused eslint-disable directive, no problems were reported",
          filename: "a.ts",
          labels: [{ span: { line: 2 } }],
        },
      ],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([finding("a.ts", 2, UNUSED_DIRECTIVE_RULE)]);
  });

  test("parseOxlintJson treats a null code like an empty one", () => {
    const output = JSON.stringify({
      diagnostics: [
        {
          code: null,
          message: "Unused eslint-disable directive (no problems were reported).",
          filename: "a.ts",
          labels: [{ span: { line: 3 } }],
        },
      ],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([finding("a.ts", 3, UNUSED_DIRECTIVE_RULE)]);
  });

  test("parseOxlintJson maps unused enable directives to the pseudo rule", () => {
    const output = JSON.stringify({
      diagnostics: [
        {
          code: null,
          message:
            "Unused eslint-enable directive (no matching eslint-disable directives were found for no-alert).",
          filename: "a.ts",
          labels: [{ span: { line: 11 } }],
        },
      ],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([finding("a.ts", 11, UNUSED_DIRECTIVE_RULE)]);
  });

  test("parseOxlintJson reads code, filename and first label line", () => {
    const output = JSON.stringify({
      diagnostics: [
        {
          code: "eslint(no-console)",
          filename: "src/a.ts",
          labels: [{ span: { line: 4 } }],
        },
        { code: "eslint(no-debugger)", filename: "src/b.ts", labels: [] },
      ],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([
      finding("src/a.ts", 4, "no-console"),
      finding("src/b.ts", 0, "no-debugger"),
    ]);
  });
});

test("findingKey is stable", () => {
  expect(findingKey(finding("a.ts", 1, "r"))).toBe("a.ts:1:r");
});
