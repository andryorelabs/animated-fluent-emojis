import { describe, expect, test } from "vitest";

import type { Finding } from "./diff";
import { buildSectionReport, renderMarkdown } from "./report";

const finding = (file: string, line: number, rule: string): Finding => ({
  file,
  line,
  rule,
});

describe("buildSectionReport", () => {
  test("classifies findings as both, eslint-only and oxlint-only", () => {
    const report = buildSectionReport({
      name: "repo",
      eslint: [finding("a.ts", 1, "r"), finding("a.ts", 2, "s")],
      candidate: [finding("a.ts", 1, "r"), finding("b.ts", 3, "t")],
      accepted: [],
      problems: [],
    });
    expect(report.rows.map((row) => row.classification)).toEqual([
      "both",
      "eslint-only",
      "oxlint-only",
    ]);
    expect(report.unexplained).toEqual([finding("a.ts", 2, "s")]);
    expect(report.exitCode).toBe(1);
  });

  test("an accepted gap passes and carries its reason", () => {
    const report = buildSectionReport({
      name: "repo",
      eslint: [finding("a.ts", 2, "s")],
      candidate: [],
      accepted: [{ file: "a.ts", rule: "s", reason: "covered elsewhere" }],
      problems: [],
    });
    expect(report.exitCode).toBe(0);
    expect(report.rows[0]?.reason).toBe("covered elsewhere");
  });

  test("without a candidate nothing is gated", () => {
    const report = buildSectionReport({
      name: "fixtures",
      eslint: [finding("a.ts", 2, "s")],
      candidate: undefined,
      accepted: [],
      problems: [],
    });
    expect(report.isCandidatePresent).toBe(false);
    expect(report.unexplained).toEqual([]);
    expect(report.exitCode).toBe(0);
  });

  test("harness problems fail the run even without a candidate", () => {
    const report = buildSectionReport({
      name: "fixtures",
      eslint: [],
      candidate: undefined,
      accepted: [],
      problems: ["fixture x was not flagged"],
    });
    expect(report.exitCode).toBe(1);
  });
});

describe("renderMarkdown", () => {
  test("lists eslint-only findings before common ones", () => {
    const markdown = renderMarkdown([
      buildSectionReport({
        name: "repo",
        eslint: [finding("a.ts", 1, "r"), finding("a.ts", 2, "s")],
        candidate: [finding("a.ts", 1, "r")],
        accepted: [],
        problems: [],
      }),
    ]);
    expect(markdown.indexOf("eslint-only (1)")).toBeLessThan(markdown.indexOf("both (1)"));
    expect(markdown).toContain("UNEXPLAINED ESLint-only (1)");
  });

  test("says when the candidate stack is absent", () => {
    const markdown = renderMarkdown([
      buildSectionReport({
        name: "repo",
        eslint: [],
        candidate: undefined,
        accepted: [],
        problems: [],
      }),
    ]);
    expect(markdown).toContain("Candidate stack absent");
  });
});
