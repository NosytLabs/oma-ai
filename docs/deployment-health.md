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
the pnpm workspace with a frozen lockfile. Both the `Deployment lockfile`
install-contract check and the full CI workflow require manual dispatch for
Actions cost control. A missing automatic check is not a passing check; record
the local validation or manually dispatched run for the exact release commit.

## Verify each layer

| Layer | Evidence | What it establishes |
|-------|----------|---------------------|
| Frontend release | The deployment serving `www.oma-ai.com` is `READY` and has the intended commit | The production domain received the release |
| Web runtime | `/chat` and `/api/health` respond successfully | The page and Next.js web service are reachable; `/api/health` is not a backend probe |
| API liveness | Native API `/health` or `/live` responds successfully | The API process responds without querying Postgres or Redis, including during maintenance |
| API release | The current and active `omaapi` deployments are completed | The separate API release is active |
| API dependencies | The native API `/ready` response reports healthy database and Redis checks | Required data stores are reachable |
| Model catalog | `/api/v1/models` returns the expected configured routes | Catalog configuration is available |
| Inference | A completion succeeds on the selected route | That provider/model can serve a request at the time of the check |

A successful frontend health response does not establish API readiness or
provider availability. Likewise, model `available` flags describe configured
routes, not recent synthetic inference probes. Record the checks actually run
and any limits in the release PR instead of treating an old incident report as
current service status.

Operational probes bypass the global maintenance-settings query. `/health/db`
checks Postgres once and `/ready` checks Postgres and Redis; they report
dependency health even during scheduled maintenance. Inspect
`/v1/site-settings` separately for maintenance mode. Do not use readiness as a
frequent idle liveness check: each readiness request intentionally queries the
database and can keep a serverless compute active.

Database query errors retain bounded SQLSTATE/HTTP diagnostics and request
correlation IDs in application logs. SQL text, bound values, driver clients,
and nested database messages/stacks are omitted. Preserve operational receipts
without copying raw credentials or customer query values into docs or tickets.

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

## Database quota exhaustion

If database access returns HTTP 402 with a quota-exceeded message, inspect
consumption and billing for the existing production Neon project. A successful
website health response and a ready frontend deployment do not restore it.
The owner must resolve the plan/quota or wait for the reported reset. Do not
replace the database, delete ledger records, or create another project to work
around the limit.

Check that both recovery schedules match `server/neon.ts` (every 15 minutes).
Minute-by-minute database work prevents the normal idle window. Keep the jobs
enabled so confirmed payments can be reconciled; the longer interval means
background retries can take up to 15 minutes. Read schedules back after changing
them. Code-only function releases preserve triggers and do not reconcile them.

Before resuming paid promotion, require a 200 native `/ready`, successful
Postgres/Redis checks, readable site settings and an authenticated account/API
check. Apply pending migrations before releasing dependent backend code.
Inspect pending deposits and settlement retries after recovery; do not collect
a second payment merely because crediting was delayed.

## Build-output cleanup

Keep the logs for the current website/API sources and the latest main-branch
validation. Superseded CI/build logs can be removed without deleting their
workflow run records:

```bash
gh api --method DELETE repos/NosytLabs/oma-ai/actions/runs/RUN_ID/logs
```

Inspect each Vercel candidate's project, state and aliases first. Keep the live
production deployment, the latest tested preview and at least two production
rollback candidates. Remove obsolete canceled/failed builds and superseded
deployments by explicit ID, with alias protection:

```bash
vercel remove DEPLOYMENT_ID --safe --yes --scope nosyt
```

An old branch preview may still have its generated branch alias. Remove that
alias only after confirming the branch is merged/closed and the alias is not a
customer domain, then repeat the protected removal. Never remove `www`, the
apex, or the active project/production aliases during cleanup.

Keep ready production deployments for rollback and retain payment/recovery
records. Never pass a project name to `vercel remove` for routine log cleanup.
