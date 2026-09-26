# Coolify Deployment Guide

This directory contains `docker-compose.yml` and a `Caddyfile` for **optional self-hosting** of OMA-AI on Coolify (or another Docker Compose environment).

The verified public web frontend is currently served by the existing Vercel `oma` project. Do not repoint the working `oma-ai.com` / `www` frontend records to Coolify as routine cleanup. Use this guide only when intentionally choosing Coolify for an app or API deployment.

## Prerequisites

1. A server with at least 2 vCPUs and 2GB RAM.
2. [Coolify](https://coolify.io) installed on your server.
3. A hostname pointed to your server. **Do not use `api.oma-ai.com`** -- no such record is
   wanted. Production serves the API from `https://www.oma-ai.com/api/*` via the Next.js
   proxy, and `api.oma-ai.com` is intentionally NXDOMAIN. Only repoint `oma-ai.com` or
   `www.oma-ai.com` if you are deliberately replacing the Vercel frontend.

## 1. Environment Setup

Set the following values in Coolify's environment UI. Do not copy local
development placeholders into a production deployment.
The critical variables to set for production are:
- `BETTER_AUTH_SECRET` (generate with `openssl rand -hex 64`)
- `ENCRYPTION_KEY` (generate with `openssl rand -hex 32`)
- `RECEIPT_HMAC_SECRET` (generate with `openssl rand -hex 32`)
- `TREASURY_BASE_ADDRESS`
- `QUICKNODE_RPC_URL` (Base mainnet RPC — `CHAIN_RPC_URL` is an accepted alias)
- `PUBLIC_APP_URL`, `PUBLIC_API_URL`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, and
  `PRIMARY_DOMAIN` for your actual public domains. The app URL must be included
  in CORS, and `PRIMARY_DOMAIN` must be the hostname only (for example,
  `oma-ai.com`, not `https://oma-ai.com`).

Optional card payments (Polar.sh merchant of record): set `POLAR_ACCESS_TOKEN`,
`POLAR_WEBHOOK_SECRET`, and the three
`POLAR_{HOBBY,BUILDER,SCALE}_PRODUCT_ID` product UUIDs. Point the Polar
dashboard webhook at `https://<your-api-domain>/webhooks/polar` (events:
`order.paid`, `order.refunded`). Leave `POLAR_ACCESS_TOKEN` unset to disable
the card rail. If it is set, startup rejects partial configuration so payments
cannot be accepted without a verified credit-grant webhook.

## 2. Deploy with Coolify

1. Create a new **Docker Compose** project in Coolify.
2. Paste the contents of `docker-compose.yml`.
3. Set your environment variables in the Coolify UI.
4. Deploy!

## 3. Exposing to the web

The `docker-compose.yml` uses an internal network and relies on a reverse proxy like Caddy or Cloudflare Tunnels to handle SSL and routing. If you use Caddy, you can use the provided `Caddyfile`.

Alternatively, Coolify can handle the reverse proxy automatically if you set the domains on the
services. Point **one** hostname at the edge -- either `app` or `server`, not both. There is no
`api.oma-ai.com` hostname in this architecture; the server is reached through the frontend's
`/api/*` proxy path.

## 4. DNS (Spaceship / any registrar)

Current verified state:

- `oma-ai.com` / `www.oma-ai.com` serves the web frontend (Vercel, project `oma`).
- There is **no** `api.oma-ai.com` record, by design. The API is `https://www.oma-ai.com/api/*`.
- The backend is a Neon Function (`omaapi`), not a long-lived server process. Coolify is unused.

If you intentionally choose Coolify for the API, point **only the API hostname you intend Coolify to serve** at the Coolify VPS and verify the service before changing any working frontend records. If you choose another backend target (for example the repository's Neon Function path), use that target's DNS instructions instead.

After any DNS change, verify the exact host and TLS before announcing it:

```bash
dig +short oma-ai.com A
curl -fsS -o /dev/null -w "%{http_code}\n" https://oma-ai.com/
curl -fsS https://www.oma-ai.com/api/health
# api.oma-ai.com should NOT resolve. If it does, you have created a record that should not exist:
dig +short api.oma-ai.com A   # expected: empty
```

Do not overwrite `@` or `www` merely because this optional Coolify example exists.

## 5. Earn-path smoke after deploy

1. Sign in (magic link or SIWE) on `https://www.oma-ai.com/login`.
2. Create an API key on `/dashboard`.
3. Deposit a small USDC amount on Base via `/deposit` (or settle via `/x402/*`).
4. Call `POST https://www.oma-ai.com/api/v1/chat/completions` with the key.
5. Confirm balance decreases on `/dashboard`.

Card rail: only after Polar env + webhook `https://www.oma-ai.com/api/webhooks/polar`.
