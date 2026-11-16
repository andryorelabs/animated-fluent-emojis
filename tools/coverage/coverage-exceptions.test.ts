import { describe, expect, it } from "vitest";

import { COVERAGE_EXCEPTIONS } from "./coverage-exceptions";

describe("the committed exceptions", () => {
  it("each have a reason, a repo-relative file and fractions", () => {
    for (const entry of COVERAGE_EXCEPTIONS) {
      expect(entry.reason.trim()).not.toBe("");
      expect(entry.file).not.toMatch(/^\.|^\//);
      expect(entry.lines).toBeGreaterThanOrEqual(0);
      expect(entry.lines).toBeLessThanOrEqual(1);
      expect(entry.functions).toBeGreaterThanOrEqual(0);
      expect(entry.functions).toBeLessThanOrEqual(1);
    }
  });

  it("list each file once", () => {
    const files = COVERAGE_EXCEPTIONS.map((entry) => entry.file);
    expect(new Set(files).size).toBe(files.length);
  });
});
