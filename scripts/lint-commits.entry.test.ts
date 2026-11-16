import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const childProcess = vi.hoisted(() => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("node:child_process", () => childProcess);

const originalEntryArgument = process.argv[1];

function stubGit(responses: Record<string, string>): void {
  childProcess.spawnSync.mockImplementation((_command: string, arguments_: string[]) => {
    const stdout = responses[arguments_.join(" ")];
    return stdout === undefined
      ? { status: 128, stdout: "", stderr: "fatal" }
      : { status: 0, stdout: `${stdout}\n`, stderr: "" };
  });
}

function stubCommitlint(exitCode: number): void {
  childProcess.spawn.mockImplementation(() => {
    const child = {
      on(name: string, listener: (value: unknown) => void) {
        if (name === "close")
          queueMicrotask(() => {
            listener(exitCode);
          });
        return child;
      },
    };
    return child;
  });
}

/**
 * Imports `lint-commits.ts` afresh with `process.argv[1]` pointing at it, so
 * its entry-script block runs.
 */
async function runAsEntry(): Promise<void> {
  process.argv[1] = fileURLToPath(new URL("lint-commits.ts", import.meta.url));
  vi.resetModules();
  await import("./lint-commits.ts");
}

describe("lint-commits as the entry script", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.argv[1] = originalEntryArgument ?? "";
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  test("sets the exit code from commitlint", async () => {
    stubGit({
      "merge-base origin/develop HEAD": "base",
      "rev-parse HEAD": "head",
    });
    stubCommitlint(3);

    await runAsEntry();

    expect(process.exitCode).toBe(3);
  });

  test("reports a failure on stderr and exits with 1", async () => {
    stubGit({ "merge-base origin/develop HEAD": "base" });
    const error = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await runAsEntry();

    expect(error).toHaveBeenCalledWith("lint-commits: could not resolve HEAD.");
    expect(process.exitCode).toBe(1);
  });
});
