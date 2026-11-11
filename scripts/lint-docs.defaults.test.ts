import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ensureLycheeBinary, LYCHEE_ARGS, LYCHEE_VERSION, runDocumentationLint } from "./lint-docs";

function fakeChild(event: string, payload: unknown): object {
  const child = {
    on(name: string, listener: (value: unknown) => void) {
      if (name === event)
        queueMicrotask(() => {
          listener(payload);
        });
      return child;
    },
  };
  return child;
}

const childProcess = vi.hoisted(() => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("node:child_process", () => childProcess);

describe("default dependencies", () => {
  let root: string;

  beforeEach(() => {
    vi.resetAllMocks();
    root = mkdtempSync(path.join(tmpdir(), "lint-docs-defaults-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("caches under the git common dir without downloading", async () => {
    const binaryPath = path.join(root, "lychee", "v1", "lychee");
    mkdirSync(path.dirname(binaryPath), { recursive: true });
    writeFileSync(binaryPath, "cached");
    childProcess.spawnSync.mockReturnValue({
      status: 0,
      stdout: `${root}\n`,
      stderr: "",
    });
    await expect(ensureLycheeBinary("v1")).resolves.toBe(binaryPath);
    expect(childProcess.spawnSync).toHaveBeenCalledWith("git", ["rev-parse", "--git-common-dir"], {
      encoding: "utf8",
    });
  });

  test("throws when the git common dir cannot be resolved", async () => {
    childProcess.spawnSync.mockReturnValue({
      status: 128,
      stdout: "",
      stderr: "fatal: not a repo",
    });
    await expect(ensureLycheeBinary("v1")).rejects.toThrow(
      /--git-common-dir" failed: fatal: not a repo/,
    );
  });

  test("uses the global fetch for the default download", async () => {
    childProcess.spawnSync.mockReturnValue({
      status: 0,
      stdout: `${root}\n`,
      stderr: "",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(vi.fn());
    try {
      await expect(ensureLycheeBinary("v1")).rejects.toThrow(/HTTP 500/);
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  test("spawns the binary with inherited stdio and returns its exit code", async () => {
    childProcess.spawn.mockImplementation(() => {
      return fakeChild("close", 4);
    });
    const ensureBinary = vi.fn().mockResolvedValue("/bin/lychee");
    await expect(runDocumentationLint(["--verbose"], ensureBinary)).resolves.toBe(4);
    expect(ensureBinary).toHaveBeenCalledWith(LYCHEE_VERSION);
    expect(childProcess.spawn).toHaveBeenCalledWith("/bin/lychee", [...LYCHEE_ARGS, "--verbose"], {
      stdio: "inherit",
    });
  });

  test("maps a signal exit to code 1", async () => {
    childProcess.spawn.mockImplementation(() => {
      return fakeChild("close", null);
    });
    await expect(runDocumentationLint([], vi.fn().mockResolvedValue("/bin/lychee"))).resolves.toBe(
      1,
    );
  });

  test("rejects when the binary fails to spawn", async () => {
    childProcess.spawn.mockImplementation(() => {
      return fakeChild("error", new Error("spawn failed"));
    });
    await expect(
      runDocumentationLint([], vi.fn().mockResolvedValue("/bin/lychee")),
    ).rejects.toThrow("spawn failed");
  });
});
