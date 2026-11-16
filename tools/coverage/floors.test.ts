import { describe, expect, it } from "vitest";

import { floorFor, loadCoverageFloors, parseCoverageFloors } from "./floors";

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
    expect(Object.keys(floors).toSorted()).toEqual([
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
