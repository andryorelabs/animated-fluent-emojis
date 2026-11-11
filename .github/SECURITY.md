# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities **privately** using GitHub's built-in
Private Vulnerability Reporting:

**→
[Open a security advisory](https://github.com/andryorelabs/animated-fluent-emojis/security/advisories/new)**

Do **not** open a public issue for security reports. That exposes the
vulnerability before a fix is available.

**Response times:**

| Severity | Acknowledge (target) | Patch target |
| -------- | -------------------- | ------------ |
| Critical | 48 h                 | 7 days       |
| High     | 5 days               | 14 days      |
| Medium   | 10 days              | 30 days      |

## Supported Versions

Only the latest published version of `animated-fluent-emojis` on npm is
supported. There are no maintained release branches. A fix lands on `main` and
ships in the next release.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Upgrade Path

Fixes are published to npm as a new version. Upgrade with your package manager
(for example `bun update animated-fluent-emojis`). There is no separate patch
channel.

## Security Design

For the trust boundaries, CSP requirements, supply chain and known limitations
of the library, see [`docs/security.md`](../docs/security.md).

## Credit

Reporters are credited by name (or handle) in the GitHub Security Advisory
unless you ask to stay anonymous when you report. State your preference in the
initial report.
