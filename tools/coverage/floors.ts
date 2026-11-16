import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Minimum coverage percentages (0 to 100) one workspace must keep.
 */
export interface CoverageFloor {
  readonly lines: number;
  readonly functions: number;
  readonly branches: number;
  readonly statements: number;
}

/**
 * Absolute path of `coverage-floors.json`, the single file that holds every workspace floor.
 */
export const COVERAGE_FLOORS_PATH = path.join(
  import.meta.dirname,
  "..",
  "..",
  "coverage-floors.json",
);

function isPercentage(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 100;
}

function parseFloor(value: unknown, workspace: string): CoverageFloor {
  const record = (typeof value === "object" && value !== null ? value : {}) as Readonly<
    Record<string, unknown>
  >;
  const { lines, functions, branches, statements } = record;
  if (
    !isPercentage(lines) ||
    !isPercentage(functions) ||
    !isPercentage(branches) ||
    !isPercentage(statements)
  ) {
    throw new Error(
      `Coverage floor for ${workspace} needs lines, functions, branches and statements as percentages from 0 to 100.`,
    );
  }
  return { lines, functions, branches, statements };
}

/**
 * Parses the text of a coverage floors file into one floor per workspace and throws on a malformed entry.
 * @param text - The raw JSON text of the floors file.
 * @returns One floor per workspace, keyed by repo-relative path.
 */
export function parseCoverageFloors(text: string): Readonly<Record<string, CoverageFloor>> {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The coverage floors file must be an object keyed by workspace.");
  }
  const floors: Record<string, CoverageFloor> = {};
  for (const [workspace, value] of Object.entries(parsed)) {
    floors[workspace] = parseFloor(value, workspace);
  }
  return floors;
}

/**
 * Reads and parses `coverage-floors.json`.
 * @param floorsPath - Absolute path of the floors file.
 * @returns One floor per workspace, keyed by repo-relative path.
 */
export function loadCoverageFloors(
  floorsPath: string = COVERAGE_FLOORS_PATH,
): Readonly<Record<string, CoverageFloor>> {
  return parseCoverageFloors(readFileSync(floorsPath, "utf8"));
}

/**
 * The floor of one workspace, keyed by its repo-relative path (`.` for the root). Throws when it has no entry.
 * @param workspace - Repo-relative path of the workspace.
 * @returns The floor of that workspace.
 */
export function floorFor(workspace: string): CoverageFloor {
  const floor = loadCoverageFloors()[workspace];
  if (floor === undefined) {
    throw new Error(`coverage-floors.json has no entry for ${workspace}.`);
  }
  return floor;
}

/**
 * Returns a test or hook timeout that grows to 30 seconds when the run collects coverage, which slows every test.
 * @param defaultMilliseconds - Timeout to use without coverage.
 * @returns The timeout in milliseconds.
 */
export function coverageTimeout(defaultMilliseconds: number): number {
  return process.argv.includes("--coverage") ? 30_000 : defaultMilliseconds;
}
