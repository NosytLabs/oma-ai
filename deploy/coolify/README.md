# Coolify Deployment Guide

This directory contains the production-ready `docker-compose.yml` and `Caddyfile` for self-hosting OMA-AI on Coolify (or any Docker Compose environment).

## Prerequisites

1. A server with at least 2 vCPUs and 2GB RAM.
2. [Coolify](https://coolify.io) installed on your server.
3. A domain name pointed to your server (e.g., `oma-ai.com` and `api.oma-ai.com`).

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

Alternatively, Coolify can handle the reverse proxy automatically if you set the domains on the services (`app` -> `oma-ai.com`, `server` -> `api.oma-ai.com`).

## 4. DNS (Spaceship / any registrar)

As of the 2026-09-15 audit, `oma-ai.com` has Spaceship nameservers
(`launch1/2.spaceship.net`) but **no A/AAAA records** — the public site cannot
resolve until you add them.

In the Spaceship DNS panel for `oma-ai.com`, point traffic at your Coolify VPS:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<COOLIFY_VPS_IPV4>` | 300 |
| A | `api` | `<COOLIFY_VPS_IPV4>` | 300 |
| A | `www` | `<COOLIFY_VPS_IPV4>` | 300 |
| AAAA | `@` / `api` / `www` | `<COOLIFY_VPS_IPV6>` (optional) | 300 |

Then in Coolify assign domains: app → `oma-ai.com` (+ `www`), server → `api.oma-ai.com`.
Wait for TLS, then verify:

```bash
dig +short oma-ai.com A
dig +short api.oma-ai.com A
curl -fsS https://api.oma-ai.com/health
curl -fsS -o /dev/null -w "%{http_code}\n" https://oma-ai.com/
```

## 5. Earn-path smoke after deploy

1. Sign in (magic link or SIWE) on `https://oma-ai.com/login`.
2. Create an API key on `/dashboard`.
3. Deposit a small USDC amount on Base via `/deposit` (or settle via `/x402/*`).
4. Call `POST https://api.oma-ai.com/v1/chat/completions` with the key.
5. Confirm balance decreases on `/dashboard`.

Card rail: only after Polar env + webhook `https://api.oma-ai.com/webhooks/polar`.
