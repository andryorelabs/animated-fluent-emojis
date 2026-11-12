# Development

## Setup

```sh
bun install
bunx playwright install chromium firefox webkit
```

Bun `1.4.4` is required (see `packageManager` in `package.json`). Husky installs
the git hooks on `bun install` through the `prepare` script.

## Workspaces

The repository is a Bun workspaces monorepo
([ADR 0016](adr/0016-bun-workspaces-monorepo.md)) with Turborepo (local cache
only) on top.

| Workspace                         | Package                           | What lives there                                                                                                                                |
| --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `.` (root)                        | `animated-fluent-emojis-monorepo` | Private host, tooling only: `eslint-rules/`, `oxlint-plugins/`, `scripts/`, `docs/`, the brand kit, `turbo.json`, `bunfig.toml`.                |
| `packages/animated-fluent-emojis` | `animated-fluent-emojis`          | The one published package: `src/`, the playground, Vite, Vitest and tsconfig build configs, `size-limit` and `attw`.                            |
| `apps/assets`                     | `@animated-fluent-emojis/assets`  | Private asset pipeline: `sync.ts`, its modules and tests, `public-slugs.json`. Outputs `dist-assets/`, `dist-files/`, `.cache/assets` under it. |
| `apps/site`                       | `@animated-fluent-emojis/site`    | Private website: Astro, Starlight, Tailwind, ten locales, a container deployed through Coolify.                                                 |

Shared dependency versions are in the Bun catalog in the root `package.json`
(`catalog:`). `bunfig.toml` sets `linker = "isolated"` explicitly, and it works
with the Vitest `browser`, `node` and `astro` projects without a fallback. If it
ever breaks one of them, try a narrow `publicHoistPattern` first and
`linker = "hoisted"` only after that.

### Script fan-out

Root scripts keep their names and fan out through `turbo.json`. `check` runs
`turbo run check check:root` and `test` runs `turbo run test test:root`. The
Turborepo tasks are `transit`, `typecheck`, `check`, `test`, `test:coverage`,
`build`, `lint:package` and `size`, plus the root tasks `//#check:root`,
`//#test:root` and `//#test:coverage:root`. `transit` makes a change in the
library invalidate its dependents, such as `apps/assets` through its
`animated-fluent-emojis: workspace:*` devDependency. Format, lint and knip run
once for the whole repository in `check:root`.

A workspace script must not share a name with a Turborepo task unless it is
meant to run in that task: `turbo run build` executes any workspace script
called `build`. That is why the pipeline scripts in `apps/assets` are named
`sync:detect`, `sync:build`, `sync:verify-live`, `sync:lists` and `sync:files`,
and the root `assets:*` scripts call them with
`bun run --cwd apps/assets sync:*`. `--cwd` changes the working directory, so
any path passed through must be absolute.

## Scripts

| Script                       | What it does                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                | Starts the Vite dev server serving the playground (library workspace).                                                                                                    |
| `bun run build`              | Runs `turbo run build`: type-checks (`tsc -b`) and builds the library with Vite. Slow; run only if asked.                                                                 |
| `bun run check`              | Aggregate gate: `turbo run check check:root` (workspace typecheck and lint:package; repo-wide format:check, lint, typecheck and knip).                                    |
| `bun run fix`                | Aggregate autofix: format:write, lint:fix, typecheck.                                                                                                                     |
| `bun run format:check`       | Checks formatting with Oxfmt (no writes).                                                                                                                                 |
| `bun run format:write`       | Formats the repository with Oxfmt.                                                                                                                                        |
| `bun run lint`               | Runs Oxlint (`--type-aware --deny-warnings`), then ESLint on `**/*.astro` with `--max-warnings=0` (cached).                                                               |
| `bun run lint:fix`           | Runs the same two linters with `--fix`.                                                                                                                                   |
| `bun run typecheck`          | Runs `turbo run typecheck`, then the root `tsc --noEmit`.                                                                                                                 |
| `bun run knip`               | Finds unused files, exports and dependencies.                                                                                                                             |
| `bun run lint:package`       | Builds the library, then runs `publint --strict` and `attw --profile esm-only`.                                                                                           |
| `bun run size`               | Checks the size (brotli) of the eight `size-limit` entries: ESM, React, Element, Vue, Svelte, Astro client, Lookup and the stylesheet. Needs a build.                     |
| `bun run test`               | Runs `turbo run test test:root`: the library (browser, node and astro projects), `apps/assets` and the root suites.                                                       |
| `bun run test:watch`         | Runs Vitest in watch mode in the library workspace.                                                                                                                       |
| `bun run test:coverage`      | Runs Vitest with v8 coverage in every workspace and enforces the thresholds.                                                                                              |
| `bun run lint:docs`          | Runs lychee over the docs with the same arguments as `lint-docs.yml`.                                                                                                     |
| `bun run lint:commits`       | Runs commitlint over the commits since `origin/develop`, like the CI job.                                                                                                 |
| `bun run assets:detect`      | Reports whether the published asset site is out of date (Teams manifest or Microsoft's repository).                                                                       |
| `bun run assets:build`       | Builds the manifest and sprites into `apps/assets/dist-assets/`; needs `ffmpeg`. Add `-- --limit 20` for a sample.                                                        |
| `bun run assets:verify-live` | Checks that the live asset site serves the current v1 layout and pipeline version.                                                                                        |
| `bun run assets:files`       | Builds the files site from `dist-assets/` into `dist-files/` (under `apps/assets`); needs the built asset site. Add `-- --files-out <absolute dir>` to change the output. |
| `bun run assets:lists`       | Regenerates `docs/EMOJI_LIST_*.md` from `apps/assets/dist-assets/manifest.json`.                                                                                          |
| `bun run brand:export`       | Regenerates the brand rasters from the logo SVGs; needs Chromium.                                                                                                         |
| `bun run ci:local`           | Runs the CI pipeline locally: install, commits, docs, check, coverage, build, size.                                                                                       |

### Website

The site scripts live in `apps/site` and run with `bun run --cwd apps/site`,
except `i18n:status`, which also has a root script:

| Script                          | What it does                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `bun run --cwd apps/site dev`   | Starts the Astro dev server.                                                 |
| `bun run --cwd apps/site check` | Runs `astro check` (also part of `bun run check`).                           |
| `bun run --cwd apps/site test`  | Runs the site's Vitest suite (also part of `bun run test`).                  |
| `bun run i18n:status`           | Lists the missing and stale translations of the published docs, with totals. |

`astro build` and `preview` exist but are slow; the container build in
`deploy-site.yml` is the build check. Translating:
[`how-to/translate-the-website.md`](how-to/translate-the-website.md).

### Scroll-driven motion

The landing page reveals elements with CSS view timelines, defined as the
`scroll-reveal` utility in
[`apps/site/src/styles/global.css`](../apps/site/src/styles/global.css). The
decision is recorded in [ADR 0021](adr/0021-css-scroll-driven-motion.md). When
adding or changing one:

- **Longhands only**: set `animation-name`, `animation-fill-mode`,
  `animation-timing-function`, `animation-timeline` and `animation-range`
  separately. Lightning CSS folds `animation-timeline` into the `animation`
  shorthand, and the Chromium used in CI rejects the result.
- **Name the timeline when an ancestor clips**: an ancestor with `overflow` set
  to `hidden`, `auto` or `scroll` becomes the scroller for `view()`, so the
  animation never moves with the page. Declare a named view timeline
  (`view-timeline-name`) on that ancestor and consume it from the child with
  `animation-timeline`.
- **Gate every rule**: wrap it in `@supports (animation-timeline: view())` and
  `@media (prefers-reduced-motion: no-preference)`. Unsupported browsers and
  visitors who prefer reduced motion get a static, fully visible page.
- **Verify the computed result**: emulate reduced motion off, scroll, and read
  the element's computed `transform` and `opacity`. The animation name alone can
  be set while the timeline is wrong and nothing moves.

The sticky site header fades its surface in on a scroll timeline. The
`.site-header::before` layer in `global.css` carries the background and blur and
animates `opacity` from 0 to 1 over the first 64px of root scroll, with
`animation-timeline: scroll(root block)`, `animation-range: 0px 64px` and a
linear curve. It is gated only by `@supports (animation-timeline: scroll())`,
not by reduced motion, because it fades without moving anything. Without support
the layer is always opaque. `html` sets `scroll-padding-top` from
`--site-header-height` so in-page anchors clear the header; update the token if
the header height changes.

### Theme transition

Choosing a theme from the header menu cross-fades the page for 250ms through a
same-document view transition (`applyThemeAnimated`); initial load and
OS-preference changes apply instantly, as do visitors who prefer reduced motion
or browsers without `document.startViewTransition`.

#### Pillar spotlight and stagger

The landing pillar cards carry two small additions, each in its own block in
`global.css`:

- **Spotlight**: `attachPillarSpotlight` in
  [`apps/site/src/scripts/pillar-spotlight.ts`](../apps/site/src/scripts/pillar-spotlight.ts)
  writes `--spotlight-x` and `--spotlight-y` once per animation frame, and the
  `.spotlight::before` glow follows them with `transform` and `opacity` only. It
  attaches only on `(hover: hover) and (pointer: fine)` with reduced motion off,
  and the glow never takes pointer events.
- **Stagger**: the `pillar-stagger` list derives `--reveal-index` from
  `sibling-index()` under `@supports (z-index: sibling-index())`. Browsers
  without it lose only the stagger, because the index defaults to 0.

### Hero entrance

The landing hero settles in on every load with CSS `@starting-style` and plain
transitions, in a block of `global.css` gated by
`prefers-reduced-motion: no-preference`:

- **Secondary content**: the eyebrow, subtitle, buttons row and install row
  carry `hero-enter` and `--enter-index`. Each fades from `opacity: 0` and rises
  20px over 800ms with `--ease-out-gentle`, staggered by 120ms per index. The
  gentler curve keeps the rise readable; `--ease-out-strong` front-loads it so
  much that a 500ms entrance looked instant.
- **Never the headline**: the `<h1>` has no transition or animation, so the
  largest text paints immediately.
- **Demo, transform only**: the `DemoPlayground` wrapper (`hero-demo-enter`)
  moves from `translateY(24px) scale(0.97)` and never changes opacity, so the
  likely LCP candidate is not held back.
- **Longhands only**, and visitors who prefer reduced motion get a static, fully
  visible hero.

### Landing motion utilities

Reusable utilities at the end of `global.css` for the landing sections. Each is
longhand only, and every moving part sits behind
`prefers-reduced-motion: no-preference`, so visitors who prefer reduced motion
get the end state and nothing is hidden. None of them uses JavaScript observers.

- **`tab-pill`**: a sliding indicator for Base UI tabs. Pass `pill` to
  `TabsList`, which adds `tab-pill-list` and renders the indicator, and the pill
  follows the selected tab through the `--active-tab-left`,
  `--active-tab-width`, `--active-tab-top` and `--active-tab-height` variables
  that Base UI measures. It moves with `transform` over 200ms (the width snaps,
  so a pill never triggers layout) with `--ease-out-strong`. Triggers inside
  `tab-pill-list` lose their own selected background; set
  `--tab-pill-background` and `--tab-pill-radius` to restyle the pill. Use it
  for the hero, install and dock tab sets.
- **`fake-cursor`**: a looping cursor for demos. Declare the waypoints with
  `--cursor-x0`/`--cursor-y0` (start), `--cursor-x1`/`--cursor-y1` (the press)
  and `--cursor-x2`/`--cursor-y2` (after), plus `--cursor-duration` (6s by
  default). The cursor moves with the `translate` property and dips with `scale`
  on the press. Add `fake-cursor-target` to the element being clicked so it
  presses in sync. The reduced-motion state rests on the press waypoint. Set
  `data-paused` to freeze the loop.
- **`burst`**: six particles that fly out from the center of `.burst`. Render
  six `.burst-particle` children and set `data-burst="active"` on the parent;
  remove and re-add the attribute to replay. `--burst-distance` sets the travel
  (36px by default). Use it for one-shot feedback such as a copy; the older
  `copy-burst-particle` stays for `CopyBurst`. Under reduced motion the
  particles stay invisible.
- **`marquee`**: an endless row. Put two identical rows in `.marquee-track`, the
  second with `aria-hidden="true"`, and give each row trailing padding instead
  of a `gap` so `translate: -50%` loops seamlessly. `data-direction="reverse"`
  flips it, `--marquee-duration` sets the speed (40s) and it pauses on hover
  with a fine pointer. Under reduced motion the duplicate row is hidden and the
  track is static.
- **`glow`**: a radial glow behind an emoji, colored by `--glow-hue` (an OKLCH
  hue, 60 by default) and `--glow-strength` (0.45). `data-glow="dim"` fades it
  with a 200ms opacity transition.
- **Dock reveal**: a fixed dock that appears after the hero and hides near the
  closing panel, driven by two named view timelines. Put `dock-scope` on a
  common ancestor of the hero, the closing panel and the dock, `dock-hero` on
  the hero, `dock-end` on the closing panel and `dock-reveal` on the dock. Named
  timelines are required because the dock cannot reach its siblings through an
  anonymous `view()`, and a clipping ancestor would otherwise capture it. The
  dock respects `safe-area-inset-bottom` and never exceeds the page gutters, so
  it cannot overflow horizontally; keep its tap targets at 44px. Browsers
  without view timelines and reduced-motion visitors always see it.

### Brand assets

`bun run brand:export` regenerates the PNG marks, the social preview, the Open
Graph image and the README cover from the logo SVGs and the export copy. Run it
after changing either, and never edit the generated rasters by hand. See
[`brand/README.md`](brand/README.md).

### Adding a `@shadcn/lint` contract

The root `lint-policy.mjs` defines `shadcnNoRestyleContracts`, a list of
per-component exceptions to the `shadcn/no-restyle` rule on the site. Both
`oxlint.config.ts` (`ts` and `tsx`) and `eslint.config.mjs` (`.astro`) import
it. Each entry pairs a component name `pattern` (regex) with an `allow` list of
class categories or literal classes that component may add on top of its
shadcn/ui defaults.

To add a new contract:

1. Add an entry to `shadcnNoRestyleContracts` in `lint-policy.mjs`:
   ```js
   {
     pattern: '^ComponentName$',
     allow: ['layout', 'text-sm'],
   }
   ```
2. Document the entry in the TSDoc block above `shadcnNoRestyleContracts`,
   explaining the real, bounded design decision it encodes. Never add a contract
   just to silence the rule.
3. Run `bun run lint` to confirm the rule now accepts the component's actual
   usage and nothing broader.

The ladder that leads here is in
[`AGENTS.md`](../AGENTS.md#escalating-a-shadcnlint-finding).

## Git hooks

Hooks live in `.husky/`:

- **`pre-commit`** runs `lint-staged`: Oxfmt, Oxlint and ESLint (for `.astro`)
  on staged code files, Oxfmt alone on staged `json`, `md`, `css` and `yml`
  files (`lint-staged.config.mjs`).
- **`commit-msg`** runs `commitlint` with `@commitlint/config-conventional`. It
  enforces the Conventional Commits shape and type list, not the emoji.
- **`pre-push`** rejects a push whose branch name does not match `<type>/<slug>`
  (or `renovate/*`, the agent names `ao-<n>-<slug>` and `worktree-*`).
  It then runs `turbo run typecheck --affected` and Oxlint (type-aware,
  `--deny-warnings`) on the code files changed relative to `origin/develop`, so
  failures surface before CI. It refuses a push to `main` or `develop`. When
  `origin/develop` is not fetched, it skips those checks with a message to fetch
  it instead of blocking the push.
  `scripts/affected-guard.test.ts` guards the `--affected` selection the hook
  and CI share: it fails when a change inside a workspace does not select that
  workspace's `test` task.

## CI

Every PR runs the full `ci.yml` pipeline, docs-only changes included. Jobs check
out with `fetch-depth: 0` and restore the `.turbo` cache. On pull requests the
Turborepo tasks run with `--affected`, so only the workspaces touched by the
change (and their dependents) are checked; on `main` and `develop` they run in full. The root
tasks (`check:root`, `test:coverage:root`) are never filtered. Job names are
unchanged:

- **Quality**: format check, lint, typecheck, knip.
- **Test**: Vitest browser mode with coverage; uploads a test report when it
  fails.
- **Package**: build, `publint`, `attw`, size limit and a size report.
- **Commitlint**: validates the PR's commit messages.
- **CI passed**: aggregates the jobs above. It is one of the three required
  status checks, with `Validate PR title` and `Check markdown links`.

**CI runners.** The light jobs (`ci.yml` `quality`, `commitlint` and
`ci-passed`; `lint-pr.yml` `validate-title`; `lint-docs.yml` `check-links`;
`lint-workflows.yml` `lint`; `labels.yml` `sync`) use
`runs-on: ${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}`.
Pull requests from forks always fall back to GitHub's `ubuntu-latest`. The
`BLACKSMITH_RUNNER` repository variable is unset by default, so every job runs
on `ubuntu-latest`; every other job keeps a literal `ubuntu-latest`. Why it
stays unset on this public repository, and how to turn it on or roll it back:
[ADR 0028](adr/0028-ci-runner-standard-and-a-parallel-site-quality-workflow.md).

**Site Quality.** `site-quality.yml` runs on pull requests that touch the site,
the docs, the library or `bun.lock`. A `build` job builds the site image once
and uploads it as an artifact; `smoke`, `e2e`, `visual` and `lighthouse` then
load it and run in parallel, each uploading a `site-<job>-report` artifact when
it fails. The aggregate `Smoke, accessibility and Lighthouse budget` check fails
unless all five jobs succeed. `apps/site/scripts/visual.sh` runs a prebuilt
image when `VISUAL_SITE_IMAGE` is set and builds its own otherwise.

`sync-assets.yml` runs weekly (and on demand) outside the PR pipeline: it
detects new emoji versions, rebuilds and deploys the asset site to Cloudflare
Pages, smoke tests the published manifest and a sprite, builds the files site
into `apps/assets/dist-files/` and deploys it to its own Pages project
(`animated-fluent-emojis-files`), smoke tests it (`version.json`, `index.json`
and one GIF, WebP and PNG from the public index), and opens a pull request with
the regenerated emoji lists. Detection also reports a rebuild when the files
site's `version.json` is missing or stale. A failed run opens or updates a
single `sync-assets failing` issue. It also publishes the `/v1/` layout whenever
`/v1/version.json` is missing, lacks the `v1` layout or carries another pipeline
version. Manual dispatch takes two inputs: `rebuild` forces a build even when
nothing changed, and `bypass_guards` skips the Teams discovery guard and the
catalog removal guard (more than 5% removed, checked on the planned catalog
before any conversion). The file-count guard is never bypassed. The v1 smoke
test always runs. Setup:
[`how-to/set-up-asset-hosting.md`](how-to/set-up-asset-hosting.md); recovery:
[`how-to/roll-back-the-asset-site.md`](how-to/roll-back-the-asset-site.md).

`deploy-site.yml` runs on pushes to `main` that touch `apps/site`, `docs`, the
library or the deploy script. It builds the site container from
`apps/site/Dockerfile` as a build check, then triggers a Coolify deploy through
`.github/scripts/deploy-coolify.sh` and waits for the result. It needs the
`COOLIFY_API_TOKEN` repository secret and the `SITE_COOLIFY_APP_UUID` repository
variable; the script fails with a clear message when either is missing. See
[ADR 0018](adr/0018-website-on-coolify-with-astro-and-starlight.md).

Other workflows: `lint-docs.yml` (offline link and anchor check with lychee),
`lint-workflows.yml` (workflow linting), `lint-pr.yml` (PR title), `labels.yml`
(label sync), `scorecard.yml` (OpenSSF Scorecard) and `release.yml` (which waits
for the `CI passed` check of the tagged commit to succeed before publishing; see
[`how-to/cut-a-release.md`](how-to/cut-a-release.md) and
[ADR 0005](adr/0005-npm-trusted-publishing.md)). All third-party actions are
pinned to a commit SHA.

## Branching and promotion

`develop` is the trunk ([ADR 0030](adr/0030-develop-is-the-trunk.md)). `main`
stays the default branch and the only branch that deploys the website and
carries `v*` tags.

- **Feature work.** Branch from `develop` and open a pull request against it.
  Pull requests are squash-merged into `develop`, which keeps `develop` linear.
- **Promotion.** `main` changes only by promotion, a pull request from `develop`
  to `main`:

  ```sh
  gh pr create --base main --head develop --title "chore: 🔀 promote develop to main"
  gh pr merge --merge
  ```

  The merge uses a merge commit, so `main` and `develop` never diverge. The
  `commitlint` job is skipped on a promotion, because each commit it carries was
  already linted on its own pull request.

- **No sync step.** Nothing merges `main` back into `develop`, and no workflow
  automates a promotion.
- **Releases.** The release bump lands on `develop`, a promotion follows, and the
  tag is cut on the promotion merge commit
  ([cut a release](how-to/cut-a-release.md)).
- **Automation.** Renovate and the weekly emoji-lists pull request target
  `develop`. CI and CodeQL run on a push to `main` and to `develop`.

## Branch naming

`<type>/<slug>`, where type is one of `feat`, `fix`, `docs`, `style`,
`refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` and the slug is
lowercase kebab-case, for example `feat/add-confetti-emoji`.

## Commit format

`type: emoji lowercase subject`, for example `feat: ✨ add confetti emoji`, with
a bulleted body when it helps. PRs are squash-merged into `develop`, so the PR title follows
the same format. A promotion uses the fixed title
`chore: 🔀 promote develop to main`. The hook does not enforce the emoji; it is a convention.

## Accessibility

- **Linting**: `jsx-a11y`'s `recommended` rules run as part of `bun run lint`
  (Oxlint for `tsx`, ESLint for `.astro`), so an a11y violation fails like any
  other lint error.
- **Library**: `Emoji.a11y.test.tsx` runs axe against the rendered component.
  Every emoji ships descriptive `alt` text, and reduced motion shows a still
  poster frame.
- **Website**: `apps/site/e2e/accessibility.spec.ts` runs axe on the key pages.
  Interactive UI is built from `src/components/ui` (shadcn on Base UI), which
  ships correct ARIA roles, keyboard handling and focus management; prefer
  composing it over hand-rolling controls from `div` or `span`.
- **Keyboard and labels**: every interactive control is reachable and operable
  by keyboard, every form control has an accessible name and icon-only buttons
  carry an `aria-label`.
- **Focus**: never remove the focus ring (`outline: none`) without a replacement
  focus style.

## Code documentation

Comments are TSDoc blocks only, on non-obvious exports. A local lint rule
(`eslint-rules/no-non-doc-comments.mjs`, run by Oxlint and by ESLint on
`.astro`) rejects `//` and plain `/* */` comments. Rationale:
[ADR 0002](adr/0002-tsdoc-only-code-comments.md).

## Testing

The library keeps three Vitest projects in
`packages/animated-fluent-emojis/vitest.config.ts` (paths below are relative to
that workspace):

- **`browser`**: tests under `src/components`, `src/hooks`, `src/react`,
  `src/vanilla`, `src/element` and `src/vue`, plus `src/astro/client.test.ts`
  and the conformance suite, run in headless Chromium, Firefox and WebKit
  through Playwright, with MSW mocking the slim manifest request
  (`src/test/browser-setup.ts`). The manifest is fetched lazily, so a test that
  needs a fresh load resets the module state first. Run
  `bunx playwright install chromium firefox webkit` once.
- **`node`**: tests under `src/core`, `src/utils`, `src/lookup` and `src/test`
  (except the conformance suite), plus `src/astro/markup.test.ts` and
  `src/astro/server.test.ts`.
- **`astro`**: `src/astro/Emoji.test.ts`, which renders the `.astro` component
  through Astro's container API.

`apps/assets` has one `node` project (`apps/assets/vitest.config.ts`). The root
`vitest.config.ts` is a `node` project over `eslint-rules`, `oxlint-plugins`,
`docs/adr`, `docs/brand/tools` and `scripts`, which includes the workflow
invariants and the coverage manifest tests.

The browser conformance test "shows a sized, hidden placeholder, then the ready
image" can flake under heavy host load; rerun it before suspecting a regression.

### Conformance suite

`packages/animated-fluent-emojis/src/test/conformance/suite.ts` holds one
behavior spec (placeholder, ready, unknown id, manifest error, fallback glyph,
reduced motion, playback gating by image, viewport and hidden tab, `playing`,
and a single `onPlaybackEnd`) that runs in the `browser` project against the
shared MSW manifest fixtures. It observes the rendered DOM only (`span > img`,
the `[role="img"]` glyph, the inline `animation-play-state`), so every adapter
must render the same structure.

An adapter plugs in with a driver, about 15 lines of glue in
`src/test/conformance/<adapter>.conformance.test.ts(x)`:

```ts
defineConformanceSuite("my-adapter", () => ({
  mount: (container, options) => {},
  update: (options) => {},
  unmount: () => {},
}));
```

- `mount(container, options)` renders the emoji into `container`, forwarding
  `ConformanceOptions` (`id`, `size`, `animationIterations`, `autoPlay`,
  `playing`, `alt`, `onPlaybackEnd`, `onError`) unchanged, and may be async.
- `update(options)` re-renders with `options` replacing the previous ones.
- `unmount()` removes the emoji and releases everything it holds.

The factory is called once per test, so keep state inside the closure. The
contract lives in `src/test/conformance/driver.ts`.

`bun run test:coverage` measures each workspace and enforces these thresholds
(lines, functions, branches, statements):

| Workspace                         | Measured                                                                                   | Thresholds  |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| `packages/animated-fluent-emojis` | `src/**` (including `.svelte`)                                                             | 95/95/90/95 |
| `apps/assets`                     | `*.ts` (not tests, `test-support.ts` or the Vitest config)                                 | 95/95/90/95 |
| root                              | `scripts/**`, `eslint-rules/**`, `oxlint-plugins/**`, `tools/**` and `docs/brand/tools/**` | 94/95/87/94 |

`.astro` files are not reported by v8 (the container render test covers them)
and `docs/brand/tools/export.mjs` needs a real browser, so neither is measured.
Local runs skip the ffmpeg tests when `ffmpeg` is missing; CI always runs them,
so CI numbers are at least as high.

`scripts/coverage-manifest.test.ts` walks the source roots of every workspace
and fails when a source module has no colocated test and no documented
exemption, or when an exemption is stale. One exemption list serves all
workspaces, keyed by repo-relative paths. Rationale:
[ADR 0004](adr/0004-vitest-browser-mode.md).

## Packaging

The published package is `packages/animated-fluent-emojis`. It is ESM-only with
an `exports` map for the entry, `./react`, `./vue`, `./svelte`, `./astro`,
`./element`, `./lookup` and `style.css`. The JavaScript entries import a shared
manifest chunk that stays out of `exports` and ships through `files: ["dist"]`.
A Rolldown `advancedChunks` group in the workspace's `vite.config.ts` names it
`chunks/manifest-[hash].js`, so the `size-limit` globs always match it.
`bun run lint:package` validates the package. `repository.directory` points at
the workspace. A `prepack` script copies the root `README.md` and `LICENSE` into
the workspace (gitignored there), and releases pack with `bun pm pack` from that
directory; the tarball is verified to contain `package.json`, `README.md`,
`LICENSE` and `dist`. The tag `v*` is bare, the version is checked against the
library workspace's `package.json`, and the changelog stays at the root
`CHANGELOG.md`. Publishing to npm through OIDC is unchanged
([how to cut a release](how-to/cut-a-release.md)). Rationale:
[ADR 0003](adr/0003-esm-only-and-vite-8.md).

## Dependency updates

Renovate (`renovate.json5`) opens the update pull requests, on Mondays before
12:00 UTC, and tracks them in the Dependency Dashboard issue. `@types/node`
follows its latest major like any other dependency, so its typings can run ahead
of the Node runtime. A custom manager also pins the `npm` version that the
workflows install with `npm install -g npm@<version>`.

## Playground

`bun run dev` serves `index.html`, which loads `playground/main.tsx` and imports
the component straight from `src/` (all in `packages/animated-fluent-emojis`).
The page has controls for an unknown id, `fallback` (glyph, node, `null`),
`skinTone`, `playing`, a string `size` and a bad `configureEmojis` site URL that
shows the error state; edit the file to try other props, with hot reload. To
preview reduced motion, emulate the `prefers-reduced-motion` media feature in
DevTools (Rendering panel). The playground is not published and is ignored by
knip.

## Repository settings

Settings for the org-owned repository
`github.com/andryorelabs/animated-fluent-emojis` live in the repo and are
applied by hand through the GitHub API. The rulesets for `develop`, `main` and `v*` tags
are `.github/rulesets/develop.json`, `.github/rulesets/main.json` and
`.github/rulesets/tags.json`; the other
settings and the `gh api` commands that apply them are listed in
[`docs/brand/apply-spec.md`](brand/apply-spec.md). `bun run repo-settings:check`
compares the live settings with those files and exits non-zero on any
difference. Fix drift by re-applying from the files, never by editing live.

The posture is recorded in [ADR 0001](adr/0001-public-repo-security-posture.md):
squash-only merges into `develop` with linear history, merge commits only into
`main`, signed commits, the strict required checks
`CI passed`, `Validate PR title` and `Check markdown links`, private
vulnerability reporting, secret scanning with push protection, Dependabot
security updates, immutable releases, `sha_pinning_required` and CodeQL (a
workflow, with the default setup disabled). Change the ADR and the files
together with any setting.

The cross-repo rules these settings follow live in
[aokit `docs/standards`](https://github.com/andryorelabs/aokit/tree/main/docs/standards),
adopted here by [ADR 0029](adr/0029-andryorelabs-cross-repo-standard.md).

Two more settings are part of the same posture:

- The `LISTS_BOT_TOKEN` secret, a fine-grained personal access token that lets
  the Sync Assets `emoji-lists` job open a pull request that CI runs on and that
  auto-merges. Setup and rotation:
  [Set up asset hosting](how-to/set-up-asset-hosting.md); rationale:
  [ADR 0017](adr/0017-personal-token-for-the-emoji-lists-pr.md).
- Actions cannot create or approve pull requests
  (`can_approve_pull_request_reviews=false`). Auto-merge stays enabled.

## Agent skills

Third-party skills live in `.claude/skills` and are installed with
`bunx skills add <owner>/<repo>#<commit> -s <skill> -a claude-code`, always
pinned to a commit so `skills-lock.json` records the exact `ref`. Read each
`SKILL.md` and any bundled script before committing it. `bunx skills update`
moves the pins, so review the diff the same way.

The skills installed today all come from `emilkowalski/skills` and cover design
and motion work on the website: `animate`, `animation-vocabulary`, `break-ui`,
`emil-design-eng`, `find-animation-opportunities`, `improve-animations`,
`mobile-native`, `pick-ui-library` and `review-animations`. The emet workflow is
configured in [`agents/emet.md`](agents/emet.md).
