# 0030: develop is the trunk, promoted to main by merge commit

## Status

Accepted. Amends [0001](0001-public-repo-security-posture.md).

Date: 2026-11-12

## Context

Every pull request in this repository was squash-merged into `main`, and the
`develop` branch was deleted on 2026-10-05 (AO-1195). The andryorelabs standard
v1 that [ADR 0029](0029-andryorelabs-cross-repo-standard.md) adopts requires the
opposite in its rule A1: work lands on `develop` and reaches `main` only by
promotion. ADR 0029 did not list that rule as not applicable, so the repository
claimed a conformance it did not have. Renovate, emet and the agent tooling
shared across the six repositories assume `develop`.

## Decision

`develop` is the trunk.

- Pull requests are squash-merged into `develop`. The `develop` ruleset allows
  squash only and requires linear history, signed commits and the three strict
  status checks (`CI passed`, `Validate PR title`, `Check markdown links`).
- A promotion is a pull request from `develop` to `main`, titled
  `chore: 🔀 promote develop to main` and merged with a merge commit. The `main`
  ruleset allows merge commits only, drops linear history and does not require
  the branch to be up to date.
- There is no sync step. Nothing merges `main` back into `develop`.
- `main` stays the default branch, and it is the only branch that deploys the
  website and carries `v*` tags. A release bump lands on `develop`, a promotion
  follows, and the tag is cut on the promotion merge commit.
- CI and CodeQL run on a push to `main` and on a push to `develop`. Labels,
  OpenSSF Scorecard and the website deploy run on `main` only.
- Renovate and the weekly emoji-lists pull request target `develop`.
- The `pre-push` hook and the agent deny list refuse a push to `main` or to
  `develop`. `emet.config.json` sets `repo.trunk` to `develop`.
- The `commitlint` job is skipped on a promotion. A promotion carries squash
  commits that were each linted on their own pull request.

Rejected options:

- Squash `develop` into `main`. Each squash leaves `main` with a commit that
  `develop` lacks, so the next promotion conflicts until `main` is merged back,
  and the `develop` ruleset forbids that push. andryore-web and streamboss hit
  this before they moved to merge commits.
- Keep `main` as the only branch and record rule A1 as not applicable. The
  shared tooling would keep a special case for one repository.
- Automate the promotion with a workflow. No sibling repository does, and a
  promotion is a release decision the maintainer makes.

## Consequences

- `main` is no longer linear: it holds one merge commit per promotion.
  `develop` stays linear.
- Merge commits are on at repository level, with the pull request title and
  body as the commit message. Rebase merging stays off.
- A change reaches the website and a release only after a promotion.
- The live branch, settings and rulesets are applied by hand from the committed
  files, and `bun run repo-settings:check` reports drift.
