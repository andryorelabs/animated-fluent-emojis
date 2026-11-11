# Issue tracker: Linear

Issues and specs for animated-fluent-emojis live in Linear. Every operation goes
through the `mcp__linear-server__*` MCP tools — there is no CLI equivalent to
`gh`/`glab` for Linear in this setup.

- Team: `AndryOre` (key `AO`). Project: `Animated Fluent Emojis` (exists — every
  `Spec:` issue must pass `project: "Animated Fluent Emojis"` explicitly when
  created — an issue with `Auto-close stale issues` enabled and no active
  cycle/project is only exempt from that auto-close while it belongs to one. A
  `Spec:` can sit untouched for months while its tickets get worked, so without
  `project` set it risks auto-closing out from under its own ticket cascade.
  **Sub-issues do NOT reliably inherit the parent's project** — verified in this
  workspace on the Snug project: sub-issues came back with no `project` field
  and were invisible to a project-filtered `list_issues`. Always pass `project`
  explicitly on every ticket, not just the spec).

## Conventions

- **Create the `Spec:` issue**:
  `save_issue({ team: "AndryOre", project: "Animated Fluent Emojis", title: "Spec: <feature>", state: "Backlog", description: <spec template> })`.
  Lives in `Backlog`, not `Todo` — cascade auto-close moves it to `Done` once
  its last sub-issue closes. Never apply `ready-for-agent` to it.
- **Create a ticket**:
  `save_issue({ team: "AndryOre", project: "Animated Fluent Emojis", title: "...", parentId: <Spec: issue id>, state: "Todo", description: <issue template>, labels: ["ready-for-agent", ...] })`.
  `state: "Todo"` must be passed explicitly — an issue created without an
  explicit `stateId` defaults to the team's first Backlog-category state.
  **Always pass `project` explicitly here too** (see above); verify with
  `get_issue({ id })` after creation if in doubt, since `list_issues` omits the
  `project` field from its results.
- **Read a ticket**: `get_issue({ id, includeRelations: true })` — always pass
  `includeRelations: true`; it defaults to `false` and is the only way to see
  `relations.blockedBy`. `list_issues` never surfaces relations at all.
- **List sub-issues of a spec**:
  `list_issues({ team: "AndryOre", parentId: <Spec: issue id> })`.
- **Comment**: `save_comment({ issueId, body })` / `list_comments({ issueId })`.
- **Apply/remove labels**: `save_issue({ id, labels: [...] })` — replaces the
  full label set; read the current labels first if adding one.
- **Blocking relations**: `save_issue({ id, blockedBy: ["<id>"] })` — native.
- **Move state**: `save_issue({ id, state: "In Progress" })` — see "Who writes
  state transitions" below for the only transition `/emet:run` writes directly.
- **Priority**: `0` = None, `1` = Urgent, `2` = High, `3` = Medium, `4` = Low.

## Who writes state transitions

`tracker.transitions`: `onStart: worker`, `onPrOpen: automatic`,
`onPrMerge: automatic` — team AO's Linear↔GitHub integration is configured
(`On PR or commit open → In Review`, `On PR or commit merge → Done`), same as
`snug` and `streamboss`. If that integration ever gets disconnected for this
repo, switch both to `coordinator` here and in `emet.config.json`'s
`tracker.transitions` so the coordinator writes them explicitly.

Also verify **Settings → My Account → Preferences → Behavior → "On move to
started status, assign to yourself"** is OFF — if it's on, every ticket a worker
moves to `In Progress` gets silently retro-assigned, breaking the
`assignee: null` frontier filter.
