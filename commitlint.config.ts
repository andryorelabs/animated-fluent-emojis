/**
 * The commit and pull request title types: the Conventional Commits set from
 * `@commitlint/config-conventional` plus `deps` (dependency updates) and
 * `release` (release commits). `.github/workflows/lint-pr.yml` lists the same
 * types, and `scripts/lint-commits.test.ts` keeps the two in step.
 */
export const commitTypes = [
  "build",
  "chore",
  "ci",
  "deps",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "release",
  "revert",
  "style",
  "test",
] as const;

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", commitTypes],
  },
};
