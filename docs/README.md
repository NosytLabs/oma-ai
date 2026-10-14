# Documentation

Maintained references:

- [Platform](PLATFORM.md): authentication, account usage, billing, funding and operator configuration.
- [Deployment](DEPLOYMENT.md): Vercel/Neon release procedures and targets.
- [Deployment health](deployment-health.md): readiness checks and failure diagnosis.
- [Chat UI](chat-ui.md): conversation storage, rendering and actions.
- [Settlement runbook](settlement-runbook.md): payment recovery.
- [Account tooling](../server/scripts/README.md): local fixtures, cleanup and real HTTP/provider tests.

Evidence:

- [Gateway and account audit](AUDIT.md): current validation, release receipts and open limitations, with earlier reports preserved in Git history.
- [Approved database cleanup](audits/database-cleanup-2026-10-10.md): the exact authorization, deleted expired records and preserved accounts.

Audit receipts describe observations at the recorded time; they do not replace
maintained references or guarantee current provider availability. Generated logs,
screenshots and private database backups stay outside version control.
