# Deployment

Canonical deployment facts for OMA-AI. Other docs link here rather than
restating them — this file is the single source of truth so a deploy
instruction can't drift between documents.

Last verified against live infrastructure: 2026-09-26.

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
```

## What runs where

| Tier | Host | Notes |
|------|------|-------|
| Frontend | Vercel project `oma` | Next.js app from this repo. |
| API | Neon compute endpoint (`omaapi`) | The Hono server runs here, not on Vercel. |
| Database | Neon Postgres | `DATABASE_URL` / `DATABASE_URL_UNPOOLED`. |

A Vercel deploy ships the **frontend only**. It does not pick up server-side
changes — those require a Neon deploy (see below).

The browser reaches the API same-origin at `https://www.oma-ai.com/api/*`,
which App Router handlers under `app/api/**` proxy to the Neon endpoint. This
is deliberately not a `next.config` rewrite: a rewrite would skip the
HttpOnly session-cookie → `Authorization` translation and 401 every
authenticated call after a hard reload.

## Frontend deploy (Vercel)

```bash
vercel deploy --prod --yes
```

**Run it from the repository root** (`oma-ai/`), not from `app/`.

The two are easy to confuse, and conflating them is the most common deploy
mistake here:

- The Vercel **project's** Root Directory is `app`. That is a *dashboard
  setting* telling Vercel where the app lives inside the repo; Vercel applies
  it itself during the build.
- The Vercel **CLI link** (`.vercel/`) is committed at the *repository root*.
  The CLI resolves the link by walking up from the working directory, so it
  must be invoked from the root. Running it from `app/` finds no link and
  prompts to create a new project.

`app/vercel.json` does not exist, and neither does `app/.vercel`. Root
Directory is a project setting only — there is no in-repo file that sets it.

Verify a deploy actually went to production (a green local build is not
proof):

```bash
vercel ls oma
curl -fsS -o /dev/null -w "%{http_code}\n" https://www.oma-ai.com/
```

`productionBranch` has historically been stuck on the retired `master`, so
push-to-`main` has not always auto-deployed. If a push does not produce a
deployment, run the command above. Re-linking the production branch is a
manual dashboard action and needs a token that is deliberately not in CI —
do not add `VERCEL_TOKEN` merely to make a check green.

## Backend deploy (Neon)

The API is a Neon Function, not a Vercel serverless function. The
infrastructure-as-code manifest is `server/neon.ts`, from the repository
root:

```bash
neon config plan --config server/neon.ts            # preview, no apply
neon deploy --config server/neon.ts --update-existing
```

`NEON_API_KEY` must be exported. The manifest registers the `omaapi` function
plus the `oma-deposit-recovery` scheduled trigger.

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
