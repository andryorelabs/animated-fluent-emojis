---
name: cut-release
description: Cut a release of this project. Use when the user asks to release, tag or publish a new version.
---

# Cutting a release

1. Read the release runbook (`docs/how-to/cut-a-release.md`) and follow it; this skill only orders the steps.
2. Confirm the working tree is clean and you are on `develop`, up to date with the remote.
3. Run `bun run ci:local` and stop on any failure.
4. Check that `[Unreleased]` in `CHANGELOG.md` has entries. If the project's release script moves them into a dated section for the new version, leave that to the script; otherwise move them by hand.
5. Bump the version in `packages/animated-fluent-emojis/package.json` the way the runbook says (the project's release script once it exists) and open the release pull request into `develop`.
6. After the pull request merges, promote `develop` to `main` with a merge commit, tag the promotion merge commit as a signed `v<version>` tag and push the tag. Never move or reuse a tag, and never run `npm publish` locally.
7. Verify the published artifacts against their checksums, then report the version and the links.
