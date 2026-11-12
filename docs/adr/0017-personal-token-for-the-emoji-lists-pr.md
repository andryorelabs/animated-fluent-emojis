# 0017: Personal token for the emoji-lists pull request

## Status

Accepted

Date: 2026-10-06

Revised: 2026-11-12, the emoji-lists pull request now targets `develop`, whose
ruleset carries the rules this record cites for `main`
([ADR 0030](0030-develop-is-the-trunk.md)).

## Context

The Sync Assets `emoji-lists` job regenerates `docs/EMOJI_LIST_*.md` and opens a
pull request. The ruleset on `main`
([ADR 0001](0001-public-repo-security-posture.md)) enables
`require_extra_approval_for_unattributed_changes`, so a pull request authored by
`GITHUB_TOKEN` (the bot) can never merge: nobody but the bot is attributed to
it, and the bot cannot approve its own work. Pull requests created with
`GITHUB_TOKEN` also do not trigger `pull_request` workflows, so the required
`CI passed` check never runs.

## Decision

The job authenticates with `LISTS_BOT_TOKEN`, a fine-grained personal access
token owned by the maintainer:

- Repository access: only this repository.
- Permissions: Contents Read and write, Pull requests Read and write (Metadata
  read is implicit).
- No expiry.
- Stored with `gh secret set LISTS_BOT_TOKEN`.

A pull request authored by the token is attributed to the maintainer, runs CI
and auto-merges. This was verified: a Sync Assets run opened PR #80, CI ran, it
auto-merged and the commit shows as verified.

The "Allow GitHub Actions to create and approve pull requests" setting is turned
off (`can_approve_pull_request_reviews=false`); auto-merge stays enabled. Setup
and rotation are in [Set up asset hosting](../how-to/set-up-asset-hosting.md).

### Rejected options

- **A GitHub App**: it would also be attributed to a bot, so the same rule
  applies, and it adds an app to install and keep for one weekly pull request.
- **A bypass actor on the ruleset**: it weakens the protection that
  [ADR 0001](0001-public-repo-security-posture.md) sets for every other change.
- **A manual weekly merge**: it makes the maintainer a bottleneck for a
  mechanical change.
- **A `workflow_dispatch` CI workaround**: it runs CI on the bot's pull request
  but does not resolve the missing attribution, so the pull request still cannot
  merge.

## Consequences

- With no expiry, revocation is the kill switch. A leaked token is limited to
  this repository and cannot bypass the ruleset: its pull requests still need
  the required check.
- A missing, revoked or under-scoped token makes the `emoji-lists` step fail,
  but only on a run where the lists changed: the step exits before using the
  token when nothing changed. The `Report a failed sync` job then opens or
  comments on the `sync-assets failing` issue.
- The token belongs to the maintainer, so it must be rotated if access changes.
- Actions cannot create or approve pull requests anywhere in the repository.
