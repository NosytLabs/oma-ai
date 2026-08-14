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
| Multi-model routing | Automatic failover and load balancing across providers |
| Agent billing | x402 USDC micropayments + Polar card credits |
| Privacy | Zero logs, zero training, zero tracking |

By switching to OMA-AI, you get access to the best models at wholesale rates, without managing multiple API keys, subscriptions, or navigating complex provider billing. Try our generous free tier and upgrade when you are ready to scale.

---

## Core Features

### 🪄 Magic Link Auth
Passwordless onboarding with magic-link email sign-in or SIWE (Sign-In with Ethereum) wallet authentication. Get an API key in seconds—no credit card required for the free tier.

### 💳 x402 USDC Crypto Billing
Agent-native, pay-per-request billing powered by EIP-3009. Autonomous agents can settle inference costs in USDC on Base with zero markup. No subscriptions, no minimums.

### 🛡️ Fallback Routing & Circuit Breakers
Built-in health checks and automatic provider failover. If one upstream goes down, OMA-AI seamlessly routes traffic to the next best available model—so your app stays up.

### 📊 Developer Dashboard
Manage API keys, monitor real-time usage and spend, inspect request logs, and configure model preferences—all from a polished, real-time dashboard.

### 🤖 OpenAI & Anthropic Compatible
Drop-in replacement for any OpenAI or Anthropic SDK. Support for chat completions, image generation, and video generation through a single, unified API surface.

### 🎯 Curated Model Registry
26 curated chat models (18 Venice + 8 OMA-AI) across providers. We curate the best models so you don't have to sift through 100+ low-quality alternatives.

### 🆓 Free Guest Chat
Budget-friendly, sign-in-free chat via OMA-AI models with a generous daily limit for anonymous visitors. Perfect for evaluating the platform before upgrading.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS v4 |
| **Backend** | Hono (Bun/Node), TypeScript |
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
- **pnpm** ≥ 9
- **PostgreSQL** 16 (local or Docker)
- **Redis** (local or Docker)
- **Bun** (for hot-reload server dev)

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

Edit `server/.env` and add your upstream provider keys (`ZYLOO_API_KEY`, `VENICE_API_KEY`, etc.). For local development, the defaults will work out of the box.

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
├── server/                 # Hono API (Bun/Node)
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── inference/     # Model routing, providers, failover
│   │   └── db/            # Drizzle schema + migrations
│   └── .env.example
├── scripts/
│   ├── dev/               # Local dev helpers (DB, Chrome debug)
│   └── ops/               # Deploy, prod launch, wallets, seed
├── deploy/                 # Coolify / Docker Compose snippets
├── docker-compose*.yml     # Local / production compose
├── BRAND.md               # Design tokens, voice, logo rules
├── SECURITY.md            # Security policy
└── README.md
```

---

## Testing

| Command | Scope |
|---------|-------|
| `pnpm validate` | Full CI gate: typecheck + lint + test (app + server) |
| `pnpm validate:app` | Frontend only |
| `pnpm validate:server` | Backend only |
| `pnpm validate:test` | All unit / integration tests (~399 vitest suites) |

Always run `pnpm validate` locally before opening a pull request.

---

## Public Surfaces

| Path | Purpose |
|------|---------|
| `/` | Landing page — product value, primary CTAs |
| `/models` | Curated model catalog + pricing |
| `/chat` | Interactive playground (text, image, video) |
| `/pricing` · `/deposit` | Plans + credit / USDC funding |
| `/docs` · `/getting-started` | API docs + developer quickstart |
| `/dashboard` · `/settings` | API keys, usage analytics, preferences |
| `/capabilities` · `/compare` · `/faq` · `/glossary` | Educational guides |

- **Agent docs:** `app/public/llms.txt`, `app/public/agent-skill.md`
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
