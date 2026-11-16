import { execFileSync } from "node:child_process";
import type * as nodeFs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  checkBranch,
  decidePush,
  parsePushedReferences,
  pushedBranches,
  realEnvironment,
  runPrePush,
  type PrePushEnvironment,
} from "./pre-push.ts";

function gitIn(cwd: string, ...gitArguments: string[]): void {
  execFileSync("git", gitArguments, { cwd, stdio: "pipe" });
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
});

const SHA = "a".repeat(40);
const ZERO = "0".repeat(40);

function pushLine(localRef: string, remoteRef: string, localSha = SHA): string {
  return `${localRef} ${localSha} ${remoteRef} ${ZERO}\n`;
}

function environment(overrides: Partial<PrePushEnvironment> = {}): PrePushEnvironment {
  return {
    hasRemoteBase: () => true,
    changedFiles: () => ["a.ts"],
    run: vi.fn(() => 0),
    log: vi.fn(),
    ...overrides,
  };
}

describe("parsePushedReferences", () => {
  test("skips blank and malformed lines", () => {
    expect(
      parsePushedReferences(`\nbroken line\n${pushLine("refs/heads/a", "refs/heads/a")}`),
    ).toEqual([
      {
        localRef: "refs/heads/a",
        localSha: SHA,
        remoteRef: "refs/heads/a",
        remoteSha: ZERO,
      },
    ]);
  });
});

describe("pushedBranches", () => {
  test("ignores deletions and tags", () => {
    const references = parsePushedReferences(
      pushLine("(delete)", "refs/heads/old", ZERO) + pushLine("refs/tags/v1", "refs/tags/v1"),
    );
    expect(pushedBranches(references)).toEqual([]);
  });

  test("judges a detached HEAD push by its remote branch", () => {
    const references = parsePushedReferences(pushLine("HEAD", "refs/heads/feat/x"));
    expect(pushedBranches(references)).toEqual(["feat/x"]);
  });
});

describe("checkBranch", () => {
  test.each(["main", "develop"])("refuses %s", (branch) => {
    expect(checkBranch(branch)).toContain(`refusing to push to ${branch}`);
  });

  test.each([
    "feat/add-export",
    "ao-3196-typescript-git-hooks",
    "renovate/lodash-4.x",
    "worktree-a1",
  ])("accepts %s", (branch) => {
    expect(checkBranch(branch)).toBeUndefined();
  });

  test.each(["Feature/Foo", "my-branch", "feat/", "wip/thing", "feat/Upper"])(
    "rejects the badly named branch %s",
    (branch) => {
      expect(checkBranch(branch)).toContain(`Invalid branch name: ${branch}`);
    },
  );
});

describe("decidePush", () => {
  test("refuses a detached HEAD pushed to main", () => {
    expect(decidePush(pushLine("HEAD", "refs/heads/main")).message).toContain("refusing");
  });

  test("refuses a detached HEAD pushed to a badly named branch", () => {
    expect(decidePush(pushLine("HEAD", "refs/heads/Bad_Name")).message).toContain("Invalid");
  });

  test("allows a detached HEAD pushed to a valid branch", () => {
    expect(decidePush(pushLine("HEAD", "refs/heads/fix/typo"))).toEqual({
      runChecks: true,
    });
  });

  test("skips checks when nothing updates a branch", () => {
    expect(decidePush(pushLine("refs/tags/v1", "refs/tags/v1"))).toEqual({
      runChecks: false,
    });
  });
});

describe("runPrePush", () => {
  test("returns 1 and logs on a refused branch", () => {
    const hookEnvironment = environment();
    expect(runPrePush(pushLine("refs/heads/main", "refs/heads/main"), hookEnvironment)).toBe(1);
    expect(hookEnvironment.run).not.toHaveBeenCalled();
  });

  test("skips when no branch is pushed", () => {
    expect(runPrePush("", environment())).toBe(0);
  });

  test("skips when origin/develop is missing", () => {
    const hookEnvironment = environment({ hasRemoteBase: () => false });
    expect(runPrePush(pushLine("HEAD", "refs/heads/feat/x"), hookEnvironment)).toBe(0);
    expect(hookEnvironment.run).not.toHaveBeenCalled();
  });

  test("stops at a failing typecheck", () => {
    const run = vi.fn(() => 2);
    expect(runPrePush(pushLine("HEAD", "refs/heads/feat/x"), environment({ run }))).toBe(2);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("lints the changed files after a passing typecheck", () => {
    const run = vi.fn(() => 0);
    expect(runPrePush(pushLine("HEAD", "refs/heads/feat/x"), environment({ run }))).toBe(0);
    expect(run).toHaveBeenLastCalledWith([
      "bun",
      "run",
      "oxlint",
      "--type-aware",
      "--deny-warnings",
      "a.ts",
    ]);
  });

  test("skips lint when no file changed", () => {
    const run = vi.fn(() => 0);
    const hookEnvironment = environment({ run, changedFiles: () => [] });
    expect(runPrePush(pushLine("HEAD", "refs/heads/feat/x"), hookEnvironment)).toBe(0);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("realEnvironment", () => {
  test("reports the remote base and the changed lintable files", () => {
    const repository = mkdtempSync(path.join(tmpdir(), "pre-push-hookEnvironment-"));
    const previous = process.cwd();
    try {
      gitIn(repository, "init", "--quiet", "-b", "develop");
      gitIn(repository, "config", "user.email", "t@example.com");
      gitIn(repository, "config", "user.name", "t");
      gitIn(repository, "config", "commit.gpgsign", "false");
      writeFileSync(path.join(repository, "a.ts"), "export {};\n");
      gitIn(repository, "add", ".");
      gitIn(repository, "commit", "--quiet", "-m", "base");
      process.chdir(repository);
      const real = realEnvironment();
      expect(real.hasRemoteBase()).toBe(false);
      gitIn(repository, "update-ref", "refs/remotes/origin/develop", "HEAD");
      gitIn(repository, "checkout", "--quiet", "-b", "feat/x");
      writeFileSync(path.join(repository, "b.ts"), "export {};\n");
      writeFileSync(path.join(repository, "c.md"), "x\n");
      gitIn(repository, "add", ".");
      gitIn(repository, "commit", "--quiet", "-m", "change");
      expect(real.hasRemoteBase()).toBe(true);
      expect(real.changedFiles()).toEqual(["b.ts"]);
    } finally {
      process.chdir(previous);
      rmSync(repository, { recursive: true, force: true });
    }
  });

  test("runs commands and logs to the console", () => {
    const real = realEnvironment();
    expect(real.run(["node", "-e", "process.exit(0)"])).toBe(0);
    const log = vi.spyOn(console, "log").mockReturnValue();
    real.log("hello");
    expect(log).toHaveBeenCalledWith("hello");
    log.mockRestore();
  });
});

describe("entry point", () => {
  test("records the hook status when run as a script", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => ({
      ...(await importOriginal<typeof nodeFs>()),
      readFileSync: () => "",
    }));
    const previousArgument = process.argv[1];
    process.argv[1] = path.join(import.meta.dirname, "pre-push.ts");
    vi.spyOn(console, "log").mockReturnValue();
    try {
      await import("./pre-push.ts");
      expect(process.exitCode).toBe(0);
    } finally {
      process.argv[1] = previousArgument ?? "";
      vi.doUnmock("node:fs");
    }
  });
});
