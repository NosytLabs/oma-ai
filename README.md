# OMA-AI

[![Website](https://img.shields.io/badge/website-oma--ai.com-0d1117?style=flat&labelColor=0d1117&color=46d39a)](https://oma-ai.com)
[![Version](https://img.shields.io/badge/version-2.1.0-0d1117?style=flat&labelColor=0d1117&color=46d39a)](#)
[![License](https://img.shields.io/badge/license-MIT-0d1117?style=flat&labelColor=0d1117&color=46d39a)](#)
[![Status](https://img.shields.io/badge/status-active_development-0d1117?style=flat&labelColor=0d1117&color=46d39a)](#)

> **One gateway. Every model. No lock-in.**

OMA-AI is an open-source, privacy-first multi-provider AI inference gateway. It exposes an OpenAI-compatible API, routes requests across curated model providers with automatic fallback, and handles billing—including crypto-native x402 micropayments—so developers and agents can build without managing scattered API keys or subscriptions.

---

## What is OMA-AI?

OMA-AI stands for **Open Model Access**. It is a single API endpoint that unifies access to the best AI models across multiple providers.

| Need | OMA-AI Solution |
|------|-----------------|
| OpenAI-compatible apps | Drop-in `/v1/chat/completions` endpoint |
| Anthropic-compatible apps | Drop-in `/v1/messages` endpoint |
| Multi-model routing | Automatic failover across providers (static peer map + hidden Surplus retry) |
| Agent billing | x402 USDC micropayments + Polar card credits |
| Privacy | Prompts not used for training; usage is metered for billing |

One OpenAI-compatible endpoint for a curated catalog. Venice-routed models include a 25% platform fee; OMA-AI/OpenBroker prices already include margin. Guest chat is free with a daily cap.

---

## Core Features

### 🪄 Magic Link Auth
Passwordless onboarding with magic-link email sign-in or SIWE (Sign-In with Ethereum) wallet authentication. Get an API key in seconds—no credit card required for the free tier.

### 💳 x402 USDC Crypto Billing
Agent-native, pay-per-request billing powered by EIP-3009. Agents settle the same listed prices in USDC on Base. No subscriptions, no minimums.

### 🛡️ Fallback Routing & Circuit Breakers
Built-in health checks and automatic provider failover. If one upstream goes down, OMA-AI seamlessly routes traffic to the next best available model—so your app stays up.

### 📊 Developer Dashboard
Manage API keys, monitor real-time usage and spend, inspect request logs, and configure model preferences—all from a polished, real-time dashboard.

### 🤖 OpenAI & Anthropic Compatible

Drop-in replacement for any OpenAI or Anthropic SDK. Unified chat completions (`/v1/chat/completions`) and Anthropic messages (`/v1/messages`) endpoints.

### 🎯 Curated Model Registry

22 curated chat models (18 Venice + 4 OMA-AI) across providers. We curate the best models so you don't have to sift through 100+ low-quality alternatives.

### 🆓 Free Guest Chat
Budget-friendly, sign-in-free chat via OMA-AI models with a generous daily limit for anonymous visitors. Perfect for evaluating the platform before upgrading.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS v4 |
| **Backend** | Hono (Node), TypeScript |
| **Database** | PostgreSQL (Neon-ready) + Drizzle ORM |
| **Cache / Queue** | Redis |
| **Auth** | Better Auth + SIWE (Ethereum wallets) |
| **Billing** | Polar.sh (cards) + x402 / EIP-3009 (USDC) |
| **Testing** | Vitest, Playwright |
| **Package Manager** | pnpm (monorepo) |

---

## Quick Start

Get OMA-AI running locally in under 2 minutes.

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** 9.x (pinned via `packageManager`)
- **PostgreSQL** 16 (local or Docker)
- **Redis** (local or Docker)

### 1. Clone & Install

```bash
git clone https://github.com/NosytLabs/oma-ai.git
cd oma-ai
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Edit `server/.env` and add `VENICE_API_KEY` and `OPENBROKER_API_KEY`. For local development, placeholders log as unset.

### 3. Start Local Database

```bash
./scripts/dev/local-db-up.sh
```

This boots local Postgres 16 + Redis, creates the `oma` role/database, and prints the connection strings.

### 4. Launch the Dev Stack

```bash
./scripts/dev/start-dev.sh
```

| Service | URL |
|---------|-----|
| Frontend (Next.js) | http://localhost:3000 |
| API (Hono) | http://localhost:3001 |
| Health Check | http://localhost:3001/health |

### 5. Verify

```bash
pnpm validate
```

Runs type checking, linting, and tests across `app/` and `server/`.

---

## Project Structure

```
oma-ai/
├── app/                    # Next.js 15 frontend
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # Shared React components
│   │   └── lib/           # Utilities, hooks, data
│   └── public/            # Static assets, logos, agent docs
├── server/                 # Hono API (Node)
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── inference/     # Model routing, providers, failover
│   │   └── db/            # Drizzle schema + migrations
│   └── .env.example
├── scripts/
│   ├── dev/               # Local dev helpers (DB, Chrome debug)
│   └── ops/               # Prod launch helpers
├── deploy/                 # Coolify / Docker Compose snippets
├── docker-compose*.yml     # Local / production compose
├── BRAND.md               # Design tokens, voice, logo rules
├── SECURITY.md            # Security policy
└── README.md
```

---

## Architecture

### Authentication Flow

- **Web app auth:** Better Auth session cookies (magic-link email or SIWE wallet sign-in).
- **API access:** Dashboard-issued `oma_sk_...` keys, sent as `Authorization: Bearer <token>`.
- **SIWE:** EIP-4361 wallet sign-in maps addresses to user profiles.

### Payments & Treasury

```text
                  ┌──────────────────────┐
                  │    User Deposits     │
                  └──────────┬───────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 │                 ▼
  ┌─────────────────┐       │       ┌─────────────────┐
  │  x402 / Gasless │       │       │  USDC on Base   │
  │  Micropayments  │       │       │  (Direct EOA)   │
  └────────┬────────┘       │       └────────┬────────┘
           │                 │               │
           └─────────────────┼───────────────┘
                             ▼
                ┌───────────────────────────┐
                │ Deposit Recovery Watcher  │
                └──────────────────────────┘
                           ▼
                ┌───────────────────────────┐
                │    Credit User Account    │
                └───────────────────────────┘
```

- **USDC direct deposits (Base):** a watcher daemon verifies Transfer logs to the treasury and credits balances.
- **x402 micropayments:** HTTP 402 pay-per-request with EIP-3009 authorizations, gasless via the QuickNode facilitator.

### Production Docker Builds

```bash
docker build -t oma-app -f app/Dockerfile .
docker build -t oma-server -f server/Dockerfile .
```

For end-to-end self-hosting on Coolify (or any Docker Compose host), including the Caddy reverse proxy, environment checklist, and Polar webhook setup, see [`deploy/coolify/README.md`](deploy/coolify/README.md).

---

## Testing

| Command | Scope |
|---------|-------|
| `pnpm validate` | Full CI gate: typecheck + lint + test (app + server) |
| `pnpm validate:app` | Frontend only |
| `pnpm validate:server` | Backend only |
| `pnpm validate:test` | All unit / integration tests across the app and server Vitest suites |

Always run `pnpm validate` locally before opening a pull request.

---

## Public Surfaces

| Path | Purpose |
|------|---------|
| `/` | Landing page — product value, primary CTAs |
| `/models` | Curated model catalog + pricing |
| `/chat` | Interactive chat playground (text + multimodal input) |
| `/pricing` · `/deposit` | Plans + credit / USDC funding |
| `/docs` · `/getting-started` | API docs + developer quickstart |
| `/dashboard` · `/settings` | API keys, usage analytics, preferences |
| `/faq` · `/glossary` | Educational guides |

- **Agent docs:** `/llms.txt` (machine-readable site index), `/agent-skill.md` (autonomous setup instructions)
- **OpenAPI:** `https://api.oma-ai.com/openapi.json` (also `/v1/openapi.json`)

---

## Contributing

OMA-AI is MIT-licensed and open to contributions.

1. **Fork & branch** from `main`
2. **Install deps:** `pnpm install`
3. **Make changes** and add tests
4. **Validate:** `pnpm validate`
5. **Open a PR** with a clear description

### Key Contribution Notes

- **Catalog sync:** Frontend static catalog lives in `app/src/lib/models-data.ts`; backend runtime catalog lives in `server/src/inference/models.ts`. Keep them in sync.
- **Animations:** Custom visual primitives are in `app/src/lib/animation/`.
- **Security:** See `SECURITY.md` for responsible disclosure policy.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/NosytLabs">NosytLabs</a>
</p>
