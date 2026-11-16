import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const originalArguments = [...process.argv];

/**
 * Imports `sync.ts` afresh with `process.argv` set as if it was run as a
 * script, so its entry block runs.
 * @param commandArguments The arguments that follow the script path.
 */
async function runAsEntry(commandArguments: string[]): Promise<void> {
  process.argv = [
    originalArguments[0] ?? "",
    fileURLToPath(new URL("sync.ts", import.meta.url)),
    ...commandArguments,
  ];
  vi.resetModules();
  await import("./sync.ts");
}

describe("sync as the entry script", () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.argv = [...originalArguments];
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  test("reports an unknown command on stderr and exits with 1", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await runAsEntry(["unknown-command"]);

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Usage: sync.ts"));
    expect(process.exitCode).toBe(1);
  });
});
