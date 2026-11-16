import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  findFlakyTests,
  type PlaywrightReport,
  renderSummary,
  writeFlakySummary,
} from "./flaky-summary";

function spec(title: string, statuses: readonly string[]) {
  return {
    title,
    file: "home.spec.ts",
    tests: [{ results: statuses.map((status) => ({ status })) }],
  };
}

const REPORT: PlaywrightReport = {
  suites: [
    {
      specs: [spec("top level flaky", ["timedOut", "passed"])],
      suites: [
        {
          specs: [
            spec("flaky", ["failed", "passed"]),
            spec("stable", ["passed"]),
            spec("broken", ["failed", "failed"]),
            spec("failed after passing", ["passed", "failed"]),
            spec("skipped", ["skipped"]),
          ],
        },
      ],
    },
  ],
};

function temporaryDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), "flaky-summary-"));
}

describe("findFlakyTests", () => {
  test("lists only the tests that failed and then passed on a retry", () => {
    expect(findFlakyTests(REPORT)).toEqual([
      "home.spec.ts: top level flaky",
      "home.spec.ts: flaky",
    ]);
  });

  test("returns nothing for an empty report", () => {
    expect(findFlakyTests({})).toEqual([]);
    expect(findFlakyTests({ suites: [{}] })).toEqual([]);
  });
});

describe("renderSummary", () => {
  test("says none when no test was flaky", () => {
    expect(renderSummary([])).toBe("### Flaky e2e tests\n\nNone.\n");
  });

  test("lists each flaky test", () => {
    expect(renderSummary(["a.spec.ts: one", "b.spec.ts: two"])).toBe(
      "### Flaky e2e tests\n\n- a.spec.ts: one\n- b.spec.ts: two\n",
    );
  });
});

describe("writeFlakySummary", () => {
  test("appends the summary to the step summary file", () => {
    const directory = temporaryDirectory();
    const reportPath = path.join(directory, "report.json");
    const summaryPath = path.join(directory, "summary.md");
    writeFileSync(reportPath, JSON.stringify(REPORT));
    writeFileSync(summaryPath, "existing\n");

    const summary = writeFlakySummary({ reportPath, summaryPath });

    expect(summary).toContain("- home.spec.ts: flaky");
    expect(readFileSync(summaryPath, "utf8")).toBe(`existing\n${summary}`);
  });

  test("returns the summary without writing when there is no summary file", () => {
    const directory = temporaryDirectory();
    const reportPath = path.join(directory, "report.json");
    writeFileSync(reportPath, JSON.stringify({}));

    expect(writeFlakySummary({ reportPath })).toBe(renderSummary([]));
  });

  test("notes a missing report instead of failing", () => {
    const directory = temporaryDirectory();
    const reportPath = path.join(directory, "missing.json");
    const summaryPath = path.join(directory, "summary.md");

    const summary = writeFlakySummary({ reportPath, summaryPath });

    expect(summary).toContain("No Playwright JSON report");
    expect(readFileSync(summaryPath, "utf8")).toBe(summary);
  });
});
