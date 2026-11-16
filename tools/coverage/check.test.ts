import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkCoverage,
  checkFiles,
  checkWorkspaceFloor,
  type FileCoverage,
  parseLcov,
  parseSummaryTotals,
  runGate,
} from "./check";
import type { CoverageException } from "./coverage-exceptions";

function file(path: string, linesHit: number, functionsHit: number): FileCoverage {
  return { path, linesFound: 100, linesHit, functionsFound: 50, functionsHit };
}

const FLOOR = { lines: 90, functions: 90, branches: 80, statements: 90 };
const FLAT = { lines: 80, functions: 80, branches: 80, statements: 80 };

describe("parseLcov", () => {
  const lcov = [
    "TN:",
    "SF:src/a.ts",
    "FNF:4",
    "FNH:3",
    "LF:10",
    "LH:9",
    "BRF:2",
    "end_of_record",
    "LF:99",
    "SF:./b.ts",
    "end_of_record",
  ].join("\n");

  it("prefixes workspace paths and reads the counters", () => {
    expect(parseLcov(lcov, "apps/site")).toEqual([
      {
        path: "apps/site/src/a.ts",
        linesFound: 10,
        linesHit: 9,
        functionsFound: 4,
        functionsHit: 3,
      },
      { path: "apps/site/b.ts", linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 },
    ]);
  });

  it("keeps root paths repo-relative", () => {
    expect(parseLcov(lcov, ".").map((entry) => entry.path)).toEqual(["src/a.ts", "b.ts"]);
  });
});

describe("parseSummaryTotals", () => {
  it("reads the four totals", () => {
    const text = JSON.stringify({
      total: {
        lines: { pct: 1 },
        functions: { pct: 2 },
        branches: { pct: 3 },
        statements: { pct: 4 },
      },
    });
    expect(parseSummaryTotals(text)).toEqual({
      lines: 1,
      functions: 2,
      branches: 3,
      statements: 4,
    });
  });
});

describe("checkFiles", () => {
  const exception = (overrides: Partial<CoverageException> = {}): CoverageException => ({
    file: "x.ts",
    reason: "cannot be reached",
    lines: 0.5,
    functions: 0.5,
    ...overrides,
  });

  it("passes files at the floor", () => {
    expect(checkFiles([file("x.ts", 97, 49)], [])).toEqual([]);
  });

  it("treats a file with nothing to measure as covered", () => {
    const empty = { path: "x.ts", linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 };
    expect(checkFiles([empty], [])).toEqual([]);
  });

  it("fails a low file without an exception, on lines or on functions", () => {
    expect(checkFiles([file("x.ts", 96, 50)], [])[0]).toMatch(/x\.ts has .* no coverage exception/);
    expect(checkFiles([file("x.ts", 100, 48)], [])[0]).toMatch(/no coverage exception/);
  });

  it("accepts an excepted file at or above its own floor", () => {
    expect(checkFiles([file("x.ts", 60, 30)], [exception()])).toEqual([]);
  });

  it("fails an excepted file under its own floor", () => {
    expect(checkFiles([file("x.ts", 40, 30)], [exception()])[0]).toMatch(/below its exception floor/);
    expect(checkFiles([file("x.ts", 60, 20)], [exception()])[0]).toMatch(/below its exception floor/);
  });

  it("fails a stale exception", () => {
    expect(checkFiles([file("x.ts", 100, 50)], [exception()])[0]).toMatch(/is stale/);
  });

  it("fails an exception for a file missing from the report", () => {
    expect(checkFiles([], [exception()])[0]).toMatch(/missing from the report/);
  });

  it("fails an exception with an empty reason", () => {
    const failures = checkFiles([file("x.ts", 60, 30)], [exception({ reason: "  " })]);
    expect(failures).toEqual(["Coverage exception for x.ts has an empty reason."]);
  });
});

describe("checkWorkspaceFloor", () => {
  it("passes a figure within the tolerance above its floor", () => {
    const totals = { lines: 90.3, functions: 90, branches: 80, statements: 90.5 };
    expect(checkWorkspaceFloor("w", totals, FLOOR)).toEqual([]);
  });

  it("fails a figure below its floor", () => {
    const totals = { lines: 89, functions: 90, branches: 80, statements: 90 };
    expect(checkWorkspaceFloor("w", totals, FLOOR)).toEqual([
      "Workspace w lines coverage 89.00% is below its 90% floor.",
    ]);
  });

  it("fails a floor that is stale and says what to raise it to", () => {
    const totals = { lines: 95.678, functions: 90, branches: 80, statements: 90 };
    expect(checkWorkspaceFloor("w", totals, FLOOR)[0]).toMatch(/raise the floor .* to 95\.67\./);
  });
});

describe("checkCoverage and runGate", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function makeRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "coverage-gate-"));
    roots.push(root);
    return root;
  }

  function writeReport(root: string, workspace: string, linesHit: number, pct: number): void {
    const directory = join(root, workspace, "coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "lcov.info"),
      `SF:a.ts\nFNF:1\nFNH:1\nLF:100\nLH:${linesHit}\nend_of_record\n`,
    );
    const metric = { pct };
    writeFileSync(
      join(directory, "coverage-summary.json"),
      JSON.stringify({
        total: { lines: metric, functions: metric, branches: metric, statements: metric },
      }),
    );
  }

  it("passes a clean workspace", () => {
    const root = makeRoot();
    writeReport(root, "w", 100, 80);
    expect(checkCoverage(root, [], { w: FLAT }, ["w"])).toEqual([]);
  });

  it("reports a missing report", () => {
    const failures = checkCoverage(makeRoot(), [], { w: FLOOR }, ["w"]);
    expect(failures[0]).toMatch(/No coverage report for w/);
  });

  it("reports a workspace without a floor", () => {
    const root = makeRoot();
    writeReport(root, "w", 100, 80);
    expect(checkCoverage(root, [], {}, ["w"])).toEqual([
      "coverage-floors.json has no entry for w.",
    ]);
  });

  it("collects file and floor failures together", () => {
    const root = makeRoot();
    writeReport(root, "w", 50, 70);
    const failures = checkCoverage(root, [], { w: FLAT }, ["w"]);
    expect(failures.some((failure) => failure.includes("below its 80% floor"))).toBe(true);
    expect(failures.some((failure) => failure.includes("w/a.ts has"))).toBe(true);
  });

  it("returns a failing exit code when reports are missing", () => {
    expect(runGate(makeRoot())).toBe(1);
  });
});
