---
name: add-adr
description: Write or update an architecture decision record in docs/adr. Use when a decision is hard to reverse, surprising without context, and the result of a real trade-off.
---

# Writing an ADR

1. Read `docs/adr/README.md` and the ADRs touching the area; flag a contradiction instead of overriding it.
2. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-kebab-title.md`, using the next free number.
3. Fill in Context, Decision and Consequences. Use the terms in `GLOSSARY.md`.
4. Add a row to the index table in `docs/adr/README.md`. `docs/adr/adr-invariants.test.ts` fails when an ADR is missing from the index.
5. Add any new term to `GLOSSARY.md`.
6. To reverse or change a decision, edit its ADR in place and add a `Revised: YYYY-MM-DD, what changed` line under `Date:`; never write a new ADR for it.
