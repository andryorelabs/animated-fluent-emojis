# 0028: CI runner standard and a parallel Site Quality workflow

## Status

Accepted.

Date: 2026-11-06

Revised: 2026-11-06, the CI `package` job builds only the library, Site Quality
also runs on root build-config changes, the Astro site build runs with
`build.concurrency` 4 (its output matches a serial build, apart from a
build-time `Expires` timestamp and the key order of the Pagefind entry file,
which varies between builds of the same input), its e2e specs run fully
parallel, the Lighthouse job runs as 2 shards (still 5 runs per page), and the
CI `test` job caches Playwright browsers. Expected times: CI about 2.5 minutes,
Site Quality about 10-12 minutes without queueing.

## Context

The five andryorelabs repositories (andryore-web, animated-fluent-emojis, snug,
emet and aokit) agreed on one CI runner standard, v1.1. It lets a repository
send its light jobs to Blacksmith runners through one repository variable, and
keeps every heavy or sensitive job on GitHub-hosted runners.

Baseline for this repository, from the last 10 green runs and the last 30 days
of volume:

| Workflow            | Wall time | Bottleneck                                                        | Runs/month |
| ------------------- | --------- | ----------------------------------------------------------------- | ---------- |
| CI                  | 2-7 min   | Package 4-6 min, Test 2-4 min                                     | 307        |
| Site Quality        | 30-40 min | one job: build 6, smoke 4.4, a11y 5.4, visual 7, Lighthouse 8 min | 211        |
| Lint PR / Lint Docs | <1 min    | -                                                                 | 259 / 224  |

Quota math: this repository is public, so GitHub-hosted runners cost nothing and
give 4 vCPU. The Blacksmith free tier is 3000 min/month on 2 vCPU, shared by the
whole andryorelabs organization. Site Quality alone uses about 211 x 35, roughly
7400 min/month, more than twice that quota. The light jobs alone run on every
CI, Lint PR and Lint Docs run (about 790 workflow runs a month), which would
take a large share of a quota that the private repositories need more. Moving
jobs to Blacksmith would spend a shared budget to get fewer cores than the free
runner.

The time that matters is Site Quality: one sequential job of 30-40 minutes, the
slowest check on every site or docs pull request.

## Decision

- **The light jobs read the routing expression.** `ci.yml` `quality`,
  `commitlint` and `ci-passed`, `lint-pr.yml` `validate-title`, `lint-docs.yml`
  `check-links`, `lint-workflows.yml` `lint` and `labels.yml` `sync` use
  exactly:

  ```yaml
  runs-on: ${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' ||
    vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}
  ```

  A pull request from a fork always runs on `ubuntu-latest`, so fork code never
  reaches a paid runner. On `push` there is no `pull_request` payload, so the
  expression falls through to the variable and then to `ubuntu-latest`. There is
  no visibility gate: the variable alone decides.

- **Every other job keeps a literal `runs-on: ubuntu-latest`.** That covers
  `ci.yml` `test` and `package` (Vitest browser mode and the build are heavy),
  every `site-quality.yml` job (Docker, visual snapshots, Lighthouse),
  `release.yml` (npm trusted publishing is bound to GitHub-hosted runners),
  `sync-assets.yml` (a cron that deploys), `deploy-site.yml`, `codeql.yml` and
  `scorecard.yml`. No job uses a self-hosted or VPS label, and no workflow uses
  a Blacksmith action. `scripts/workflows-invariants.test.ts` enforces the
  routed list, the literal runner on everything else and the absence of
  self-hosted labels.

- **`BLACKSMITH_RUNNER` stays unset on this repository.** With the variable
  unset every light job resolves to `ubuntu-latest`, which is free and faster
  here (see Context). The wiring is kept so the repository matches the standard
  and can switch without a workflow change.

  - Turn it on:
    `gh variable set BLACKSMITH_RUNNER --body blacksmith-2vcpu-ubuntu-2404`
  - Roll back: `gh variable delete BLACKSMITH_RUNNER`

- **Site Quality is split into parallel jobs.** `build` computes
  `LAST_MODIFIED_DATES`, runs the same `docker build` with the tag
  `animated-fluent-emojis-site:ci`, then `docker save`s the image and uploads it
  as the `site-image` artifact (kept 1 day). `smoke` (nginx smoke script and the
  build output audit), `e2e` (accessibility and interaction specs), `visual`
  (visual snapshots) and `lighthouse` (Lighthouse budget) each need `build`,
  download the artifact, `docker load` it and start the container with the same
  readiness loop. They run concurrently, and each uploads its own
  `site-<job>-report` artifact on failure. `visual.sh` takes `VISUAL_SITE_IMAGE`
  to run the loaded image without building its own. The aggregate job
  `site-quality` keeps the check name
  `Smoke, accessibility and Lighthouse budget`, runs `if: always()` and fails
  unless every job it needs succeeded, so a failed `build` (which skips the test
  jobs) also fails it. Expected wall time is about 10-12 minutes: the build plus
  the slowest test job.

- **The Lighthouse job is a 2-shard matrix.** `lighthouse` runs with
  `matrix.shard: [1, 2]` and `fail-fast: false`, and passes
  `LIGHTHOUSE_SHARD=<shard>/<total>` to `lighthouse-budget.sh`, which audits
  page `k` of its list only in shard `(k mod total) + 1`. Each page is audited
  in exactly one shard, still with 5 runs and the same retries and budgets: the
  median of 5 is what keeps the score signal precise, so the runs are split
  across runners instead of being cut. A matrix job's result is `failure` when
  any shard fails, so the aggregate's `needs` keeps the job id `lighthouse` and
  still fails. Each shard uploads its own `site-lighthouse-report-<shard>`
  artifact on failure. `scripts/workflows-invariants.test.ts` checks that the
  shards cover every page once.

- **The e2e specs run fully parallel.** The Playwright e2e config sets
  `fullyParallel: true` and uses every core under CI.

- **CI `package` builds only the library.** It runs
  `turbo run build lint:package size --filter=animated-fluent-emojis`, still
  `--affected` on pull requests (turbo intersects the two). The 4.5-minute Astro
  build of every site page is no longer on the CI critical path; Site Quality's
  `build` job still builds the site in Docker, and its `paths` filter adds
  `tsconfig.base.json`, `bunfig.toml`, `turbo.json` and `package.json`, so a
  change to the shared build config still builds the site somewhere.

- **CI `test` caches Playwright browsers.** `~/.cache/ms-playwright` is cached
  under a key holding the resolved `playwright --version`. A warm cache skips
  the browser download; `playwright install --with-deps` still runs, so the
  system packages are installed on every run.

Rejected options:

- **Turn the variable on here too.** It spends the shared 2 vCPU quota on jobs
  that run for free on 4 vCPU, and the light jobs are already under a minute or
  two.
- **Route Site Quality or the CI test and package jobs to Blacksmith.** Their
  volume alone exceeds the free tier, and they need the cores.
- **Gate the expression on repository visibility.** The standard keeps one
  expression for every repository; the variable is the switch.
- **Rebuild the image in every test job.** It repeats the 6-minute build four
  times; one build and an artifact is cheaper and tests exactly one image.

## Consequences

- Site Quality drops from 30-40 minutes to about 10-12, and a failure names the
  job (and Lighthouse shard) that failed.
- CI drops from about 5.5 minutes to about 2.5: `package` no longer builds the
  site.
- Adding a Lighthouse page needs no workflow change: the script spreads its list
  over the shards.
- Each test job spends a minute or so on checkout, install and `docker load`;
  the four jobs use more total runner minutes than one job did, which is free on
  this public repository.
- The required check name does not change, so branch protection needs no edit.
- `apps/site/docker/smoke.sh` still builds its own image, as before the split.
- Switching the light jobs to Blacksmith is one `gh variable set` and needs no
  pull request; rolling back is one `gh variable delete`.
