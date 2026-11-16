import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { type CoverageBaseline, compareWithBaseline, readBaseline, refExists } from "./base";

const FLOOR = { lines: 90, functions: 90, branches: 80, statements: 90 };

function baseline(overrides: Partial<CoverageBaseline> = {}): CoverageBaseline {
  return {
    floors: { w: FLOOR },
    exceptions: [{ file: "x.ts", reason: "entry point", lines: 0.5, functions: 0.5 }],
    ...overrides,
  };
}

describe("compareWithBaseline", () => {
  it("accepts equal and raised floors", () => {
    const current = baseline({ floors: { w: { ...FLOOR, lines: 95 } } });
    expect(compareWithBaseline(current, baseline())).toEqual([]);
  });

  it("fails a lowered workspace floor and names the metric", () => {
    const current = baseline({ floors: { w: { ...FLOOR, functions: 85 } } });
    expect(compareWithBaseline(current, baseline())).toEqual([
      "Workspace w functions floor was lowered from 90% to 85%; floors only rise.",
    ]);
  });

  it("fails a dropped workspace floor", () => {
    expect(compareWithBaseline(baseline({ floors: {} }), baseline())).toEqual([
      "coverage-floors.json dropped the floor for w.",
    ]);
  });

  it("fails a lowered exception floor", () => {
    const current = baseline({
      exceptions: [{ file: "x.ts", reason: "entry point", lines: 0.4, functions: 0.5 }],
    });
    expect(compareWithBaseline(current, baseline())[0]).toMatch(/x\.ts was lowered/);
  });

  it("allows deleting an exception and adding a new one", () => {
    const current = baseline({
      exceptions: [{ file: "y.ts", reason: "new entry", lines: 0.1, functions: 0.1 }],
    });
    expect(compareWithBaseline(current, baseline())).toEqual([]);
  });
});

function git(root: string, ...arguments_: string[]): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      ...arguments_,
    ],
    {
      cwd: root,
      stdio: "ignore",
    },
  );
}

describe("readBaseline and refExists", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function makeRepository(withBaseline: boolean): string {
    const root = mkdtempSync(path.join(tmpdir(), "coverage-base-"));
    roots.push(root);
    git(root, "init", "-q", "-b", "main");
    if (withBaseline) {
      writeFileSync(
        path.join(root, "coverage-floors.json"),
        JSON.stringify({ w: { lines: 90, functions: 90, branches: 80, statements: 90 } }),
      );
      mkdirSync(path.join(root, "tools/coverage"), { recursive: true });
      writeFileSync(
        path.join(root, "tools/coverage/coverage-exceptions.ts"),
        'export const COVERAGE_EXCEPTIONS = [{ file: "x.ts", reason: "entry", lines: 0.5, functions: 0.5 }];\n',
      );
    } else {
      writeFileSync(path.join(root, "README.md"), "x\n");
    }
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "init");
    return root;
  }

  it("reads the floors and exceptions committed at a ref", async () => {
    const root = makeRepository(true);
    expect(refExists(root, "main")).toBe(true);
    expect(await readBaseline(root, "main")).toEqual({
      floors: { w: { lines: 90, functions: 90, branches: 80, statements: 90 } },
      exceptions: [{ file: "x.ts", reason: "entry", lines: 0.5, functions: 0.5 }],
    });
  });

  it("returns undefined when the ref does not hold the files yet", async () => {
    expect(await readBaseline(makeRepository(false), "main")).toBeUndefined();
  });

  it("reports a ref that does not exist", () => {
    expect(refExists(makeRepository(false), "missing")).toBe(false);
  });
});
