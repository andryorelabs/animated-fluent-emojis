import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { compareWithBaseline, readBaseline, refExists } from "./base";
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
 * How far, as a fraction, a measured exception figure may sit above its exception floor before the floor counts as
 * stale.
 */
export const EXCEPTION_RAISE_TOLERANCE = 0.005;

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

function repositoryPath(workspace: string, file: string): string {
  return workspace === "." ? path.posix.normalize(file) : path.posix.join(workspace, file);
}

/**
 * Parses lcov text into one {@link FileCoverage} per `SF:` record, prefixing each path with its workspace.
 * @param lcov - The lcov report text.
 * @param workspace - Repo-relative path of the workspace the report belongs to.
 * @returns One coverage record per source file.
 */
export function parseLcov(lcov: string, workspace: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let current: { path: string; lf: number; lh: number; fnf: number; fnh: number } | undefined;
  for (const rawLine of lcov.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("SF:")) {
      current = {
        path: repositoryPath(workspace, line.slice(3).replaceAll("\\", "/")),
        lf: 0,
        lh: 0,
        fnf: 0,
        fnh: 0,
      };
    } else if (current !== undefined && line.startsWith("LF:")) {
      current.lf = Number(line.slice(3));
    } else if (current !== undefined && line.startsWith("LH:")) {
      current.lh = Number(line.slice(3));
    } else if (current !== undefined && line.startsWith("FNF:")) {
      current.fnf = Number(line.slice(4));
    } else if (current !== undefined && line.startsWith("FNH:")) {
      current.fnh = Number(line.slice(4));
    } else if (current !== undefined && line === "end_of_record") {
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
 * @param text - The raw JSON text of the summary report.
 * @returns The workspace totals as percentages.
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
    } else if (
      lines > exception.lines + EXCEPTION_RAISE_TOLERANCE ||
      functions > exception.functions + EXCEPTION_RAISE_TOLERANCE
    ) {
      failures.push(
        `${file.path} has ${describeFile(file)}, above its exception floor of ${percent(exception.lines)} lines and ${percent(exception.functions)} functions; raise the exception floor.`,
      );
    }
  }
  const reported = new Set(files.map((file) => file.path));
  for (const exception of exceptions) {
    if (!reported.has(exception.file)) {
      failures.push(
        `Coverage exception for ${exception.file} names a file missing from the report.`,
      );
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
 * @param files - Coverage of each measured file.
 * @param exceptions - The coverage exceptions to apply.
 * @returns One failure message per violation.
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
 * @param workspace - Repo-relative path of the workspace.
 * @param totals - The measured workspace totals.
 * @param floor - The floor the totals must meet.
 * @returns One failure message per metric outside its floor.
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
        `Workspace ${workspace} ${metric} coverage ${measured.toFixed(2)}% is below its ${String(floor[metric])}% floor.`,
      );
    } else if (measured > floor[metric] + RAISE_TOLERANCE) {
      failures.push(
        `Workspace ${workspace} ${metric} coverage ${measured.toFixed(2)}% is above its ${String(floor[metric])}% floor; raise the floor in coverage-floors.json to ${String(Math.floor(measured * 100) / 100)}.`,
      );
    }
  }
  return failures;
}

/**
 * Reads each workspace's `coverage/lcov.info` and `coverage/coverage-summary.json` under `repositoryRoot` and returns every
 * gate failure: missing reports, per-file floors, exceptions and workspace floors.
 * @param repositoryRoot - Absolute path of the repository root.
 * @param exceptions - The coverage exceptions to apply.
 * @param floors - The floors keyed by workspace.
 * @param workspaces - The workspaces to check.
 * @returns Every gate failure.
 */
export function checkCoverage(
  repositoryRoot: string,
  exceptions: readonly CoverageException[] = COVERAGE_EXCEPTIONS,
  floors: Readonly<Record<string, CoverageFloor>> = loadCoverageFloors(),
  workspaces: readonly string[] = COVERAGE_WORKSPACES,
): string[] {
  const failures: string[] = [];
  const files: FileCoverage[] = [];
  for (const workspace of workspaces) {
    const reportDirectory = path.join(repositoryRoot, workspace, "coverage");
    const lcovPath = path.join(reportDirectory, "lcov.info");
    const summaryPath = path.join(reportDirectory, "coverage-summary.json");
    if (!existsSync(lcovPath) || !existsSync(summaryPath)) {
      failures.push(
        `No coverage report for ${workspace} under ${reportDirectory}; run its tests with coverage first.`,
      );
      continue;
    }
    files.push(...parseLcov(readFileSync(lcovPath, "utf8"), workspace));
    const floor = floors[workspace];
    if (floor === undefined) {
      failures.push(`coverage-floors.json has no entry for ${workspace}.`);
      continue;
    }
    const totals = parseSummaryTotals(readFileSync(summaryPath, "utf8"));
    failures.push(...checkWorkspaceFloor(workspace, totals, floor));
  }
  failures.push(...findFileFailures(files, exceptions));
  return failures;
}

/**
 * Git ref whose floors a change must not lower when no `--base` argument or `COVERAGE_BASE_REF` is given.
 */
export const DEFAULT_BASE_REF = "origin/develop";

/**
 * Compares the committed floors and exceptions with those at `ref`. An explicit ref that does not resolve is a failure,
 * so CI cannot skip the check by mistake; the default ref is skipped when it is missing, as in a shallow clone.
 * @param repositoryRoot - Absolute path of the repository root.
 * @param ref - The git ref holding the baseline.
 * @param explicit - Whether the ref was requested explicitly.
 * @param current - The committed floors and exceptions.
 * @param current.floors - The committed floors keyed by workspace.
 * @param current.exceptions - The committed coverage exceptions.
 * @returns One failure message per lowered floor or exception.
 */
export async function checkAgainstBase(
  repositoryRoot: string,
  ref: string,
  explicit: boolean,
  current: {
    floors: Readonly<Record<string, CoverageFloor>>;
    exceptions: readonly CoverageException[];
  },
): Promise<string[]> {
  if (!refExists(repositoryRoot, ref)) {
    return explicit
      ? [`Cannot read the coverage baseline: ${ref} does not resolve to a commit.`]
      : [];
  }
  const baseline = await readBaseline(repositoryRoot, ref);
  return baseline === undefined ? [] : compareWithBaseline(current, baseline);
}

function baseRefFrom(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv,
): { ref: string; explicit: boolean } {
  const index = argv.indexOf("--base");
  const fromArgument = index === -1 ? undefined : argv[index + 1];
  const explicitRef = fromArgument ?? environment.COVERAGE_BASE_REF;
  return explicitRef === undefined || explicitRef === ""
    ? { ref: DEFAULT_BASE_REF, explicit: false }
    : { ref: explicitRef, explicit: true };
}

/**
 * Runs the gate against the repository root, prints each failure and returns the process exit code.
 * @param repositoryRoot - Absolute path of the repository root.
 * @param argv - The command-line arguments.
 * @returns The process exit code.
 */
export async function runGate(
  repositoryRoot: string = path.resolve(import.meta.dirname, "../.."),
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  const failures = argv.includes("--base-only") ? [] : checkCoverage(repositoryRoot);
  const { ref, explicit } = baseRefFrom(argv, process.env);
  failures.push(
    ...(await checkAgainstBase(repositoryRoot, ref, explicit, {
      floors: loadCoverageFloors(),
      exceptions: COVERAGE_EXCEPTIONS,
    })),
  );
  for (const failure of failures) console.error(failure);
  return failures.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = await runGate();
