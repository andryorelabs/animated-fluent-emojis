# 0001: Public repo security posture

## Status

Accepted

Date: 2026-10-04

Revised: 2026-10-19, CodeQL now runs as a workflow
(`.github/workflows/codeql.yml`, JavaScript/TypeScript and Actions) instead of
the GitHub default setup, matching `snug`; the default setup must be disabled in
the repository security settings, otherwise both run (AO-2157).

Revised: 2026-10-21, removed the superseded CodeQL default-setup bullet under
Adopted and the matching Rejected bullet; Adopted now describes the workflow.

Revised: 2026-11-11, the repository is now org-owned
(`github.com/andryorelabs/animated-fluent-emojis`); secret scanning, push
protection and Dependabot security updates are on, and the merge-queue rejection
no longer claims it is unavailable on personal accounts (ADR 0029). The three
security features take effect when the AO-3004 repository settings are applied,
after the rulesets are committed under `.github/rulesets`.

Revised: 2026-11-11, the `main` ruleset now requires three strict status checks
(`CI passed`, `Validate PR title`, `Check markdown links`) instead of the single
`CI passed`, and the rulesets live in `.github/rulesets` with a test that fails
when a required check is not a workflow job name (AO-3009).

## Context

`animated-fluent-emojis` is a published npm library maintained by one person.
The repository lives under the `andryorelabs` organization
(`github.com/andryorelabs/animated-fluent-emojis`) and is public, and its supply
chain (GitHub Actions, npm publishing, dependencies) is the main attack surface.
The settings below follow the OpenSSF SCM best-practices guide and OpenSSF
Scorecard checks, and mirror the posture of the sibling `snug` repository.

The settings are applied once by the maintainer through the GitHub API (ticket
AO-1195) after the workflows and docs land, not by a committed script.

## Decision

### Adopted

- **Repository rulesets** on `main` (no bypass actors) and on `v*` tags, instead
  of classic branch protection. The `main` ruleset blocks deletion and
  force-pushes, requires a pull request, linear history, signed commits and the
  strict status checks below. The `v*` ruleset blocks tag deletion, updates and
  non-fast-forward changes, so a published tag cannot be moved.
- **0 required approvals** on the pull-request rule. A solo maintainer cannot
  approve their own PR, and 1+ approvals would force a bypass actor, which
  Scorecard's Branch-Protection check counts as admins not being enforced.
- **Squash-only merges** with linear history. The PR title becomes the commit
  message, which keeps `main` readable and the changelog derivable.
- **Signed commits.** GitHub signs squash merges made on the web, and release
  tags are signed locally (`git tag -s`).
- **Three strict required checks**: `CI passed` (the aggregator job in
  `ci.yml`), `Validate PR title` and `Check markdown links`. Adding or renaming
  a job behind the aggregator never requires touching the ruleset; renaming one
  of the three does, and `scripts/rulesets.test.ts` fails until
  `.github/rulesets/main.json` follows.
- **Every PR runs the full CI gate**, including docs-only changes (no
  `paths-ignore`).
- **Secret scanning and push protection** enabled, so a committed credential is
  reported and a push containing one is blocked.
- **Dependabot security updates** enabled for vulnerability fix PRs only.
  Renovate stays the source of routine version updates.
- **Private vulnerability reporting (PVR)** enabled, as described in
  [`SECURITY.md`](../../.github/SECURITY.md).
- **Immutable releases**, so a published GitHub Release and its assets cannot be
  edited or replaced.
- **`sha_pinning_required`** in the Actions settings, so every `uses:` must
  reference a full commit SHA. Renovate keeps the pins current.
- **Restrictive fork-PR workflow approval**, and read-only default
  `GITHUB_TOKEN` permissions.
- **CodeQL as a workflow** (`.github/workflows/codeql.yml`) for
  `javascript-typescript` and `actions`. The GitHub default setup stays
  disabled. Findings surface in code scanning and are not a required check.
- **OpenSSF Scorecard** on a schedule and on push to `main`
  (`.github/workflows/scorecard.yml`), published with a README badge. Not a
  required check.

### Rejected

- **`actions/dependency-review-action`**: GitHub's dependency graph does not
  parse `bun.lock`, so it would only see ranges from `package.json`.
- **`step-security/harden-runner`**: a third-party root-level agent in every
  job, for a repository with no runtime secrets and already-pinned actions.
- **A merge queue**: the required checks and squash auto-merge cover a solo
  maintainer's flow, and a queue would add a second CI run per PR for no gain.
- **Required code-owner review**: no benefit with a single owner.
- **Dependabot version updates**: Renovate is the single source of routine
  dependency updates.
- **Classic branch protection**: cannot express tag rules, and rulesets are the
  supported replacement.

## Consequences

- A solo maintainer can still merge their own PRs, but only through a PR. Direct
  pushes to `main` are blocked for everyone, admin included.
- Scorecard's score is expected to land around 5-7/10. Checks that need a second
  reviewer or contributor (Code-Review, Contributors, Fuzzing) are inherent to
  the solo constraint and are not treated as work items.
- Docs-only PRs spend CI minutes on the full pipeline. This is deliberate.
- Because releases are immutable and tags are protected, a bad release is fixed
  by publishing a new version, never by editing the old one.
- See
  [`docs/development.md#repository-settings`](../development.md#repository-settings)
  for the operational summary.
