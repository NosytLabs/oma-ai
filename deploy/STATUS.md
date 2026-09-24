# Project status

Last audit: 2026-09-23.

OMA-AI is a TypeScript monorepo (Next.js app + Hono API) with USDC deposits,
optional Polar card checkout, and x402 verify/settle → credit balance → API spend.

## Current production state

- **Web frontend:** `https://oma-ai.com` / `https://www.oma-ai.com` resolves and serves the OMA Next.js application.
- **Vercel project:** `oma` has a READY production deployment from GitHub `main`, currently at commit `e30f6086141b1598f0400c48ecc9eb9323d037e3`.
- **Verified source:** the newer `main` application state passed frozen install, full validation, app build, and server build in GitHub Actions run `35870621887` after fixing one unused test import.
- **Deployment gap:** GitHub does not currently have a `VERCEL_TOKEN` secret, so the verified newer source could not be explicitly redeployed from Actions. Do not add or expose a token merely to make CI green.
- **API DNS:** there is intentionally no `api.oma-ai.com` record. The public API is served from
  `https://www.oma-ai.com/api/*` via the Next.js proxy, which forwards to the Neon Function.
  Do not create DNS for `api.oma-ai.com`.

A green frontend request is still not proof of end-to-end inference availability. Verify with a real
chat completion against `/api/v1/chat/completions`.

## Local verify

- `./scripts/dev/local-db-up.sh`
- `./scripts/dev/start-dev.sh`
- `pnpm validate`
- `./scripts/ops/check-launch-env.sh` (against `.env.prod`)

## Earn path

1. Guest website chat (free OMA-AI models, daily cap)
2. Magic link / SIWE wallet login
3. USDC deposit on Base (when `USDC_DEPOSIT_ADDRESS` is set)
4. x402 `/x402/verify` + authenticated `/x402/settle` → credits `credit_balances`
5. API keys spend credits on `/v1/chat/completions` (conditional deduct; no silent floor-to-zero)

## Deployment paths

Verified 2026-09-24 against production, not inferred from config:

- **Frontend:** Vercel project `oma` → `https://www.oma-ai.com`. The apex
  `oma-ai.com` 308-redirects to `www`, so **`www` is the canonical host**.
- **Backend:** a **Neon compute endpoint** (`*.compute.<region>.aws.neon.tech`,
  referenced by `NEXT_PUBLIC_API_URL`). Confirmed live: `/v1/models` and
  `/health` both return 200.
- **Database:** Neon Postgres via `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.
- **No `api.oma-ai.com` DNS exists and none is required.** The frontend serves
  `/api/*` from App Router handlers under `app/api/**` (including a
  catch-all) that proxy to the Neon endpoint. This is deliberately *not* a
  `next.config` rewrite — a rewrite would skip the HttpOnly
  session-cookie → `Authorization` translation and 401 every authenticated
  call after a hard reload.

### Where secrets live

The Vercel project carries only **five** variables, all frontend-scoped
(`RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`,
`DATABASE_URL`, `DATABASE_URL_UNPOOLED`).

The API secrets — `BETTER_AUTH_SECRET`, `RECEIPT_HMAC_SECRET`,
`ENCRYPTION_KEY`, `VENICE_API_KEY`, `FACILITATOR_PRIVATE_KEY` — are **not**
in Vercel. They belong to the **Neon** deployment, because that is the
process that actually runs the Hono server. Do not add them to Vercel; that
project does not execute the API.

`deploy/coolify/` is **unused**. It is retained only as a self-host
reference and is not the production path. Anything asserting Coolify as the
production host is stale.

Do not point working frontend DNS at a new host as a cleanup step. Hosting changes require verifying environment variables, domains, health endpoints, and rollback paths first.

## Product truth

- Credits never expire while the account is active.
- x402 is verify → settle → credit → spend with API key (not a mid-request 402 on chat).
- Card checkout is Setup required until Polar is configured.
