import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * The command the pre-commit hook runs: lint-staged over the staged files.
 */
export const PRE_COMMIT_COMMAND = ["bunx", "lint-staged"] as const;

/**
 * Runs the pre-commit command through the given runner.
 * @param run - Executes an argv and returns its exit status.
 * @returns The exit code the hook must end with.
 */
export function runPreCommit(run: (argv: readonly string[]) => number): number {
  return run(PRE_COMMIT_COMMAND);
}

/**
 * Runs an argv with inherited stdio.
 * @param argv - The command and its arguments.
 * @param extraEnvironment - Extra environment variables for the child.
 * @returns The exit status, or 1 when the command could not start.
 */
export function spawnInherited(
  argv: readonly string[],
  extraEnvironment?: Record<string, string>,
): number {
  const [command = "", ...commandArguments] = argv;
  return (
    spawnSync(command, commandArguments, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnvironment },
    }).status ?? 1
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runPreCommit(spawnInherited);
}
