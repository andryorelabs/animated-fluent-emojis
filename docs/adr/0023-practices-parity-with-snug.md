# 0023: Practices parity with Snug

## Status

Accepted. Partly superseded by
[0027](0027-oxc-toolchain-replaces-prettier-and-most-of-eslint.md).

Date: 2026-10-19

Revised: 2026-10-19, added the `llms.txt` generator row (#150).

Revised: 2026-10-19, added the style lint (no `<style>` in `.astro`) row (#153).

Revised: 2026-10-20, added the style lint (@shadcn/lint) row (#157).

Revised: 2026-10-21, restricted the AFE column to the allowed values, corrected
the style lint row, added the five rows Snug records and the `@shadcn/lint` row.

Revised: 2026-11-02, the import-sort row now names Oxfmt's `sortImports` in
place of a Prettier plugin.

Revised: 2026-11-11, the Ko-fi sponsorship ask is gone from both repos, so the
`FUNDING.yml` row no longer implies one; the cross-repo rules now live in
[ADR 0029](0029-andryorelabs-cross-repo-standard.md); read it for the current
cross-repo rules.

## Context

AFE and Snug are maintained by the same person and started from the same
template. They drifted: AFE enforces more invariants in tests (ADRs, workflows,
coverage), and Snug runs more checks on the site (device matrix, CSP header,
structured data). A fix in one repo rarely reached the other.

## Decision

- Parity is the default. Both repos use the same tooling, gates, docs layout and
  style unless a practice does not apply to the repo's domain.
- A difference is allowed only when it is written in the table below, as `N/A`,
  `Deferred` or `Equivalent`, with the reason. Cost and preference are not
  reasons.
- Snug records the same table in its own ADR; the two copies are mirrors.

| Practice                                  | Snug                      | AFE        | Reason                                                                                                                                                                               |
| ----------------------------------------- | ------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build-time code highlighting              | N/A                       | Applies    | Snug shows no code outside Starlight                                                                                                                                                 |
| Dynamic OG images                         | N/A                       | Applies    | Snug has a handful of pages, AFE has one per emoji                                                                                                                                   |
| Privacy page                              | Applies                   | N/A        | AFE has no analytics                                                                                                                                                                 |
| Launch kit and store runbooks             | Applies                   | N/A        | AFE publishes to npm, not to stores                                                                                                                                                  |
| Build provenance                          | Attestation               | Equivalent | npm trusted publishing already gives AFE provenance ([ADR 0005](0005-npm-trusted-publishing.md))                                                                                     |
| BrowserStack and Percy                    | Applies                   | Deferred   | BrowserStack OSS approval is per repo and AFE has none yet                                                                                                                           |
| `FUNDING.yml`                             | N/A                       | N/A        | Removed from AFE; AFE asks for no sponsorship (ADR 0029)                                                                                                                             |
| Docs testing checklist                    | Applies                   | N/A        | Tied to BrowserStack, which AFE defers                                                                                                                                               |
| Package gates (publint, attw, size-limit) | N/A                       | Applies    | Snug ships no npm package; AFE enforces these gates on its published package                                                                                                         |
| Asset pipeline and sync-assets            | N/A                       | Applies    | Only AFE builds and publishes emoji assets                                                                                                                                           |
| Promo video (Remotion)                    | Applies                   | N/A        | Only Snug has a promo video                                                                                                                                                          |
| Extension and store E2E                   | Applies                   | N/A        | AFE is a library, not an extension                                                                                                                                                   |
| Umami analytics                           | Applies                   | N/A        | AFE has no analytics, same reason as the privacy page                                                                                                                                |
| Cross-browser library tests               | N/A                       | Applies    | Snug is Chromium-only; AFE is a multi-browser library                                                                                                                                |
| `jsx-no-literals` lint rule               | Applies                   | N/A        | Snug's UI copy is translatable; `@eslint-react` has no equivalent, so `eslint-plugin-react` stays for this one rule                                                                  |
| Import sorting                            | Oxfmt `sortImports`       | Applies    | Both repos sort imports with Oxfmt ([ADR 0027](0027-oxc-toolchain-replaces-prettier-and-most-of-eslint.md))                                                                          |
| `llms.txt` generator                      | Applies                   | Equivalent | AFE keeps `starlight-llms-txt` for the docs text and composes `llms.txt` and `llms-full.txt` with landing and emoji pages in `src/seo/llms.ts`                                       |
| Style lint (no `<style>` in `.astro`)     | `shadcn/no-inline-styles` | Equivalent | Equivalent: Snug's `@shadcn/lint` rule reports `<style>` in `.astro`; AFE bans the blocks with `local/no-astro-style-blocks`, and also runs `shadcn/no-inline-styles` on `apps/site` |
| Style lint (@shadcn/lint)                 | Applies                   | Applies    | Both repos enforce the same rule set; AFE scopes it to `apps/site` and exempts the generated ui layer ([ADR 0019](0019-shadcn-on-base-ui-for-the-website.md))                        |
| typescript-eslint preset                  | Deferred                  | Applies    | Snug is on `recommendedTypeChecked`; `strictTypeChecked` is a follow-up ramp                                                                                                         |
| PR template browser line                  | Chromium                  | N/A        | AFE's PR template has no browser line; Snug is Chromium-only and its line covers Chrome and Edge                                                                                     |
| Issue template fields                     | Extension                 | Equivalent | Same four templates; the fields ask for extension or library details respectively                                                                                                    |

## Alternatives considered

- **Keep the repos independent.** Each fix would be rediscovered by hand and the
  gap would keep growing.
- **Extract a shared template repo.** Too much machinery for two repos; the
  mirrored table is enough to keep them honest.

## Consequences

- A new practice in one repo is a ticket in the other, or a row in the table.
- Review of either repo can check the table instead of rediscovering the gap.
- `.github/FUNDING.yml` is deleted.
