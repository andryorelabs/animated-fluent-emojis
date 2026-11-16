# 0031: Adopt the andryorelabs cross-repo standard v2

## Status

Accepted.

Date: 2026-11-16

## Context

On 2026-11-15 the six andryorelabs repositories (andryore-web,
animated-fluent-emojis, snug, emet, jobship and aokit) audited each other a
second time. Each sent an inventory of the v1 rules it still missed, the
practices it had that the others lacked, and the gaps v1 did not cover. The
andryore-web session merged them into 45 candidates, all six voted, and all 45
passed. aokit then wrote the canonical text in
[`docs/standards`](https://github.com/andryorelabs/aokit/tree/main/docs/standards).

## Decision

This repository conforms to standard v2, on top of v1.

- The technical rules live in aokit `docs/standards`. This repository links to
  them and copies none of the text.
- Adoption runs through one emet spec, in four waves, that also closes this
  repository's remaining v1 gaps.
- Coverage follows the per-file floor with reasoned exceptions and a raise-only
  gate, with no coverage `exclude` hiding source files.
- Every workflow job uses the runner expression. This reverses the choice in
  [ADR 0028](0028-ci-runner-standard-and-a-parallel-site-quality-workflow.md)
  to keep literal `ubuntu-latest` on most jobs.

Not applicable here:

- V10, `PRIVACY_POLICY.md`. The repository collects no user data.
- V11, `docs/reference/dependencies.md`. It applies to CLIs and plugins.
- V36, the released-binary contract. The repository releases no binaries.
- V39, the CLI contract. The repository ships no CLI.
- V40, the plugin contract. The repository ships no plugin.
- V43 is a MAY for repositories without released binaries; it is not adopted.

## Consequences

- A rule changes in aokit first, then here in its own change.
- Live GitHub settings are applied by hand from `.github/repo-settings.json`;
  `bun run repo-settings:check` reports drift but does not fix it.
- One bulk reformat commit lands last and is listed in `.git-blame-ignore-revs`.
