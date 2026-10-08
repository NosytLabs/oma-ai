# Deployment verification

[Deployment](DEPLOYMENT.md) owns the production targets, configuration, and
release commands. This guide explains the checks that establish whether a
release works and how to interpret failures.

## Before release

Run from the repository root using the Node and pnpm versions pinned in the
repository:

```bash
pnpm install --frozen-lockfile
pnpm validate
```

For changes to chat interactions or layout, also run the
[browser checks](../app/e2e/README.md). Use `pnpm validate:app` or
`pnpm validate:server` for a change limited to one workspace.

Commit `pnpm-lock.yaml` whenever a workspace manifest changes. Vercel installs
the pnpm workspace with a frozen lockfile. The `Deployment lockfile` workflow
checks that contract for dependency/configuration changes without running
package scripts; it can also be dispatched manually. The full CI workflow
remains manual for Actions cost control.

## Verify each layer

| Layer | Evidence | What it establishes |
|-------|----------|---------------------|
| Frontend release | The deployment serving `www.oma-ai.com` is `READY` and has the intended commit | The production domain received the release |
| Web runtime | `/chat` and `/api/health` respond successfully | The page and web service are reachable |
| API release | The current and active `omaapi` deployments are completed | The separate API release is active |
| API dependencies | The native API `/ready` response reports healthy database and Redis checks | Required data stores are reachable |
| Model catalog | `/api/v1/models` returns the expected configured routes | Catalog configuration is available |
| Inference | A completion succeeds on the selected route | That provider/model can serve a request at the time of the check |

A successful frontend health response does not establish API readiness or
provider availability. Likewise, model `available` flags describe configured
routes, not recent synthetic inference probes. Record the checks actually run
and any limits in the release PR instead of treating an old incident report as
current service status.

The Vercel Git integration releases the frontend from `main`. Server changes
need the separate Neon release documented in [Deployment](DEPLOYMENT.md).
Check the existing deployment before starting another build.

## Investigating a failure

- **Frozen-lockfile install failure:** regenerate the workspace lockfile with
  the pinned pnpm version and review the manifest/lockfile diff together.
- **Browser connection refused:** use the Playwright configuration that owns
  the frontend build/start lifecycle. Reused local servers must match the
  configured host, port, and test environment.
- **Degraded API readiness:** inspect the failed dependency and the production
  configuration for that dependency before changing deployment targets.
- **Provider errors:** preserve the configured model IDs and inspect the
  upstream response and fallback route. Catalog presence alone is not proof
  that inference is healthy.

The chat browser fixtures exercise local UI behavior without paid inference.
A fixture-backed test is not evidence that an external provider or a live paid
account flow succeeded.
