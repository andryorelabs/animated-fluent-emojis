# Triage labels

The five canonical triage roles map 1:1 to this workspace's Linear labels:

| Label             | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `needs-triage`    | Freshly captured, not yet reviewed or spec'd                 |
| `needs-info`      | Waiting on more information before it can proceed            |
| `ready-for-agent` | Spec'd and unblocked — eligible for automatic agent dispatch |
| `ready-for-human` | Needs a human decision or judgment call before continuing    |
| `wontfix`         | Reviewed and deliberately not going to be worked on          |

All five exist in this Linear workspace (verified with `list_issue_labels`).
`/emet:run` never creates labels itself — if one goes missing, recreate it by
hand.

`/emet:run`'s dispatch frontier ([issue-tracker.md](issue-tracker.md)) requires
`ready-for-agent` alongside `assignee: null` and no open `blockedBy` — a ticket
without this label never gets picked up automatically, even if otherwise
unblocked and unassigned.
