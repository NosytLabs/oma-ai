# OMA AI Gateway

**Website:** https://oma-ai.com  
**Version:** 2.1.0  
**Status:** Production Ready  
**Brand:** Open Model Access · void `#07090a` · accent `#46d39a` · see `BRAND.md`

Self-hosted AI inference gateway with wallet-based auth, multi-provider routing, cross-chain deposits, and native crypto payments (USDC on Base, x402).

> **Routing changes:** `/blog` and `/faq` permanently redirect (`/blog` → `/changelog`, `/faq` → `/pricing#faq`). `/swap` retired — fund via USDC deposit on Base (`/deposit`). `/about` is a live E-E-A-T page. Homepage, footer, sitemap, `llms.txt` / `agents.md` aligned to brand voice (see `BRAND.md`).

---

## Features

### Payment Methods
- **USDC on Base** - Direct deposit, settlement via the x402 facilitator
- **Any token, 20+ chains** - Cross-chain via LI.FI / Circle CCTP into USDC on Base
- **x402 Payments** - Per-request USDC receipts on Base for AI agents (Coinbase CDP facilitator)

> **Deposit methods:** USDC on Base, LI.FI / Circle CCTP cross-chain USDC, and x402. Solana SOL / Jupiter swap is not supported.

### Developer Features
- **OpenAI-Compatible API** - Drop-in replacement, change base URL
- **Streaming Support** - Real-time responses
- **Rate Limiting** - Per-key and per-model limits
- **API Key Management** - Create, revoke, track usage

---

## Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/NosytLabs/oma-ai
cd oma-ai

# Copy env files
cp server/.env.example server/.env
cp app/.env.example app/.env.local
```

### 2. Configure

Edit `server/.env`:
```env
DATABASE_URL=postgresql://user:pass@host/database
JWT_SECRET=your-40-char-secret-key-here
VENICE_API_KEY=sk-...
```

Edit `app/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Run

```bash
# From oma root
./scripts/start-dev.sh

# Or manually (lockfiles and CI are pnpm-managed):
cd app && pnpm run dev      # Frontend :3000
cd server && pnpm run dev   # Backend (Hono API) :3001

# Windows: start-dev.sh is bash-only. Use the manual commands above,
# or: docker compose up (requires Docker Desktop)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Users                                 │
│              (Wallets + API Keys)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Frontend (:3000)                   │
│    Landing │ Dashboard │ Pricing │ Chat │ Docs        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Hono.js API (:3001)                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   Auth   │  │ Inference│  │ Deposits │  │  x402    │    │
│  │   (SIWE) │  │  Router  │  │          │  │Payments │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
          ▼              ▼              ▼              ▼
     ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
     │Postgres │   │  Venice  │   │  LI.FI   │   │On-chain │
     │+ Redis  │   │   AI     │   │  Swap   │   │(Base)   │
     │(data +  │   │          │   │  CCTP   │   │         │
     │ limits) │   │          │   │         │   │         │
     └─────────┘   └──────────┘   └──────────┘   └─────────┘
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/nonce` | Get SIWE nonce for wallet |
| POST | `/auth/verify` | Verify signature, get session |
| POST | `/auth/wallet` | Bind an additional wallet to your account |
| GET | `/user` | Get current user info |

### Inference (OpenAI-Compatible)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Chat completion |
| POST | `/v1/completions` | Text completion |
| POST | `/v1/embeddings` | Get embeddings |
| POST | `/v1/images/generations` | Image generation |
| POST | `/v1/audio/speech` | Text-to-speech |
| POST | `/v1/videos/generations` | Video generation |
| GET | `/v1/models` | List available models |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/balance` | Get credit balance |
| POST | `/v1/deposit/usdc` | USDC deposit on Base |
| POST | `/v1/deposit/lifi` | Cross-chain via LI.FI |
| POST | `/v1/deposit/cctp` | Cross-chain via CCTP |
| GET | `/v1/deposit/status` | Check deposit status |

### x402 Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/x402/verify` | Verify payment receipt |
| POST | `/x402/settle` | Settle payment |

---

## Available Models

Live catalog fetched from `GET /v1/models` (OpenAI-compatible) — each entry
carries `pricing.prompt` / `pricing.completion` (per-token USD strings),
`context_length`, `architecture`, and `supported_parameters`. The
`app/src/lib/models-data.ts` module ships a small hand-picked fallback for SSR
metadata so layout descriptions and `MODEL_COUNT` work without an async fetch.

- **Web UI:** [oma-ai.com/models](https://oma-ai.com/models)
- **API:** `GET https://api.oma-ai.com/v1/models`

### Model Tiers (representative)

| Tier | Examples | Price range (input / 1M tokens) |
|------|----------|-----------------------------------|
| **Frontier** | `claude-opus-4-8-fast`, `openai-gpt-55-pro` | ~$12.00 – $37.50 |
| **Premium** | `claude-opus-4-8`, `claude-sonnet-4-5` | ~$3.13 – $6.25 |
| **Mid-Range** | `gemini-3-1-pro-preview`, `qwen-3-7-max` | ~$1.00 – $2.70 |
| **Budget** | `llama-3.3-70b`, `deepseek-v3.2`, `minimax-m2.7` (gonka) | ~$0.02 – $0.94 |

See `GET /v1/models` for the live, complete catalog and current pricing.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15, React 19 | Landing, dashboard, pages |
| Backend | Hono.js, Node.js 22 | API server |
| Database | PostgreSQL (Drizzle ORM) | Users, credits, deposits |
| Cache | Redis | Rate limiting, sessions |
| Blockchain | Base (EVM) | USDC deposits, x402 settlement |

---

## Cost to Run

| Service | Free Tier | Production |
|---------|-----------|------------|
| PostgreSQL (self-hosted via `docker-compose.prod.yml`, or Neon serverless) | Self-host $0 / Neon 0.5GB | ~$0–10/mo |
| Redis | Local / self-host | ~$0 (bundled) |
| Coolify hosting | Self-hosted | ~$5-20/mo |
| Venice API | Pay-per-token | Usage-based |
| Domain | $12/yr | ~$1/mo |

**Total: $15-40/mo** for self-hosted

---

## Documentation

This README is the primary documentation. For env vars and config, see `server/.env.example` and `app/.env.example`.

---

*Pay-as-you-go inference. Pay with crypto. Wallet-based auth.*

---

## Disclaimer

This software is provided **"AS IS"** and **"AS AVAILABLE"**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement.

In no event shall the authors, contributors, or copyright holders be liable for any claim, damages, or other liability — whether in an action of contract, tort, or otherwise — arising from, out of, or in connection with the software or the use or other dealings in the software.

OMA AI is a self-hosted gateway. Operators are solely responsible for their deployment environment, key management, regulatory compliance in their jurisdiction, and any costs incurred from third-party AI providers. Nothing in this repository constitutes financial, legal, or professional advice.

See [LICENSE](./LICENSE) for the full MIT license text.