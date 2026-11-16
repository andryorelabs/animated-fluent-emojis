import { describe, expect, it } from "vitest";

import { coverageTimeout, floorFor, loadCoverageFloors, parseCoverageFloors } from "./floors";

const GOOD = { lines: 90, functions: 91, branches: 80, statements: 92 };

describe("parseCoverageFloors", () => {
  it("parses one floor per workspace", () => {
    expect(parseCoverageFloors(JSON.stringify({ ".": GOOD }))).toEqual({ ".": GOOD });
  });

  it("rejects a non-object file", () => {
    expect(() => parseCoverageFloors("[]")).toThrow(/keyed by workspace/);
    expect(() => parseCoverageFloors("null")).toThrow(/keyed by workspace/);
  });

  it("rejects a malformed or out-of-range floor", () => {
    expect(() => parseCoverageFloors(JSON.stringify({ a: { lines: 1 } }))).toThrow(/for a needs/);
    expect(() => parseCoverageFloors(JSON.stringify({ a: { ...GOOD, lines: 101 } }))).toThrow(
      /for a needs/,
    );
    expect(() => parseCoverageFloors(JSON.stringify({ a: 3 }))).toThrow(/for a needs/);
  });
});

describe("committed coverage-floors.json", () => {
  it("has a floor for each coverage workspace", () => {
    const floors = loadCoverageFloors();
    expect(Object.keys(floors).toSorted((left, right) => left.localeCompare(right))).toEqual([
      ".",
      "apps/assets",
      "apps/site",
      "packages/animated-fluent-emojis",
    ]);
  });

  it("looks a workspace floor up and throws on an unknown one", () => {
    expect(floorFor(".").lines).toBeGreaterThan(0);
    expect(() => floorFor("nope")).toThrow(/no entry for nope/);
  });
});

describe("coverageTimeout", () => {
  it("keeps the default without coverage and raises it with coverage", () => {
    const original = [...process.argv];
    try {
      process.argv = original.filter((argument) => argument !== "--coverage");
      expect(coverageTimeout(5000)).toBe(5000);
      process.argv = [...process.argv, "--coverage"];
      expect(coverageTimeout(5000)).toBe(30_000);
    } finally {
      process.argv = original;
    }
  });
});
