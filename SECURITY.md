# Security Policy

> **Please do not file security vulnerabilities in public GitHub issues, discussions, or anywhere public.** Public disclosure before a fix is available puts every operator of OMA AI at risk.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

We recommend always running the latest stable release.

## Reporting a Vulnerability

Private disclosure channels only:

1. **GitHub Security Advisories (preferred)** — Use the [private advisory form](https://github.com/NosytLabs/oma-ai/security/advisories/new). Reports are visible only to maintainers until published.
2. **Email** — `security@oma-ai.com` (PGP key available on request). Encrypt if reporting sensitive details.

Include in your report:
- Description of the vulnerability and impact
- Reproduction steps / proof-of-concept
- Affected versions / commits
- Any suggested fix (optional)

## Response SLA

| Stage | Target |
|-------|--------|
| Initial acknowledgment | **≤ 48 hours** |
| Severity triage &amp; confirmation | ≤ 5 business days |
| Fix timeline (Critical) | ≤ 7 days |
| Fix timeline (High) | ≤ 30 days |
| Fix timeline (Medium / Low) | Next release cycle |

We will coordinate disclosure timing with the reporter. Credit is given unless anonymity is requested.

## Scope

OMA AI Gateway is a self-hosted gateway. Security responsibilities are split:

- **Maintainers** — secure the codebase, ship security patches, coordinate CVE / GHSA publication
- **Operators** — secure their deployment environment, network access, secrets, and key management

Out of scope: third-party AI provider behavior (Venice, OpenAI, etc.) — report upstream.

## Security-Related Updates

- Published via [GitHub Security Advisories](https://github.com/NosytLabs/oma-ai/security/advisories)
- Noted in the project README changelog
- Tagged with the `security` label on GitHub

Operators should watch the repository for releases.
