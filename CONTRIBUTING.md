# Contributing

Thanks for your interest in contributing to Animated Fluent Emojis. This
document covers the conventions this repository expects from a pull request.

By participating in this project, you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

This project uses [bun](https://bun.sh/) as its package manager. Fork the
repository, clone your fork, then install dependencies:

```sh
bun install
```

Useful scripts (see `package.json` for the full list):

- `bun run check` runs the static checks: formatting, linting, type-checking,
  knip and the package lint (which builds once).
- `bun run test` runs the test suite.

## Where to start

Browse issues labeled
[`good first issue`](https://github.com/andryorelabs/animated-fluent-emojis/labels/good%20first%20issue)
for small, well-scoped tasks, or
[`help wanted`](https://github.com/andryorelabs/animated-fluent-emojis/labels/help%20wanted)
for work where a contribution is especially welcome. [`ROADMAP.md`](ROADMAP.md)
describes where the project is heading.

## Review process

Andry reviews pull requests within a few days. Once a PR is approved and CI is
green, it is squash merged as described in [Merging](#merging).

## Questions

See [SUPPORT](.github/SUPPORT.md) for where to ask questions and find the docs.
Open an issue only for a bug, a feature, an enhancement or a documentation
problem.

## Branch naming and commit format

Use a short, descriptive feature branch (never work directly on `main`). Commits
and pull request titles follow
[Conventional Commits](https://www.conventionalcommits.org/) with an optional
gitmoji, for example `feat: ✨ add confetti emoji`.

## Merging

This repository merges pull requests via **squash merge only**, keeping a linear
history on `main`. Your commits within a PR don't need to follow the format
above individually, but the final PR title does, since it becomes the squashed
commit message.

## CI

The `CI passed` check must be green before a pull request can be merged. Run
both `bun run check` and `bun run test` locally before opening a PR to catch
issues early. `bun run ci:local` runs the whole pipeline, with coverage.

## Tests

New functionality and bug fixes in `src/` must add or update tests in the same
PR.

## Sign-off (DCO)

Every commit must be signed off under the
[Developer Certificate of Origin (DCO) 1.1](https://developercertificate.org/):
by signing off, you certify you have the right to submit the change under this
project's license. Add the sign-off with `git commit -s`, which appends a
`Signed-off-by: Your Name <your.email@example.com>` trailer to the commit
message. There is no CI check enforcing this. It's a contributor obligation, not
an automated gate.

## Reporting security issues

Do not open a public issue for a security vulnerability. Report it privately as
described in [`.github/SECURITY.md`](.github/SECURITY.md).
