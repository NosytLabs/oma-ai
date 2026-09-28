# Deployment

Canonical deployment facts for OMA-AI. Other docs link here rather than
restating them — this file is the single source of truth so a deploy
instruction can't drift between documents.

Last verified against live infrastructure: 2026-09-28. Current dependency
outages and verification limits are recorded in [deployment health](deployment-health.md).

## Canonical host

| Host | Status |
|------|--------|
| `https://www.oma-ai.com` | **Canonical.** Serves the site and the public API. |
| `https://oma-ai.com` | Apex. 308-redirects to `www`. Not a deployment target. |
| `api.oma-ai.com` | **Does not exist (NXDOMAIN) and must not be created.** |

Use `https://www.oma-ai.com` in docs, examples, `NEXT_PUBLIC_APP_URL`,
`BETTER_AUTH_URL`, `PRIMARY_DOMAIN`, and CORS allowlists. The apex is only
ever mentioned as "redirects to `www`".

Public endpoints, all on the canonical host:

```text
GET  https://www.oma-ai.com/api/v1/models
POST https://www.oma-ai.com/api/v1/chat/completions
POST https://www.oma-ai.com/api/v1/messages
GET  https://www.oma-ai.com/api/v1/openapi.json
POST https://www.oma-ai.com/x402/verify
POST https://www.oma-ai.com/x402/settle
GET  https://www.oma-ai.com/api/v1/search
GET  https://www.oma-ai.com/api/v1/usage
GET  https://www.oma-ai.com/api/v1/usage/today
GET  https://www.oma-ai.com/api/v1/balance
GET  https://www.oma-ai.com/api/v1/keys
POST https://www.oma-ai.com/api/v1/keys (session cookie)
DELETE https://www.oma-ai.com/api/v1/keys/{id} (session cookie)
GET  https://www.oma-ai.com/api/v1/credits/balance
POST https://www.oma-ai.com/api/v1/deposit/usdc
GET  https://www.oma-ai.com/api/v1/deposit/status
GET  https://www.oma-ai.com/api/v1/site-settings
POST https://www.oma-ai.com/api/v1/checkout (session cookie)
GET  https://www.oma-ai.com/api/v1/privacy
```

The app's in-product `/docs` page documents these endpoints with request and
response shapes; this list is the summary of what the live OpenAPI serves.

## What runs where

| Tier | Host | Notes |
|------|------|-------|
| Frontend | Vercel project `oma` | Next.js app from this repo. |
| API | Neon compute endpoint (`omaapi`) | The Hono server runs here, not on Vercel. |
| Database | Neon Postgres | `DATABASE_URL` / `DATABASE_URL_UNPOOLED`. |

A Vercel deploy ships the **frontend only**. It does not pick up server-side
changes — those require a Neon deploy (see below).

The browser reaches the API same-origin at `https://www.oma-ai.com/api/*`,
which App Router handlers under `app/api/**` proxy to the Neon endpoint.
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

## Backend deploy (Neon)

The API is a Neon Function, not a Vercel serverless function. The verified
target is project `empty-bar-94645349` (`oma-ai-prod`), branch
`br-sweet-rain-b40o54xa` (`main`), function `omaapi`, runtime `nodejs24`.

Apply pending database migrations before deploying API code that uses new
tables or columns. Set `DATABASE_URL` securely to this branch's unpooled
production connection, then run the existing migration command:

```bash
pnpm --filter oma-server db:migrate
```

The migrator applies pending files from `server/src/db/migrations` in a
transaction and records them in `drizzle.__drizzle_migrations`. Verify the
expected journal entry and schema after it completes. A successful
`/ready` database check only proves connectivity; it does not prove that
migrations were applied. Do not deploy code requiring a migration that
failed or was skipped.

For a code-only release, deploy the tested entry point with an explicit
project and branch. This preserves the existing function environment:

```bash
npx --yes neon@6.2.3 functions deploy omaapi \
  --src server/src/index.ts \
  --project-id empty-bar-94645349 \
  --branch br-sweet-rain-b40o54xa --wait
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
`oma-settlement-dlq` scheduled triggers. Both run every minute. A code-only
function deploy leaves these existing triggers in place.

After deploying, confirm that the current and active function deployments
are both completed, then verify the API's dependencies:

```bash
npx --yes neon@6.2.3 functions get omaapi \
  --project-id empty-bar-94645349 --branch br-sweet-rain-b40o54xa
curl -fsS https://br-sweet-rain-b40o54xa-omaapi.compute.c-6.us-east-2.aws.neon.tech/ready
```

`https://www.oma-ai.com/api/health` checks the web tier only. The native API
`/ready` probe checks Postgres and Redis; require a successful readiness
response as well as a successful frontend health response.

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

## Self-hosting

`deploy/coolify/` is an **unused** self-host reference, not the production
path. The verified production frontend is the Vercel project. See
[`deploy/coolify/README.md`](../deploy/coolify/README.md) — and do not
repoint working `www` records at Coolify as routine cleanup.

## Related

- [`PLATFORM.md`](PLATFORM.md) — platform behaviour, billing, required operator
  environment variables.
- [`settlement-runbook.md`](settlement-runbook.md) — Polar/x402 operational
  notes.
