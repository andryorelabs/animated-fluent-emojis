import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";

const gh = vi.hoisted(() => ({
  calls: [] as string[][],
  fail: false,
}));

vi.mock("node:child_process", () => ({
  execFile: (
    _file: string,
    commandArguments: string[],
    _options: unknown,
    callback: (error: Error | null, result?: { stdout: string }) => void,
  ) => {
    gh.calls.push(commandArguments);
    if (gh.fail) {
      callback(new Error("gh is not installed"));
      return;
    }
    const endpoint = commandArguments.at(-1) ?? "";
    callback(null, { stdout: endpoint.endsWith("/rulesets") ? "[]" : "{}" });
  },
}));

const { runRepositorySettingsCheck } = await import("./check.ts");

/**
 * Imports `check.ts` afresh with `process.argv[1]` pointing at it, so its
 * entry-script block runs.
 */
async function runAsEntry(): Promise<void> {
  process.argv[1] = fileURLToPath(new URL("check.ts", import.meta.url));
  vi.resetModules();
  await import("./check.ts");
}

describe("runRepositorySettingsCheck with the default dependencies", () => {
  afterEach(() => {
    gh.calls.length = 0;
    gh.fail = false;
    vi.restoreAllMocks();
  });

  test("reads through gh and reports on the console", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(vi.fn());

    const exitCode = await runRepositorySettingsCheck();

    expect(exitCode).toBe(1);
    expect(gh.calls.length).toBeGreaterThan(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("repo-settings: "));
  });

  test("rejects when gh fails", async () => {
    gh.fail = true;

    await expect(runRepositorySettingsCheck()).rejects.toThrow(/gh is not installed/);
  });

  describe("as the entry script", () => {
    const originalArgument = process.argv[1];
    const originalExitCode = process.exitCode;

    afterEach(() => {
      process.argv[1] = originalArgument ?? "";
      process.exitCode = originalExitCode;
      vi.resetModules();
    });

    test("sets the exit code from the comparison", async () => {
      vi.spyOn(console, "log").mockImplementation(vi.fn());

      await runAsEntry();

      expect(process.exitCode).toBe(1);
    });

    test("prints the failure and sets exit code 1 when gh fails", async () => {
      gh.fail = true;
      const error = vi.spyOn(console, "error").mockImplementation(vi.fn());
      process.exitCode = 0;

      await runAsEntry();

      expect(error).toHaveBeenCalledWith("gh is not installed");
      expect(process.exitCode).toBe(1);
    });
  });
});
