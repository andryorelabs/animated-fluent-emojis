import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { LYCHEE_VERSION } from "./lint-docs";

const childProcess = vi.hoisted(() => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("node:child_process", () => childProcess);

const originalEntryArgument = process.argv[1];

function stubLychee(exitCode: number): void {
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
 * Imports `lint-docs.ts` afresh with `process.argv[1]` pointing at it, so its
 * entry-script block runs.
 */
async function runAsEntry(): Promise<void> {
  process.argv[1] = fileURLToPath(new URL("lint-docs.ts", import.meta.url));
  vi.resetModules();
  await import("./lint-docs.ts");
}

describe("lint-docs as the entry script", () => {
  let root: string;

  beforeEach(() => {
    vi.resetAllMocks();
    process.exitCode = undefined;
    root = mkdtempSync(path.join(tmpdir(), "lint-docs-entry-"));
  });

  afterEach(() => {
    process.argv[1] = originalEntryArgument ?? "";
    process.exitCode = undefined;
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  test("sets the exit code from lychee", async () => {
    const binaryPath = path.join(root, "lychee", LYCHEE_VERSION, "lychee");
    mkdirSync(path.dirname(binaryPath), { recursive: true });
    writeFileSync(binaryPath, "cached");
    childProcess.spawnSync.mockReturnValue({
      status: 0,
      stdout: `${root}\n`,
      stderr: "",
    });
    stubLychee(2);

    await runAsEntry();

    expect(process.exitCode).toBe(2);
  });

  test("reports a failure on stderr and exits with 1", async () => {
    childProcess.spawnSync.mockReturnValue({
      status: 128,
      stdout: "",
      stderr: "fatal",
    });
    const error = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await runAsEntry();

    expect(error).toHaveBeenCalledWith(expect.stringContaining("git-common-dir"));
    expect(process.exitCode).toBe(1);
  });
});
