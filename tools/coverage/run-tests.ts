import { spawnSync } from "node:child_process";
import path from "node:path";

import { runGate } from "./check";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Runs the Turborepo test tasks, then the coverage gate even when a task failed, so a failing run still names the
 * files and figures behind the failure.
 * @returns Zero when both steps pass, one otherwise.
 */
export async function runTests(): Promise<number> {
  const tests = spawnSync("turbo", ["run", "test", "test:root"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  const gate = await runGate(repositoryRoot);
  return gate === 0 && tests.status === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = await runTests();
