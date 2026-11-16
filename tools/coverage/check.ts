import { existsSync, readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";

import { COVERAGE_EXCEPTIONS, type CoverageException } from "./coverage-exceptions";
import { type CoverageFloor, loadCoverageFloors } from "./floors";

/**
 * Per-file floor for lines, as a fraction.
 */
export const FILE_LINE_FLOOR = 0.97;

/**
 * Per-file floor for functions, as a fraction.
 */
export const FILE_FUNCTION_FLOOR = 0.98;

/**
 * How many percentage points a measured workspace figure may sit above its floor before the floor counts as stale.
 */
export const RAISE_TOLERANCE = 0.5;

/**
 * Workspaces that run coverage, keyed by repo-relative path (`.` is the root).
 */
export const COVERAGE_WORKSPACES: readonly string[] = [
  ".",
  "packages/animated-fluent-emojis",
  "apps/site",
  "apps/assets",
];

/**
 * Coverage of one source file, as reported by an lcov record, with a repo-relative path.
 */
export interface FileCoverage {
  readonly path: string;
  readonly linesFound: number;
  readonly linesHit: number;
  readonly functionsFound: number;
  readonly functionsHit: number;
}

/**
 * Workspace totals as percentages from 0 to 100, read from a `json-summary` report.
 */
export type WorkspaceTotals = CoverageFloor;

function repoPath(workspace: string, file: string): string {
  return workspace === "." ? posix.normalize(file) : posix.join(workspace, file);
}

/**
 * Parses lcov text into one {@link FileCoverage} per `SF:` record, prefixing each path with its workspace.
 */
export function parseLcov(lcov: string, workspace: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let current: { path: string; lf: number; lh: number; fnf: number; fnh: number } | undefined;
  for (const rawLine of lcov.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("SF:")) {
      current = {
        path: repoPath(workspace, line.slice(3).replaceAll("\\", "/")),
        lf: 0,
        lh: 0,
        fnf: 0,
        fnh: 0,
      };
    } else if (current === undefined) {
      continue;
    } else if (line.startsWith("LF:")) {
      current.lf = Number(line.slice(3));
    } else if (line.startsWith("LH:")) {
      current.lh = Number(line.slice(3));
    } else if (line.startsWith("FNF:")) {
      current.fnf = Number(line.slice(4));
    } else if (line.startsWith("FNH:")) {
      current.fnh = Number(line.slice(4));
    } else if (line === "end_of_record") {
      files.push({
        path: current.path,
        linesFound: current.lf,
        linesHit: current.lh,
        functionsFound: current.fnf,
        functionsHit: current.fnh,
      });
      current = undefined;
    }
  }
  return files;
}

/**
 * Reads the `total` block of a Vitest `json-summary` report as percentages.
 */
export function parseSummaryTotals(text: string): WorkspaceTotals {
  const parsed = JSON.parse(text) as {
    total: Record<"lines" | "functions" | "branches" | "statements", { pct: number }>;
  };
  const { lines, functions, branches, statements } = parsed.total;
  return {
    lines: lines.pct,
    functions: functions.pct,
    branches: branches.pct,
    statements: statements.pct,
  };
}

function fraction(hit: number, found: number): number {
  return found === 0 ? 1 : hit / found;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function describeFile(file: FileCoverage): string {
  const lines = percent(fraction(file.linesHit, file.linesFound));
  const functions = percent(fraction(file.functionsHit, file.functionsFound));
  return `${lines} lines and ${functions} functions`;
}

function findFileFailures(
  files: readonly FileCoverage[],
  exceptions: readonly CoverageException[],
): string[] {
  const failures: string[] = [];
  const excepted = new Map(exceptions.map((exception) => [exception.file, exception]));
  for (const file of files) {
    const lines = fraction(file.linesHit, file.linesFound);
    const functions = fraction(file.functionsHit, file.functionsFound);
    const underFloor = lines < FILE_LINE_FLOOR || functions < FILE_FUNCTION_FLOOR;
    const exception = excepted.get(file.path);
    if (exception === undefined) {
      if (underFloor) {
        failures.push(
          `${file.path} has ${describeFile(file)}, below the ${percent(FILE_LINE_FLOOR)} lines and ${percent(FILE_FUNCTION_FLOOR)} functions floor, and has no coverage exception.`,
        );
      }
    } else if (!underFloor) {
      failures.push(
        `Coverage exception for ${file.path} is stale: the file now has ${describeFile(file)}. Remove the exception.`,
      );
    } else if (lines < exception.lines || functions < exception.functions) {
      failures.push(
        `${file.path} has ${describeFile(file)}, below its exception floor of ${percent(exception.lines)} lines and ${percent(exception.functions)} functions.`,
      );
    }
  }
  const reported = new Set(files.map((file) => file.path));
  for (const exception of exceptions) {
    if (!reported.has(exception.file)) {
      failures.push(`Coverage exception for ${exception.file} names a file missing from the report.`);
    }
    if (exception.reason.trim() === "") {
      failures.push(`Coverage exception for ${exception.file} has an empty reason.`);
    }
  }
  return failures;
}

/**
 * Lists one message per file under the per-file floor without an exception, and per exception that is stale,
 * missing from the report, unexplained or under its own floor. Empty when every file passes.
 */
export function checkFiles(
  files: readonly FileCoverage[],
  exceptions: readonly CoverageException[] = COVERAGE_EXCEPTIONS,
): string[] {
  return findFileFailures(files, exceptions);
}

const METRICS = ["lines", "functions", "branches", "statements"] as const;

/**
 * Compares one workspace's measured totals with its floor. A figure below the floor fails, and so does one more than
 * {@link RAISE_TOLERANCE} points above it, so floors only move up.
 */
export function checkWorkspaceFloor(
  workspace: string,
  totals: WorkspaceTotals,
  floor: CoverageFloor,
): string[] {
  const failures: string[] = [];
  for (const metric of METRICS) {
    const measured = totals[metric];
    if (measured < floor[metric]) {
      failures.push(
        `Workspace ${workspace} ${metric} coverage ${measured.toFixed(2)}% is below its ${floor[metric]}% floor.`,
      );
    } else if (measured > floor[metric] + RAISE_TOLERANCE) {
      failures.push(
        `Workspace ${workspace} ${metric} coverage ${measured.toFixed(2)}% is above its ${floor[metric]}% floor; raise the floor in coverage-floors.json to ${Math.floor(measured * 100) / 100}.`,
      );
    }
  }
  return failures;
}

/**
 * Reads each workspace's `coverage/lcov.info` and `coverage/coverage-summary.json` under `repoRoot` and returns every
 * gate failure: missing reports, per-file floors, exceptions and workspace floors.
 */
export function checkCoverage(
  repoRoot: string,
  exceptions: readonly CoverageException[] = COVERAGE_EXCEPTIONS,
  floors: Readonly<Record<string, CoverageFloor>> = loadCoverageFloors(),
  workspaces: readonly string[] = COVERAGE_WORKSPACES,
): string[] {
  const failures: string[] = [];
  const files: FileCoverage[] = [];
  for (const workspace of workspaces) {
    const reportDirectory = join(repoRoot, workspace, "coverage");
    const lcovPath = join(reportDirectory, "lcov.info");
    const summaryPath = join(reportDirectory, "coverage-summary.json");
    if (!existsSync(lcovPath) || !existsSync(summaryPath)) {
      failures.push(`No coverage report for ${workspace} under ${reportDirectory}; run its tests with coverage first.`);
      continue;
    }
    files.push(...parseLcov(readFileSync(lcovPath, "utf8"), workspace));
    const floor = floors[workspace];
    if (floor === undefined) {
      failures.push(`coverage-floors.json has no entry for ${workspace}.`);
      continue;
    }
    failures.push(
      ...checkWorkspaceFloor(workspace, parseSummaryTotals(readFileSync(summaryPath, "utf8")), floor),
    );
  }
  failures.push(...findFileFailures(files, exceptions));
  return failures;
}

/**
 * Runs the gate against the repository root, prints each failure and returns the process exit code.
 */
export function runGate(repoRoot: string = resolve(import.meta.dirname, "../..")): number {
  const failures = checkCoverage(repoRoot);
  for (const failure of failures) console.error(failure);
  return failures.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(runGate());
