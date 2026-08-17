# Coolify Deployment Guide

This directory contains the production-ready `docker-compose.yml` and `Caddyfile` for self-hosting OMA-AI on Coolify (or any Docker Compose environment).

## Prerequisites

1. A server with at least 2 vCPUs and 2GB RAM.
2. [Coolify](https://coolify.io) installed on your server.
3. A domain name pointed to your server (e.g., `oma-ai.com` and `api.oma-ai.com`).

## 1. Environment Setup

Copy `.env.example` to `.env` and configure your environment variables. 
The critical variables to set for production are:
- `BETTER_AUTH_SECRET` (generate with `openssl rand -hex 64`)
- `ENCRYPTION_KEY` (generate with `openssl rand -hex 32`)
- `RECEIPT_HMAC_SECRET` (generate with `openssl rand -hex 32`)
- `TREASURY_BASE_ADDRESS`
- `QUICKNODE_RPC_URL` (Base mainnet RPC — `CHAIN_RPC_URL` is an accepted alias)

Optional card payments (Polar.sh merchant of record): set `POLAR_ACCESS_TOKEN`,
`POLAR_WEBHOOK_SECRET`, `POLAR_ORGANIZATION_ID`, and the three
`POLAR_{HOBBY,BUILDER,SCALE}_PRODUCT_ID` product UUIDs. Point the Polar
dashboard webhook at `https://api.oma-ai.com/webhooks/polar` (events:
`order.paid`, `order.refunded`). Leave `POLAR_ACCESS_TOKEN` unset to disable
the card rail.

## 2. Deploy with Coolify

1. Create a new **Docker Compose** project in Coolify.
2. Paste the contents of `docker-compose.yml`.
3. Set your environment variables in the Coolify UI.
4. Deploy!

## 3. Exposing to the web

The `docker-compose.yml` uses an internal network and relies on a reverse proxy like Caddy or Cloudflare Tunnels to handle SSL and routing. If you use Caddy, you can use the provided `Caddyfile`.

Alternatively, Coolify can handle the reverse proxy automatically if you set the domains on the services (`app` -> `oma-ai.com`, `server` -> `api.oma-ai.com`).
