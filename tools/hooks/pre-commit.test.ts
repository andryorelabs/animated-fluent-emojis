import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { PRE_COMMIT_COMMAND, runPreCommit, spawnInherited } from "./pre-commit.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("node:child_process");
  process.exitCode = 0;
});

describe("runPreCommit", () => {
  test("runs lint-staged and returns its status", () => {
    const run = vi.fn(() => 4);
    expect(runPreCommit(run)).toBe(4);
    expect(run).toHaveBeenCalledWith(PRE_COMMIT_COMMAND);
  });
});

describe("spawnInherited", () => {
  test("returns the child exit status", () => {
    expect(spawnInherited(["node", "-e", "process.exit(5)"])).toBe(5);
  });

  test("passes extra environment variables", () => {
    expect(
      spawnInherited(
        [
          "node",
          "-e",
          "process.exit(Object.entries(process.env).some(([k, v]) => k === 'HOOK_TEST' && v === 'x') ? 0 : 9)",
        ],
        {
          HOOK_TEST: "x",
        },
      ),
    ).toBe(0);
  });

  test("returns 1 when the command cannot start", () => {
    expect(spawnInherited(["definitely-not-a-command-xyz"])).toBe(1);
  });
});

describe("entry point", () => {
  test("runs lint-staged and records its status when run as a script", async () => {
    vi.resetModules();
    const spawnSync = vi.fn(() => ({ status: 0 }));
    vi.doMock("node:child_process", () => ({ spawnSync }));
    const previousArgument = process.argv[1];
    process.argv[1] = path.join(import.meta.dirname, "pre-commit.ts");
    try {
      await import("./pre-commit.ts");
      expect(spawnSync).toHaveBeenCalledWith("bunx", ["lint-staged"], expect.anything());
      expect(process.exitCode).toBe(0);
    } finally {
      process.argv[1] = previousArgument ?? "";
    }
  });
});
