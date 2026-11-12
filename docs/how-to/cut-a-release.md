# How to cut a release

Releases are manual and tag-driven. Pushing a signed `v*` tag publishes the
package to npm and creates the GitHub Release.

1. Bump the `version` field in `packages/animated-fluent-emojis/package.json` to
   the new version number.

2. In `CHANGELOG.md`, rename the `[Unreleased]` heading content into a new
   `## [x.y.z] - YYYY-MM-DD` section, leave an empty `## [Unreleased]` above it,
   and update the link references at the bottom of the file.

3. Run `bun run check` and `bun run test` to confirm everything passes.

4. Open a PR titled `chore: 🔖 release x.y.z` against `develop` and merge it.
   The bump lands on `develop`, not on `main`.

5. Promote `develop` to `main`, as described in
   [Branching and promotion](../development.md#branching-and-promotion):

   ```sh
   gh pr create --base main --head develop --title "chore: 🔀 promote develop to main"
   gh pr merge --merge
   ```

6. Tag the promotion merge commit on `main` with a **signed** tag and push it:
   `git tag -s vX.Y.Z <promotion-merge-sha> && git push origin vX.Y.Z`. An unsigned tag is
   not acceptable. Verify a signature at any time with `git tag -v vX.Y.Z`.

## What the workflow does

Pushing the tag triggers `.github/workflows/release.yml`, which has two jobs.

The `verify` job has `contents: read` and `checks: read` only. It:

1. Fails unless the tag matches the
   `packages/animated-fluent-emojis/package.json` version.
2. Fails unless the tagged commit is on `main`.
3. Waits up to 20 minutes (polling every 30 seconds) for the `CI passed` check
   run of the tagged commit and fails unless it concludes `success`. It also
   fails if no such run exists or it is still running at the deadline.
4. Runs `bun ci`.
5. Runs `bun run assets:verify-live`. This is the v1 gate: it fails unless
   `https://animated-fluent-emojis-cdn.andryore.dev/v1/version.json` answers
   200, lists the `v1` layout, was not built with `--limit` and carries the
   current `pipelineVersion`. If it fails, run the asset sync first.
6. Runs `bun run check`, `bun run test` and `bun run build`.
7. Extracts the `## [x.y.z]` section of `CHANGELOG.md` into `release-notes.md`
   and fails if it is empty.
8. Packs the tarball and uploads it with the notes as the `release-artifact`
   artifact.

If the CI gate fails, re-run the failed CI job on `main`, then re-run the
Release workflow for the same tag. No new tag is needed.

The `publish` job needs `verify`, runs in the `npm` GitHub Environment and is
the only job with `id-token: write` (plus `contents: write`). It installs no
dependencies and runs no tests or build. It:

1. Downloads the artifact.
2. Pins npm to 11.5.1, the minimum for trusted publishing, never `latest`.
3. Runs `npm publish` on the tarball, unless `npm view <name>@<version>` shows
   it is already published. Authentication uses OIDC trusted publishing, so no
   token is stored and provenance is generated automatically. A stable version
   publishes under `latest`; a prerelease publishes under the first identifier
   of its suffix (`1.0.0-beta.1` under `beta`), and a numeric one (`1.0.0-0`,
   `1.0.0-1.2`) under `next`.
4. Creates the GitHub Release with `gh release create` and the extracted notes,
   unless a release for the tag already exists. A prerelease version (one with a
   `-` suffix) is created with `--prerelease --latest=false`, so it is marked as
   a prerelease on GitHub and never becomes "Latest".

Both publish steps are idempotent, so re-running a failed `publish` job is safe.

`bun publish` is not used because it has no OIDC support.

## One-time npm trusted publisher setup

Configure this once on npmjs.com, under the package's **Settings**, **Trusted
Publisher**, **GitHub Actions**:

- Organization or user: `AndryOre`
- Repository: `animated-fluent-emojis`
- Workflow filename: `release.yml`
- Environment name: `npm`

Also create a GitHub Environment named `npm` in the repository settings.
