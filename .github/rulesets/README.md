# Repository settings and rulesets

The GitHub settings of `andryorelabs/animated-fluent-emojis` live as reviewable
files. The live repository is brought to match the files, never edited by hand
first.

- [`../repo-settings.json`](../repo-settings.json): every repository setting
  this project depends on, in four groups: `repository` (metadata, default
  branch, features and merge settings), `security`, `actions` (the default
  `GITHUB_TOKEN` permissions and fork pull request approval) and
  `code_scanning` (CodeQL default setup).
- [`develop.json`](develop.json): the ruleset on the `develop` trunk.
- [`main.json`](main.json): the ruleset on the default branch, which only
  accepts promotions from `develop`.
- [`tags.json`](tags.json): the ruleset on `v*` tags.

`bun run repo-settings:check` (`scripts/repo-settings/check.ts`) reads the live
repository through `gh api`, GET requests only, and compares it with these
files. It prints one line per difference and exits non-zero when there is any.
It needs `gh` signed in with admin access to the repository.

## Rulesets

The files use the import format of the
[repository rulesets API](https://docs.github.com/en/rest/repos/rules), so each
file is the request body as is.

| File           | Target                       | Rules                                                                                                                                                                                                                                                                   | Bypass actors |
| -------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `develop.json` | Branch `refs/heads/develop`  | No deletion, no force push, linear history, signed commits, pull request required (squash only, threads resolved, 0 approvals), strict required checks `CI passed`, `Validate PR title`, `Check markdown links`, `Analyze (javascript-typescript)`, `Analyze (actions)` | None          |
| `main.json`    | Default branch               | No deletion, no force push, signed commits, pull request required (merge commit only, threads resolved, 0 approvals), non-strict required checks `CI passed`, `Validate PR title`, `Check markdown links`, `Analyze (javascript-typescript)`, `Analyze (actions)`       | None          |
| `tags.json`    | Tags matching `refs/tags/v*` | No deletion, no force push, no update                                                                                                                                                                                                                                   | None          |

`main` drops linear history and the strict policy because a promotion is a
merge commit from `develop`, which `main` never has to be rebased onto. See
[ADR 0030](../../docs/adr/0030-develop-is-the-trunk.md).

`scripts/rulesets.test.ts` fails when a required check names no workflow job.

## Applying

Andry applies the settings by hand. The commands for every setting and ruleset
are in [`docs/brand/apply-spec.md`](../../docs/brand/apply-spec.md#repository-settings-and-rulesets),
next to the table of expected values. After applying, `bun run repo-settings:check`
must exit 0.
