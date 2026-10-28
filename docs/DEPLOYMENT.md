# Deployment

Canonical deployment facts for OMA-AI. Other docs link here rather than
restating them — this file is the single source of truth so a deploy
instruction can't drift between documents.

Production targets, release procedures, verification and retention guidance follow.

## Canonical host

| Host | Status |
|------|--------|
| `https://www.oma-ai.com` | **Canonical.** Serves the site and the public API. |
| `https://oma-ai.com` | Apex. 308-redirects to `www`. Not a deployment target. |
| `api.oma-ai.com` | **Does not exist (NXDOMAIN) and must not be created.** |

Use `https://www.oma-ai.com` for public URLs, examples and
`NEXT_PUBLIC_APP_URL`. `PRIMARY_DOMAIN` is a bare hostname, `oma-ai.com`,
without a scheme or `www`. Auth origin resolution accepts the apex and `www`
and resolves the production auth base URL to `https://www.oma-ai.com`.
The SIWE signing domain is `www.oma-ai.com`, matching the page that requests
the signature; the wallet UI uses that page's actual origin as its SIWE URI.
Local signing preserves the HTTP scheme and port. Keep the auth base URL and
CORS settings consistent with `server/src/auth.ts` and the same-origin proxy.
Do not copy the website URL into `PRIMARY_DOMAIN`.

Release changes to the SIWE signing origin in the frontend and API together.
Older cached tabs and in-flight signatures need a reload and a fresh nonce
after the change. Existing sessions and stored wallet bindings need no migration.

The customer [OpenAPI document](https://www.oma-ai.com/api/v1/openapi.json)
and `/docs` page describe API requests and responses. Funding also uses
`/x402/info`, `/x402/verify` and `/x402/settle`; see the
[platform reference](PLATFORM.md#funding-rails). Website settings and privacy
endpoints are operational metadata outside the customer OpenAPI contract.

## What runs where

| Tier | Host | Notes |
|------|------|-------|
| Frontend | Vercel project `oma` | Next.js app from this repo. |
| API | Neon compute endpoint (`omaapi`) | The Hono server runs here, not on Vercel. |
| Database | Neon Postgres | `DATABASE_URL` / `DATABASE_URL_UNPOOLED`. |

A Vercel deploy ships the **frontend only**. It does not pick up server-side
changes — those require a Neon deploy (see below).

The browser reaches the API same-origin at `https://www.oma-ai.com/api/*`,
which App Router handlers under `app/src/app/api/**` proxy to the Neon endpoint.
These handlers preserve Better Auth session cookies and authenticate the
Vercel-to-Neon hop; they do not translate session cookies into bearer tokens.

## Frontend deploy (Vercel)

```bash
vercel deploy --prod --yes
```

**Run it from the repository root** (`oma-ai/`), not from `app/`.

The Vercel project's Root Directory is `app`. This dashboard setting
tells Vercel where the app lives inside the repository; the CLI still runs
from the repository root. The verified project is:

| Setting | Value |
|---------|-------|
| Team | `nosyt` / `team_7479lZJaz8NSWNiFZKgx3hpW` |
| Project | `oma` / `prj_MxWsqxnOm8814KKkNzYo4oscjjOi` |
| Git repository | `NosytLabs/oma-ai` |
| Production branch | `main` |
| Root Directory | `app` |
| Node.js | `24.x` |

The CLI link in `.vercel/project.json` is local configuration and may be
absent in a fresh checkout. If absent, link the **existing** project from
the repository root before deploying:

```bash
vercel link --project oma --scope nosyt --yes
```

Do not create another project or run the deployment from `app/`.

Verify a deploy actually went to production (a green local build is not
proof):

```bash
vercel inspect https://www.oma-ai.com --scope nosyt
curl -fsS -o /dev/null -w "%{http_code}\n" https://www.oma-ai.com/
```

The Git integration is configured to deploy pushes to `main`. Check the
deployment serving `www.oma-ai.com`, including its commit and `READY` status:
a newer canceled deployment does not replace the live deployment. If a push
does not produce a ready deployment, inspect its build status before using
the explicit production deploy command above. Do not add `VERCEL_TOKEN`
merely to make a check green.

## Preview environments

A Vercel preview also needs a live, isolated API deployment. A `READY` frontend
and `/api/health` HTTP 200 do not verify the backend. Before testing accounts,
require `/api/ready` HTTP 200 with healthy dependencies and
`/api/auth/get-session` HTTP 200 with JSON `null` in a signed-out request.
A plain `function not found` response means the configured API function or
branch is missing; verify that target before changing authentication code.

Run the bounded, read-only check against the exact deployment origin:

```bash
pnpm check:deployment https://your-preview.vercel.app
```

It requires both responses above, rejects redirects and exits nonzero on a
missing function, unhealthy dependency or unexpected session response. It sends
no cookies or credentials; an access-protected preview needs an authenticated
check through Vercel. Missing Redis credentials cause readiness to report a
degraded dependency.

Use an empty or [schema-only Neon branch](https://neon.com/docs/guides/branching-schema-only),
isolated Redis, and independent auth/proxy secrets. Set the preview API's
`PRIMARY_DOMAIN` to the stable preview hostname, and `PUBLIC_APP_URL` and
`BETTER_AUTH_URL` to its matching HTTPS origin.
Point Vercel's preview-scoped `NEXT_PUBLIC_API_URL` to that API and keep its
`INTERNAL_PROXY_SECRET` in sync with the preview backend. Check environment
targets before editing a variable shared with development or production.

The current server validates live payment configuration for public preview
environments. An auth-only hosted preview therefore needs a supported
payments-disabled mode before provisioning. Do not bypass that validation
with development flags or reuse production payment credentials. The local
`test:auth:integration` harness and browser fixtures provide isolated auth
coverage while that deployment capability is unavailable.

## Backend deploy (Neon)

Apply pending database migrations **before** releasing dependent API code.
Migration `0005` adds persistent inference idempotency, `0006` increases refund
precision, and `0007` adds credit reservations, detached financial receipts
and provider response IDs.
Run the repository migration command using the approved production connection,
then verify the journal and expected tables before deploying the function.
A successful local migration does not establish production schema readiness.

Use the migration runner rather than `drizzle-kit migrate` by hand — it applies
pending migrations with drizzle's own migrator (keeping the
`__drizzle_migrations` journal drizzle-maintained) and then hard-fails if any
table in `server/src/db/schema.ts` is missing:

```bash
cd server
DATABASE_URL="<approved production connection>" node scripts/migrate-prod.mjs
# verify only, migrate nothing:
DATABASE_URL="<approved production connection>" node scripts/migrate-prod.mjs --check
```

A pooled Neon URL is rewritten to the direct endpoint automatically for
migrations. Neon supports transactions through its pooler, but transaction
pooling does not preserve session state between transactions. A direct
connection avoids those limitations for migration and administrative tools;
see [Neon's connection guidance](https://neon.com/docs/connect/connection-pooling#when-to-use-pooled-vs-direct-connections).

If a production database query returns quota-exceeded HTTP402, stop the API
release. Resolve the account quota/plan first, migrate, deploy, and require
native `/ready` HTTP200 before running paid signup/funding/inference checks.
Do not replace the production environment with local fixture credentials.

A fresh Neon project is not a schema clone. Before releasing a function to a new
project, apply every migration and confirm the table count matches
`server/src/db/schema.ts`, then confirm the scheduled triggers exist:

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
psql "$DATABASE_URL" -c "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id;"
npx --yes neon@6.2.3 triggers list \
  --project-id gentle-pine-02694891 --branch br-patient-sun-b5k0ln0f
```

A missing table surfaces as PostgreSQL `42P01` in the function logs (for
example `[deposit-recovery] internal ticker failed`) and is invisible to a
`/ready` probe, because readiness only checks that the database answers.


The API is a Neon Function, not a Vercel serverless function. The verified
target is project `gentle-pine-02694891` (`oma-ai-prod`), branch
`br-patient-sun-b5k0ln0f` (`main`), function `omaapi`, runtime `nodejs24`.

For a code-only release, deploy the tested entry point with an explicit
project and branch. This preserves the existing function environment:

```bash
npx --yes neon@6.2.3 functions deploy omaapi \
  --src server/src/index.ts \
  --project-id gentle-pine-02694891 \
  --branch br-patient-sun-b5k0ln0f --wait
```

Run from the repository root with `NEON_API_KEY` exported. Omit `--env` for
a code-only release. Existing environment variables carry over; a supplied
`--env KEY=value` updates that key, while `--env KEY=` deletes it. Do not
substitute a development `.env` for the live configuration.

The infrastructure-as-code manifest is `server/neon.ts`. Use it when
intentionally reconciling the declared function configuration or triggers,
with the required production values available in the deployment environment:

```bash
neon config plan --config server/neon.ts            # preview, no apply
neon deploy --config server/neon.ts --update-existing
```

The manifest registers `omaapi` plus the `oma-deposit-recovery` and
`oma-settlement-dlq` scheduled triggers. Both run every 15 minutes. A code-only
function deploy leaves these existing triggers in place.

After deploying, confirm that the current and active function deployments
are both completed, then verify the API's dependencies and changed behavior.
A completion label alone does not prove every request is using the new code:
compare a changed catalog field or OpenAPI contract, and verify any changed
runtime setting through an authenticated disposable test account. Repeat the
behavior check after propagation before declaring the release live:

```bash
npx --yes neon@6.2.3 functions get omaapi \
  --project-id gentle-pine-02694891 --branch br-patient-sun-b5k0ln0f
curl -fsS https://br-patient-sun-b5k0ln0f-omaapi.compute.c-7.us-east-2.aws.neon.tech/ready
```

`https://www.oma-ai.com/api/health` checks the web tier only. The native API
`/ready` probe checks Postgres and Redis; require a successful readiness
response as well as a successful frontend health response.

## Release verification

Before release, run `pnpm install --frozen-lockfile` and `pnpm validate` from
the repository root using the pinned Node and pnpm versions. For chat behavior
or layout changes, also run the [browser checks](../app/e2e/README.md). The
fixtures test local UI behavior, not a live provider or paid account flow.
Commit `pnpm-lock.yaml` with manifest changes and record checks for the release
commit. A missing CI check is not a passing check.

| Layer | Evidence | What it establishes |
|-------|----------|---------------------|
| Frontend release | Deployment serving `www.oma-ai.com` is `READY` at the intended commit | Production received the frontend release |
| Web runtime | `/chat` and `/api/health` respond | Next.js is reachable; `/api/health` is not a backend probe |
| API liveness | Native `/health` or `/live` responds | API process responds without querying dependencies |
| API release | Current and active `omaapi` deployments are complete | Separate API release is active |
| API dependencies | Native `/ready` reports healthy Postgres and Redis | Required data stores are reachable |
| Model catalog | `/api/v1/models` returns expected routes | Catalog configuration is present |
| Inference | A completion succeeds on the selected route | That route served a request at the time of the check |

Probes bypass maintenance settings: `/health/db` checks Postgres and `/ready`
checks Postgres and Redis. Inspect `/v1/site-settings` separately. Avoid using
readiness as a frequent idle liveness check: it queries the database and can
keep serverless compute active. Catalog availability flags describe configured
routes, not live inference probes. Investigate a degraded dependency before
changing deployment targets; inspect the upstream response and fallback route
for provider errors.

If Neon reports quota-exceeded HTTP 402, stop the API release and resolve the
existing project's quota or plan. Do not replace the database or delete ledger
records. After recovery, require healthy native `/ready`, readable settings,
and an authenticated account/API check. Inspect pending deposits and
settlement retries; do not collect another payment because crediting was
delayed. Keep both scheduled recovery jobs enabled and verify their schedules
against `server/neon.ts`.

## Deployment and log retention

Use [Vercel's deployment retention policy](https://vercel.com/docs/deployment-retention)
and review rollback needs before changing it. Keep the live production
deployment, the latest tested preview, and at least two production rollback
candidates. Inspect each candidate's project, state and aliases before removing
it by explicit ID with `vercel remove DEPLOYMENT_ID --safe --yes --scope nosyt`.
Remove an old branch alias only after confirming the branch is merged or closed
and the alias is not a customer domain. Never remove the active production,
`www` or apex aliases, or pass a project name to this command.

Keep current website/API logs and the latest main-branch validation. Superseded
CI logs can be removed without deleting their workflow run records using
`gh api --method DELETE repos/NosytLabs/oma-ai/actions/runs/RUN_ID/logs`.
Retain payment and recovery records. Avoid putting credentials or customer
query values into logs, documentation or tickets.

## DNS

Do not create records casually. There is intentionally no `api.oma-ai.com`,
and the apex already 308-redirects to `www`.

```bash
dig +short oma-ai.com A
curl -fsS -o /dev/null -w "%{http_code}\n" https://www.oma-ai.com/
curl -fsS https://www.oma-ai.com/api/health
# expected: no result
dig +short api.oma-ai.com A
```

## Related

- [`PLATFORM.md`](PLATFORM.md) — platform behaviour, billing, required operator
  environment variables.
- [`settlement-runbook.md`](settlement-runbook.md) — Polar/x402 operational
  notes.

## Security disclosure (RFC 9116)

A `security.txt` lives at `https://www.oma-ai.com/.well-known/security.txt`
(also served from `app/public/.well-known/security.txt`). It points to
`security@oma-ai.com` and the `SECURITY.md` policy. Verify it after deploy:
`curl -I https://www.oma-ai.com/.well-known/security.txt` should return
`200` with `content-type: text/plain`.
