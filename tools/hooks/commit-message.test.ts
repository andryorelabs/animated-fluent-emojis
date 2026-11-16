import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { buildCommitMessageCommand, runCommitMessage } from "./commit-message.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("node:child_process");
  process.exitCode = 0;
});

describe("buildCommitMessageCommand", () => {
  test("builds the commitlint command for the message file", () => {
    expect(buildCommitMessageCommand(".git/COMMIT_EDITMSG")).toEqual([
      "bunx",
      "commitlint",
      "--edit",
      ".git/COMMIT_EDITMSG",
    ]);
  });

  test.each([undefined, ""])("returns undefined for %j", (file) => {
    expect(buildCommitMessageCommand(file)).toBeUndefined();
  });
});

describe("runCommitMessage", () => {
  test("passes the runner exit code through", () => {
    const run = vi.fn(() => 3);
    expect(runCommitMessage("msg", run)).toBe(3);
  });

  test("fails without running when the message file is missing", () => {
    const run = vi.fn(() => 0);
    const error = vi.spyOn(console, "error").mockReturnValue();
    expect(runCommitMessage(undefined, run)).toBe(1);
    expect(run).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
});

describe("entry point", () => {
  test("lints the message file given as the first argument when run as a script", async () => {
    vi.resetModules();
    const spawnSync = vi.fn(() => ({ status: 0 }));
    vi.doMock("node:child_process", () => ({ spawnSync }));
    const previousArguments = process.argv.slice(1, 3);
    process.argv[1] = path.join(import.meta.dirname, "commit-message.ts");
    process.argv[2] = "msg-file";
    try {
      await import("./commit-message.ts");
      expect(spawnSync).toHaveBeenCalledWith(
        "bunx",
        ["commitlint", "--edit", "msg-file"],
        expect.anything(),
      );
      expect(process.exitCode).toBe(0);
    } finally {
      process.argv[1] = previousArguments[0] ?? "";
      process.argv[2] = previousArguments[1] ?? "";
    }
  });
});
