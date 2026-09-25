# Security Policy

Thank you for helping keep our software and users secure.

> [!WARNING]
> **Please do not file security vulnerabilities in public GitHub issues, pull requests, discussions, or any other public forums.** 
> Public disclosure before a patch is available puts every operator and user of OMA AI at risk.

---

## Supported Versions

We recommend always running the latest stable release of OMA AI to ensure you have the latest security patches.

| Major Version | Security Support | Status |
| :--- | :--- | :--- |
| **2.x** | Supported | :white_check_mark: Active |
| **< 2.0** | Unsupported | :x: End of Life |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please disclose it privately using one of the channels below:

1. **GitHub Security Advisories (Preferred)**  
   Submit a report via the [private advisory form](https://github.com/NosytLabs/oma-ai/security/advisories/new). Reports submitted here are kept strictly confidential and are visible only to the core maintainers until a public advisory is published.
   
2. **Secure Email**  
   Send an email to [security@oma-ai.com](mailto:security@oma-ai.com). PGP keys are available upon request. Please encrypt your email if you are sharing sensitive reproduction details or exploit payloads.

### What to Include in Your Report
To help us triage and resolve the issue quickly, please include:
- A detailed description of the vulnerability and its potential impact.
- Clear, step-by-step reproduction instructions or a minimal proof-of-concept (PoC).
- Affected versions, commits, or environments.
- Any suggested remediations or fixes (optional but highly appreciated).

---

## Response SLA

Our target SLA metrics are outlined below:

| Stage | Target Response Time |
| :--- | :--- |
| **Initial Acknowledgment** | $\le$ 48 hours |
| **Severity Triage & Confirmation** | $\le$ 5 business days |
| **Remediation / Fix (Critical)** | $\le$ 7 days |
| **Remediation / Fix (High)** | $\le$ 30 days |
| **Remediation / Fix (Medium / Low)**| Standard release cycle |

We will coordinate disclosure timing and publicity with the reporter. By default, proper credit will be given in the security advisory unless anonymity is explicitly requested.

---

## Shared Security Model & Scope

OMA AI is a self-hosted AI inference gateway. Security responsibilities are split under a shared-responsibility model:

- **Core Maintainers**  
  Responsible for securing the codebase, shipping security patches, and coordinating CVE and GHSA publications.
- **System Operators**  
  Responsible for securing their specific deployment environments, isolating network access, handling secrets securely, managing TLS certificates, and protecting key infrastructure.

### Out of Scope
Behavior, outages, or vulnerabilities of third-party upstream AI inference providers (e.g., Venice, OpenAI) are out of scope for OMA AI. Please report those issues directly to the upstream vendor.

---

## Security Announcements

- All security patches are published via [GitHub Security Advisories](https://github.com/NosytLabs/oma-ai/security/advisories).
- Security changes will be cataloged in the [API documentation](https://oma-ai.com/docs).
- Pull requests and security commits are tagged with the `security` label on GitHub.

We recommend subscribing to repository release alerts to stay up to date.
