# emet operational specifics for animated-fluent-emojis

Repo-specific config the emet plugin reads before `/emet:run` starts its
pipeline. Machine-checkable values (trunk and remote, ticket id shape,
concurrency, preflight's required files, handoff and usage thresholds) live in
[`emet.config.json`](../../emet.config.json) at the repo root, validated against
`https://emet.andryore.dev/schema/emet.config.schema.json`. This file holds the
"why" prose and everything a JSON value can't express.

Check the setup with `emet doctor`. `emet preflight` runs before dispatch and
refuses to start a run when a required file or command is missing.

## Tracker

Tracker: `linear`. See [issue-tracker.md](issue-tracker.md) for the literal
calls `/emet:run` makes to create, read, and transition tickets here, and
[triage-labels.md](triage-labels.md) for the triage vocabulary.

## Ticket ids and branches

- Ticket id shape: `^AO-\d+$` (e.g. `AO-1`), issued by Linear team `AO`.
- Worker branch: `ao-<n>-<slug>`. Each worker checks this out itself at worktree
  step 0. Local-only, never pushed.
- Commit: add a trailer line referencing the ticket at the end of the commit
  body (see `commit.trailer` and `commit.trailerPosition` in `emet.config.json`
  if this repo wants something other than the built-in default).

## Worktree setup

A worker's first action in a fresh worktree is always `git worktree lock` with
the reason the coordinator generated for it (`emet lock-reason`). That is built
into emet itself, identical in every repo, and nothing below needs to restate
it.

A fresh worktree only needs `bun install --frozen-lockfile --silent`
(`worktree.bootstrap` in `emet.config.json`). The isolated linker installs a
`node_modules` per workspace, so every worktree gets its own. No codegen and no
env files to copy from the main checkout: this is a framework component library
with no runtime secrets.

## Self-check

Commands a worker runs before considering its own change done: see
`commands.selfCheck` in `emet.config.json`.

`bun run check` and `bun run test` are the self-check; both fan out through
Turborepo to the workspaces and the root. `build` (`tsc -b && vite build`) is
deliberately left out: it's slow and the maintainer asks for it explicitly,
except in tickets whose acceptance criteria require it.

## Concurrency

Max `concurrency.waveSize` live agents per wave, and a global
`concurrency.maxLiveWorkers` cap shared **host-wide**: by every concurrently
running `/emet:run` coordinator on this machine, across _every_ repo and every
git worktree of every repo (e.g. several Orca worktrees of this same repo, or an
entirely unrelated repo, all draw from one pool). The pool lives under
`~/.local/state/emet/slots`, not this repo's own `--git-common-dir`. A slot is
held only while its worker is actually live; it's released as soon as that
worker reports done, not held for the rest of the wave.

`concurrency.maxLiveWorkers` defaults to `"auto"`: derived from this host's own
cpu count and RAM rather than a fixed number, so it scales with the machine emet
actually runs on instead of an arbitrary constant. A separate memory-headroom
brake also denies new slot acquisitions when `MemAvailable` is too low,
regardless of how many slots are technically free. See `emet doctor` for this
host's resolved numbers, and pin an explicit integer here instead of `"auto"`
only when there's a specific reason to cap this repo lower than the host
otherwise would. Both settings live in `emet.config.json`.
`EMET_MAX_LIVE_WORKERS` (accepting `"auto"` too) and
`EMET_RUN_IDLE_THRESHOLD_MS` override their config counterparts when set.
