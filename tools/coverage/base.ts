import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CoverageException } from "./coverage-exceptions";
import { type CoverageFloor, parseCoverageFloors } from "./floors";

/**
 * The floors and exceptions a git ref holds, used to prove a change never lowers them.
 */
export interface CoverageBaseline {
  readonly floors: Readonly<Record<string, CoverageFloor>>;
  readonly exceptions: readonly CoverageException[];
}

const FLOOR_METRICS = ["lines", "functions", "branches", "statements"] as const;

function git(
  repositoryRoot: string,
  arguments_: readonly string[],
): { ok: boolean; stdout: string } {
  const result = spawnSync("git", [...arguments_], { cwd: repositoryRoot, encoding: "utf8" });
  return { ok: result.status === 0, stdout: result.stdout };
}

/**
 * Tells whether a git ref exists.
 * @param repositoryRoot - Directory of the repository to ask.
 * @param ref - Branch, tag or commit to look up.
 * @returns True when `ref` resolves to a commit.
 */
export function refExists(repositoryRoot: string, ref: string): boolean {
  return git(repositoryRoot, ["rev-parse", "--verify", "--quiet", ref + "^{commit}"]).ok;
}

async function importExceptions(source: string): Promise<readonly CoverageException[]> {
  const directory = mkdtempSync(path.join(tmpdir(), "coverage-baseline-"));
  try {
    const file = path.join(directory, "coverage-exceptions.ts");
    writeFileSync(file, source);
    const loaded = (await import(pathToFileURL(file).href)) as {
      COVERAGE_EXCEPTIONS: readonly CoverageException[];
    };
    return loaded.COVERAGE_EXCEPTIONS;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Reads the floors and exceptions committed at a ref.
 * @param repositoryRoot - Directory of the repository to read from.
 * @param ref - Branch, tag or commit that holds the baseline.
 * @returns The baseline, or `undefined` when that ref does not hold it yet, as in the change that introduces the gate.
 */
export async function readBaseline(
  repositoryRoot: string,
  ref: string,
): Promise<CoverageBaseline | undefined> {
  const floors = git(repositoryRoot, ["show", `${ref}:coverage-floors.json`]);
  const exceptions = git(repositoryRoot, ["show", `${ref}:tools/coverage/coverage-exceptions.ts`]);
  if (!floors.ok || !exceptions.ok) return undefined;
  return {
    floors: parseCoverageFloors(floors.stdout),
    exceptions: await importExceptions(exceptions.stdout),
  };
}

/**
 * Compares the current floors and exceptions with a baseline. Raising a figure or deleting an exception is allowed.
 * @param current - The floors and exceptions in the working tree.
 * @param baseline - The floors and exceptions to hold the working tree to.
 * @returns One message per floor or exception floor that was lowered or dropped.
 */
export function compareWithBaseline(
  current: CoverageBaseline,
  baseline: CoverageBaseline,
): string[] {
  const failures: string[] = [];
  for (const [workspace, baseFloor] of Object.entries(baseline.floors)) {
    const floor = current.floors[workspace];
    if (floor === undefined) {
      failures.push(`coverage-floors.json dropped the floor for ${workspace}.`);
      continue;
    }
    for (const metric of FLOOR_METRICS) {
      if (floor[metric] < baseFloor[metric]) {
        failures.push(
          `Workspace ${workspace} ${metric} floor was lowered from ${String(baseFloor[metric])}% to ${String(floor[metric])}%; floors only rise.`,
        );
      }
    }
  }
  const currentByFile = new Map(current.exceptions.map((exception) => [exception.file, exception]));
  for (const baseException of baseline.exceptions) {
    const exception = currentByFile.get(baseException.file);
    if (exception === undefined) continue;
    if (exception.lines < baseException.lines || exception.functions < baseException.functions) {
      failures.push(
        `Coverage exception for ${exception.file} was lowered below its committed floor; add a test instead.`,
      );
    }
  }
  return failures;
}
