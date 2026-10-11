# OMA-AI

[![Website](https://img.shields.io/badge/website-www.oma--ai.com-0d1117?style=flat&labelColor=0d1117&color=46d39a)](https://www.oma-ai.com)
[![Version](https://img.shields.io/badge/version-2.1.0-0d1117?style=flat&labelColor=0d1117&color=46d39a)](#)
[![License](https://img.shields.io/badge/license-MIT-0d1117?style=flat&labelColor=0d1117&color=46d39a)](#)
[![Status](https://img.shields.io/badge/status-active_development-0d1117?style=flat&labelColor=0d1117&color=46d39a)](#)

> **One gateway. Every model. No lock-in.**

OMA-AI is an open-source, privacy-first multi-provider AI inference gateway. It exposes an OpenAI-compatible API, routes requests across curated model providers with automatic fallback, and handles billing—including USDC deposits and x402 verify/settle funding on Base—so developers and agents can build without managing scattered API keys or subscriptions.

---

## What is OMA-AI?

OMA-AI (**Open Model Access**) is a single API endpoint that fronts multiple AI providers.

| Need | OMA-AI Solution |
|------|-----------------|
| OpenAI-compatible apps | Drop-in `/v1/chat/completions` endpoint |
| Anthropic-compatible apps | Drop-in `/v1/messages` endpoint |
| Multi-model routing | Bounded retries and configured fallback routes for mapped models |
| Agent billing | x402 USDC verify/settle → credits + optional Polar card |
| Privacy | The gateway does not persist prompt or completion content; website history stays in your browser and upstream policies vary |

One OpenAI-compatible endpoint for a curated catalog. Venice-routed models include a 50% markup on catalog rates; OMA-AI/OpenBroker models cost $0.02 per million input tokens and $0.02 per million output tokens. Guest chat is free with a daily cap. OpenBroker's USD provider cost depends on GNK acquisition cost and retries, so its margin is not assumed.

---

## Core Features

### 🪄 Magic Link Auth
Passwordless onboarding with magic-link email sign-in or SIWE (Sign-In with Ethereum) wallet authentication. Get an API key in seconds—no credit card required for the free tier.

### 💳 x402 USDC Crypto Billing
Agent-native USDC funding powered by EIP-3009. Agents sign the payment envelope, call `/x402/verify` to broadcast the transfer, then `/x402/settle` with the payer's SIWE session to credit the account. Inference spends those prepaid credits through an API key. No subscriptions; funding methods have their own deposit limits.

### 🛡️ Bounded Fallback Routing
Requests use a shared timeout budget and configured fallback peers. Paused models are excluded, and caller cancellation stops further retries. Responses identify the actual model and whether fallback occurred; catalog availability is not a continuous live provider health check.

### 📊 Developer Dashboard
Manage API keys, review recorded usage and spend, inspect request logs, and manage account settings in one dashboard. Chat preferences live in the playground.

### 🤖 OpenAI & Anthropic Compatible

Drop-in replacement for any OpenAI or Anthropic SDK. Unified chat completions (`/v1/chat/completions`) and Anthropic messages (`/v1/messages`) endpoints.

### 🎯 Curated Model Registry

A curated chat catalog across providers. We keep the public model list current so you do not have to sift through hundreds of low-quality alternatives; the live `/v1/models` endpoint is the source of truth for availability and pricing.

### 🆓 Free Guest Chat
Chat with the eligible OMA-AI models without signing in, within the daily guest allowance. The workspace includes searchable browser-local conversations, per-thread drafts, model comparison, and OpenUI cards and forms in Interactive mode. See [Chat UI](docs/chat-ui.md) for behavior and storage details.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4 |
| **Backend** | Hono (Node), TypeScript |
| **Database** | PostgreSQL (Neon-ready) + Drizzle ORM |
| **Cache / Queue** | Redis |
| **Auth** | Better Auth + SIWE (Ethereum wallets) |
| **Billing** | USDC / x402, plus Polar cards when configured |
| **Testing** | Vitest, Playwright |
| **Package Manager** | pnpm (monorepo) |

---

## Quick Start

Run the frontend and API locally with PostgreSQL and Redis.

### Prerequisites

- **Node.js** ≥ 24
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

Runs type checking, linting, tests, and production builds across `app/` and `server/`.

---

## Documentation

| Reference | Source of truth |
|-----------|-----------------|
| [Platform](docs/PLATFORM.md) | Billing, authentication, funding rails, and operator configuration |
| [Chat UI](docs/chat-ui.md) | Conversation history, OpenUI actions, shared rendering, and browser validation |
| [Deployment](docs/DEPLOYMENT.md) | Production topology and deployment procedures |
| [Brand](BRAND.md) | Visual tokens, typography, navigation, and product language |
| [Settlement runbook](docs/settlement-runbook.md) | Payment recovery and settlement operations |
| [Documentation index](docs/README.md) | Maintained references and dated audit receipts |
| [Public docs](https://www.oma-ai.com/docs) | Customer quickstart, API usage, and integrations |

Keep implementation details in these references and link to them from summaries so parallel copies do not drift.

## Project Structure

```
oma-ai/
├── app/                    # Next.js 16 frontend
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
├── deploy/                 # Self-host notes (Coolify/Compose unused in prod)
├── docker-compose*.yml     # Self-host compose (NOT the production path — see docs/DEPLOYMENT.md)
├── server/neon.ts          # Neon IaC manifest (functions, cron, schema)
├── BRAND.md               # Design tokens, voice, logo rules
├── SECURITY.md            # Security policy
└── README.md
```

---

## Architecture

### Authentication Flow

- **Web app auth:** Better Auth session cookies (magic-link email or SIWE wallet sign-in).
- **API access:** Dashboard-issued `oma_sk_...` keys, sent as `Authorization: Bearer oma_sk_...`
- **SIWE:** EIP-4361 wallet sign-in maps addresses to user profiles.

### Payments & Treasury

OMA uses one prepaid credit ledger in Postgres. Customers fund it with direct USDC deposits on Base, card checkout when available, or authenticated x402 settlement. Successful API requests deduct their cost from that balance; website chat has a separate daily free allowance.

For the authoritative billing model, supported payment flows, authentication boundaries, and required configuration, see [`docs/PLATFORM.md`](docs/PLATFORM.md). Operational recovery procedures live in [`docs/settlement-runbook.md`](docs/settlement-runbook.md).

### Production Docker Builds

```bash
docker build -t oma-app -f app/Dockerfile .
docker build -t oma-server -f server/Dockerfile .
```

For end-to-end self-hosting on Coolify (or any Docker Compose host), including the Caddy reverse proxy, environment checklist, and Polar webhook setup, see [`deploy/coolify/README.md`](deploy/coolify/README.md). **That path is unused in production** — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Production uses Vercel for the frontend and a Neon Function for the API. A frontend deployment does not deploy backend changes. Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the current targets, repository-root commands, environment-preservation rules, and verification steps.

---

## Testing

| Command | Scope |
|---------|-------|
| `pnpm validate` | Full CI gate: typecheck + lint + test + build (app + server) |
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
| `/pricing` · `/deposit` | Per-model rates + prepaid credit funding |
| `/docs` · `/getting-started` | API docs + developer quickstart |
| `/dashboard` · `/settings` | API keys, usage analytics, preferences |
| `/faq` · `/glossary` | Educational guides |

- **Agent docs:** `/llms.txt` (machine-readable site index), `/agent-skill.md` (autonomous setup instructions)
- **OpenAPI:** `https://www.oma-ai.com/api/v1/openapi.json`

> `www.oma-ai.com` is the canonical host; the apex `oma-ai.com` 308-redirects to it.
> There is no `api.oma-ai.com` — the API is same-origin under `/api/*`. See
> [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the canonical deployment reference.

---

## Contributing

OMA-AI is MIT-licensed and open to contributions.

1. **Fork & branch** from `main`
2. **Install deps:** `pnpm install`
3. **Make changes** and add tests
4. **Validate:** `pnpm validate`
5. **Open a PR** with a clear description

### Key Contribution Notes

- **Catalog:** `server/src/inference/model-catalog.json` is shared by the frontend and backend. Update it once; parity tests check displayed rates, capabilities, and limits. Runtime availability and price overrides remain server-owned.
- **Animations:** Custom visual primitives are in `app/src/lib/animation/`.
- **Security:** See `SECURITY.md` for responsible disclosure policy.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/NosytLabs">NosytLabs</a>
</p>
