import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

interface DryRunTask {
  taskId: string;
  package: string;
}

interface DryRun {
  tasks: DryRunTask[];
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const turboBinary = path.join(repositoryRoot, "node_modules", ".bin", "turbo");

const workspaceDirectories = ["apps", "packages"].flatMap((group) =>
  readdirSync(path.join(repositoryRoot, group)).map((name) => `${group}/${name}`),
);

function readWorkspaceName(directory: string): string {
  const manifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, directory, "package.json"), "utf8"),
  ) as { name: string };
  return manifest.name;
}

function git(cwd: string, ...gitArguments: string[]): void {
  execFileSync("git", gitArguments, { cwd, stdio: "pipe" });
}

function affectedPackages(sandbox: string): Set<string> {
  const output = execFileSync(turboBinary, ["run", "test", "--affected", "--dry=json"], {
    cwd: sandbox,
    encoding: "utf8",
    env: {
      ...process.env,
      TURBO_SCM_BASE: "HEAD",
      TURBO_TELEMETRY_DISABLED: "1",
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  const dryRun = JSON.parse(output) as DryRun;
  return new Set(
    dryRun.tasks.filter((task) => task.taskId.endsWith("#test")).map((task) => task.package),
  );
}

describe("turbo --affected selection", () => {
  let sandbox = "";

  beforeAll(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), "affected-guard-"));
    git(
      repositoryRoot,
      "clone",
      "--quiet",
      "--no-hardlinks",
      "--no-checkout",
      repositoryRoot,
      sandbox,
    );
    git(sandbox, "checkout", "--quiet", "--detach", "HEAD");
    git(sandbox, "config", "user.name", "guard");
    git(sandbox, "config", "user.email", "guard@example.com");
  });

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  test.each(workspaceDirectories)(
    "a change in %s selects that workspace test task",
    (directory) => {
      const marker = path.join(sandbox, directory, "affected-guard-marker.txt");
      writeFileSync(marker, "changed");
      try {
        expect(affectedPackages(sandbox)).toContain(readWorkspaceName(directory));
      } finally {
        rmSync(marker, { force: true });
      }
    },
    60_000,
  );
});

describe("pre-push hook", () => {
  const hookPath = path.join(repositoryRoot, ".husky", "pre-push");
  const zero = "0".repeat(40);
  const someSha = "a".repeat(40);
  let repository = "";

  beforeAll(() => {
    repository = mkdtempSync(path.join(tmpdir(), "pre-push-hook-"));
    git(repository, "init", "--quiet");
  });

  afterAll(() => {
    rmSync(repository, { recursive: true, force: true });
  });

  function runHook(refLine: string) {
    return spawnSync("sh", [hookPath], {
      cwd: repository,
      encoding: "utf8",
      input: `${refLine}\n`,
    });
  }

  test("rejects an invalid branch name", () => {
    const result = runHook(`refs/heads/wip ${someSha} refs/heads/not-a-valid-branch ${zero}`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Invalid branch name");
  });

  test.each([
    "feat/add-export",
    "ao-3011-claude-settings",
    "renovate/vitest-5.x",
    "worktree-agent-a830facda4b7ca6c0",
  ])("accepts the branch name %s", (branch) => {
    const result = runHook(`refs/heads/${branch} ${someSha} refs/heads/${branch} ${zero}`);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("Invalid branch name");
  });

  test.each(["ao-3011", "ao-x-slug", "worktree-", "feature/add-export"])(
    "rejects the branch name %s",
    (branch) => {
      const result = runHook(`refs/heads/${branch} ${someSha} refs/heads/${branch} ${zero}`);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("Invalid branch name");
    },
  );

  test("skips the affected checks when origin/main is missing", () => {
    const result = runHook(`refs/heads/ci/valid-name ${someSha} refs/heads/ci/valid-name ${zero}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("origin/main not found");
  });

  test("skips the affected checks for a branch deletion", () => {
    const result = runHook(`(delete) ${zero} refs/heads/ci/valid-name ${someSha}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no branch update in this push");
  });

  test("skips the affected checks for a tag push", () => {
    const result = runHook(`refs/tags/v1 ${someSha} refs/tags/v1 ${zero}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no branch update in this push");
  });
});
