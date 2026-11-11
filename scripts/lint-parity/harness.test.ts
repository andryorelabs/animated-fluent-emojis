import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import type { Finding } from "./diff";
import {
  canonicalRuleIdFunction,
  checkExpectedFixtures,
  HELP,
  listFiles,
  materializeFixtures,
  parseOptions,
  ruleIdsRequiringTypes,
  splitCandidateTargets,
  summarizeSection,
  toSectionReport,
} from "./harness";

const finding = (line: number, rule: string): Finding => ({
  file: "a.ts",
  line,
  rule,
});

const defaults = {
  accepted: "/tmp/accepted.json",
  corpusDirectory: "/tmp/corpus",
  report: "/tmp/report.json",
};

describe("parseOptions", () => {
  test("applies the defaults", () => {
    expect(parseOptions([], defaults)).toEqual({
      mode: "fixtures",
      isTypeAware: true,
      accepted: defaults.accepted,
      corpusDirectory: defaults.corpusDirectory,
      report: defaults.report,
    });
  });

  test("reads the mode and lets --no-type-aware opt out", () => {
    const options = parseOptions(["--mode", "repo", "--no-type-aware"], defaults);
    expect(options?.mode).toBe("repo");
    expect(options?.isTypeAware).toBe(false);
  });

  test("--help returns nothing so the caller prints the help text", () => {
    expect(parseOptions(["--help"], defaults)).toBeUndefined();
    expect(HELP).toContain("--no-type-aware");
  });

  test("rejects an unknown mode", () => {
    expect(() => parseOptions(["--mode", "x"], defaults)).toThrow(/--mode/);
  });
});

describe("ruleIdsRequiringTypes", () => {
  test("includes typescript-eslint and eslint-react type-aware rules", () => {
    const rules = ruleIdsRequiringTypes();
    expect(rules.has("@typescript-eslint/no-floating-promises")).toBe(true);
    expect(rules.has("@eslint-react/no-leaked-conditional-rendering")).toBe(true);
    expect(rules.has("@typescript-eslint/no-explicit-any")).toBe(false);
  });
});

describe("canonicalRuleIdFunction", () => {
  const canonicalRuleId = canonicalRuleIdFunction();

  test.each([
    ["@typescript-eslint/no-empty-function", "no-empty-function"],
    ["@typescript-eslint/no-unused-expressions", "no-unused-expressions"],
    ["no-empty-function", "no-empty-function"],
    ["@typescript-eslint/only-throw-error", "@typescript-eslint/only-throw-error"],
    ["@typescript-eslint/no-explicit-any", "@typescript-eslint/no-explicit-any"],
    ["react/set-state-in-effect", "react-hooks/set-state-in-effect"],
    ["react/exhaustive-deps", "react-hooks/exhaustive-deps"],
    ["react-hooks/rules-of-hooks", "react-hooks/rules-of-hooks"],
    ["react/no-unknown-rule", "react/no-unknown-rule"],
    ["unicorn/no-null", "unicorn/no-null"],
  ])("%s -> %s", (rule, expected) => {
    expect(canonicalRuleId(rule)).toBe(expected);
  });
});

describe("checkExpectedFixtures", () => {
  const expected = { "a.ts": ["r", "s"], "b.ts": [] };

  test("passes when every expected rule fired and every fixture is listed", () => {
    const findings = [finding(1, "r"), finding(2, "s")];
    expect(checkExpectedFixtures(expected, findings, ["a.ts", "b.ts"])).toEqual([]);
  });

  test("reports an expected rule that did not fire", () => {
    const problems = checkExpectedFixtures(expected, [finding(1, "r")], ["a.ts", "b.ts"]);
    expect(problems).toEqual(["ESLint did not report s on fixture a.ts"]);
  });

  test("reports a fixture missing from expected.json", () => {
    const problems = checkExpectedFixtures({}, [], ["c.ts"]);
    expect(problems).toEqual(["Fixture c.ts is missing from expected.json"]);
  });
});

describe("splitCandidateTargets", () => {
  test("explicit files split by the astro extension", () => {
    expect(splitCandidateTargets(["a.ts", "b.astro"], true)).toEqual({
      oxlint: ["a.ts"],
      astro: ["b.astro"],
    });
  });

  test("directories go to Oxlint whole and to ESLint as astro globs", () => {
    expect(splitCandidateTargets([".", "corpus/x"], false)).toEqual({
      oxlint: [".", "corpus/x"],
      astro: ["**/*.astro", "corpus/x/**/*.astro"],
    });
  });
});

describe("fixture files", () => {
  const roots: string[] = [];

  const makeRoot = (): string => {
    const root = mkdtempSync(path.join(tmpdir(), "lint-parity-"));
    roots.push(root);
    return root;
  };

  afterEach(() => {
    roots.length = 0;
  });

  const writeTree = (files: string[]): string => {
    const tree = makeRoot();
    for (const file of files) {
      const target = path.join(tree, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, "export {}\n");
    }
    return tree;
  };

  test("listFiles returns sorted relative paths", () => {
    const tree = writeTree(["b/two.txt", "a.txt"]);
    expect(listFiles(tree)).toEqual(["a.txt", "b/two.txt"]);
  });

  test("materializeFixtures copies without the suffix and cleans up", () => {
    const tree = writeTree(["src/a.ts.fixture"]);
    const root = makeRoot();
    const { files, cleanup } = materializeFixtures(tree, root);
    expect(files).toEqual(["src/a.ts"]);
    expect(existsSync(path.join(root, "src/a.ts"))).toBe(true);
    cleanup();
    expect(existsSync(path.join(root, "src/a.ts"))).toBe(false);
  });

  test("materializeFixtures refuses to overwrite a repo file", () => {
    const tree = writeTree(["src/a.ts.fixture"]);
    const root = writeTree(["src/a.ts"]);
    expect(() => materializeFixtures(tree, root)).toThrow(/overwrite/);
  });
});

describe("toSectionReport and summarizeSection", () => {
  const typedRules = new Set(["typed"]);
  const raw = {
    name: "fixtures",
    eslint: [finding(1, "typed"), finding(2, "plain")],
    candidate: [finding(2, "plain")],
    problems: [],
    isTypeAware: false,
  };

  test("leaves type-aware rules out unless the run is type-aware", () => {
    expect(toSectionReport(raw, [], typedRules).exitCode).toBe(0);
    const typed = toSectionReport({ ...raw, isTypeAware: true }, [], typedRules);
    expect(typed.exitCode).toBe(1);
  });

  test("summarizes counts, unexplained findings and stale entries", () => {
    const section = toSectionReport(
      { ...raw, isTypeAware: true },
      [{ file: "gone.ts", rule: "x", reason: "stale" }],
      typedRules,
    );
    const lines = summarizeSection(section);
    expect(lines).toContain("== fixtures ==");
    expect(lines).toContain("both: 1");
    expect(lines).toContain("UNEXPLAINED ESLint-only: a.ts:1 typed");
    expect(lines).toContain("stale accepted entry: gone.ts x");
  });

  test("compares both sides under canonical rule ids", () => {
    const section = toSectionReport(
      {
        ...raw,
        eslint: [finding(3, "@x/rule")],
        candidate: [finding(3, "rule")],
      },
      [],
      typedRules,
      (rule) => rule.replace("@x/", ""),
    );
    expect(section.exitCode).toBe(0);
  });

  test("says so when the candidate is absent", () => {
    const section = toSectionReport({ ...raw, candidate: undefined }, [], typedRules);
    expect(summarizeSection(section).join("\n")).toContain("not installed");
  });
});
