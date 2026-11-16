# Configuration

The library takes its configuration through component props, documented in the [Guide](usage.md). The repository tooling and the website build read a few environment variables. An empty value counts as unset.

## Environment variables

`scripts/conventions/environment-docs.test.ts` fails when code reads a variable that is not listed here.

| Variable              | Read by                                  | Meaning                                                                                                                        |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SITE_URL`            | Site Playwright configs                  | Base URL the end-to-end and visual suites test. Defaults to `http://127.0.0.1:8080` and `http://127.0.0.1:8081`.               |
| `SITE_EMOJI_SLUGS`    | Site build, gallery and home sections    | Comma-separated emoji slugs; the build renders only those pages, which keeps test builds fast.                                 |
| `SITE_DIST`           | Site distribution output test            | Path of the built site to inspect. Defaults to `dist`.                                                                         |
| `SITE_DIST_REQUIRED`  | Site distribution output test            | Set to `1` to fail when the built site is missing instead of skipping.                                                         |
| `SITE_DIST_HEADERS`   | Site distribution output test            | Path of the served headers file to check against the build output.                                                             |
| `LAST_MODIFIED_DATES` | Site `lastmod` computation               | Precomputed last-modified dates, passed in where git history is unavailable.                                                   |
| `CHECK_LIVE_SLUGS`    | Asset pipeline `public-slugs` test       | Set to `1` to compare the pinned slug list with the live asset site.                                                           |
| `PARITY_CORPUS`       | `oxlint.config.ts`, lint parity baseline | Set to `1` for a corpus run of `lint:parity`, which compares Oxlint with the ESLint baseline.                                  |
| `CI`                  | Playwright configs, sprites test, site   | Set by CI. Enables retries, forbids `only`, requires `lastmod` in the sitemap and removes the ffmpeg skip in the sprites test. |
| `GITHUB_STEP_SUMMARY` | Asset pipeline                           | Path GitHub Actions provides for the job summary. The pipeline appends its report there when set.                              |
| `NODE_ENV`            | Library development warnings             | Development warnings are on unless this is `production`.                                                                       |
