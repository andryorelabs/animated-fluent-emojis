import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { spawnInherited } from "./pre-commit.ts";

const ZERO_SHA = /^0+$/;
const PROTECTED_BRANCHES = new Set(["main", "develop"]);
const BRANCH_TYPES = "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert";
const VALID_BRANCH = new RegExp(
  `^(renovate/.+|worktree-.+|ao-[0-9]+-[a-z0-9._-]+|(${BRANCH_TYPES})/[a-z0-9._-]+)$`,
);
const LINT_PATHSPEC = ["*.ts", "*.tsx", "*.mts", "*.js", "*.mjs"];

/**
 * One ref update git feeds to the pre-push hook on stdin.
 */
export interface PushedRef {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
}

/**
 * Parses the pre-push stdin lines of `<local ref> <local sha> <remote ref> <remote sha>`.
 * @param stdin - The raw hook input.
 * @returns One entry per well-formed line.
 */
export function parsePushedReferences(stdin: string): PushedRef[] {
  const references: PushedRef[] = [];
  for (const line of stdin.split("\n")) {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/, 4);
    if (localRef && localSha && remoteRef && remoteSha) {
      references.push({ localRef, localSha, remoteRef, remoteSha });
    }
  }
  return references;
}

/**
 * Names the branches a push updates, skipping deletions and non-branch references such as tags. A
 * detached HEAD push (`HEAD:refs/heads/x`) is judged by the remote branch it targets.
 * @param references - The parsed ref updates.
 * @returns The remote branch names being created or updated.
 */
export function pushedBranches(references: readonly PushedRef[]): string[] {
  return references
    .filter(
      (reference) =>
        !ZERO_SHA.test(reference.localSha) && reference.remoteRef.startsWith("refs/heads/"),
    )
    .map((reference) => reference.remoteRef.slice("refs/heads/".length));
}

/**
 * Checks one branch against the push policy.
 * @param branch - The remote branch name.
 * @returns The refusal message, or undefined when the push may go ahead.
 */
export function checkBranch(branch: string): string | undefined {
  if (PROTECTED_BRANCHES.has(branch)) {
    return [
      `pre-push: refusing to push to ${branch}`,
      "Open a pull request instead: work on a feature branch, squash-merge into develop,",
      "and promote develop to main with a pull request merged by merge commit.",
    ].join("\n");
  }
  if (!VALID_BRANCH.test(branch)) {
    return [
      `Invalid branch name: ${branch}`,
      "Expected: <type>/<kebab-slug>   e.g. feat/add-export",
      `Types: ${BRANCH_TYPES.replaceAll("|", " ")}`,
      "Also accepted: ao-<n>-<slug>, renovate/*, worktree-*",
    ].join("\n");
  }
  return undefined;
}

/**
 * Decides whether a push is allowed and whether the affected checks should run.
 * @param stdin - The raw hook input.
 * @returns A refusal message, or `{ runChecks }` when the push may continue.
 */
export function decidePush(stdin: string): {
  message?: string;
  runChecks: boolean;
} {
  const branches = pushedBranches(parsePushedReferences(stdin));
  for (const branch of branches) {
    const message = checkBranch(branch);
    if (message !== undefined) return { message, runChecks: false };
  }
  return { runChecks: branches.length > 0 };
}

/**
 * The side effects the pre-push hook needs, injectable for tests.
 */
export interface PrePushEnvironment {
  readonly hasRemoteBase: () => boolean;
  readonly changedFiles: () => string[];
  readonly run: (argv: readonly string[], extraEnvironment?: Record<string, string>) => number;
  readonly log: (message: string) => void;
}

/**
 * Runs the pre-push hook: policy checks, then affected typecheck and lint of changed files.
 * @param stdin - The raw hook input.
 * @param environment - The side effects to use.
 * @returns The exit code the hook must end with.
 */
export function runPrePush(stdin: string, environment: PrePushEnvironment): number {
  const decision = decidePush(stdin);
  if (decision.message !== undefined) {
    environment.log(`\n${decision.message}\n`);
    return 1;
  }
  if (!decision.runChecks) {
    environment.log("pre-push: no branch update in this push, skipping affected checks");
    return 0;
  }
  if (!environment.hasRemoteBase()) {
    environment.log(
      "pre-push: origin/develop not found, skipping affected checks (run: git fetch origin develop)",
    );
    return 0;
  }
  environment.log("pre-push: typecheck of workspaces affected relative to origin/develop");
  const typecheck = environment.run(["bun", "run", "turbo", "run", "typecheck", "--affected"], {
    TURBO_SCM_BASE: "origin/develop",
  });
  if (typecheck !== 0) return typecheck;
  environment.log("pre-push: lint of files changed relative to origin/develop");
  const files = environment.changedFiles();
  return files.length === 0
    ? 0
    : environment.run(["bun", "run", "oxlint", "--type-aware", "--deny-warnings", ...files]);
}

/**
 * Builds the real git and process side effects for the hook.
 * @returns The environment the hook runs against.
 */
export function realEnvironment(): PrePushEnvironment {
  return {
    hasRemoteBase: () =>
      spawnSync("git", ["rev-parse", "--verify", "--quiet", "origin/develop"]).status === 0,
    changedFiles: () =>
      spawnSync(
        "git",
        [
          "diff",
          "-z",
          "--name-only",
          "--diff-filter=d",
          "origin/develop...HEAD",
          "--",
          ...LINT_PATHSPEC,
        ],
        { encoding: "utf8" },
      )
        .stdout.split("\0")
        .filter(Boolean),
    run: spawnInherited,
    log: (message) => {
      console.log(message);
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runPrePush(readFileSync(0, "utf8"), realEnvironment());
}
