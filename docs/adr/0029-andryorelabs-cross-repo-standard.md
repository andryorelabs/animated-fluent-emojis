# 0029: Adopt the andryorelabs cross-repo standard v1

## Status

Accepted.

Date: 2026-11-11

Revised: 2026-11-12, rule A1 of the standard (`develop` promoted to `main` by
merge commit) was not met when this record was accepted;
[ADR 0030](0030-develop-is-the-trunk.md) adopts it.

Revised: 2026-11-12, emet reviews and escalations run on `opus` instead of
`fable`, matching `emet.config.json` since #191.

## Context

Six andryorelabs repositories (andryore-web, animated-fluent-emojis, snug, emet,
jobship and aokit) were audited against each other on 2026-11-11. They shared
most of their tooling but differed in repository settings, community files,
README shape, docs wording, CI hygiene, formatting style and agent tooling. The
differences were accidental, and some were defects: in this repository Renovate
could automerge formatter bumps, secret scanning was off, and 36 URLs still
pointed at the previous owner path.

The six agreed on one numbered standard, v1, with each rule marked MUST, SHOULD
or not applicable by repository type.

## Decision

This repository conforms to standard v1.

- The technical rules live in
  [aokit `docs/standards`](https://github.com/andryorelabs/aokit/tree/main/docs/standards).
  The public brand rules (names, credit line, brand kit structure) live in
  [andryore-web `docs/brand/README.md`](https://github.com/andryorelabs/andryore-web/blob/main/docs/brand/README.md).
  This repository links to both and copies neither.
- Each product keeps its own palette, type and logo. The shared layer is the kit
  structure, the contrast test and the credit line `Built by AndryOre`.
- Formatting uses the Oxfmt defaults for every style option. Only
  `ignorePatterns`, `sortImports`, `sortTailwindcss`, `sortPackageJson` and
  `astro` are set.
- Repository rulesets are kept as JSON under `.github/rulesets`, and
  `bun run repo-settings:check` compares the live GitHub settings with those
  files.
- emet reviews and escalations in this repository run on the `opus` model alias
  (`models` in `emet.config.json`).

Not applicable here:

- `.github/FUNDING.yml`. This repository does not ask for sponsorship; only
  andryore-web carries the file.

Rejected options:

- Copy the standard into each repository. Six copies would drift the way the
  settings did.
- Keep two formatting styles. A standard with a style choice still needs the
  choice synced; the defaults need nothing.

## Consequences

- One bulk reformat commit, listed in `.git-blame-ignore-revs`.
- A rule changes in aokit or andryore-web first, then here in its own change.
- Live GitHub settings are applied by hand with `gh api` from the committed
  files; the check script reports drift but does not fix it.
