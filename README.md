# OMA AI Gateway

**Website:** https://oma-ai.com  
**Version:** 2.1.0  
**Status:** Production Ready  
**Brand:** Open Model Access · void `#07090a` · accent `#46d39a` · see `BRAND.md`

Self-hosted AI inference gateway with wallet-based auth, multi-provider routing, cross-chain deposits, and native crypto payments (USDC on Base, x402).

> **Site revamp (2026-07-11):** Brand assets regenerated from `favicon.svg` (icons, OG, lockup). Removed dead marketing routes (`/about`, `/blog`, `/faq`, …) with permanent redirects. Homepage, footer, sitemap, `llms.txt` / `agents.md` aligned to brand voice. App: typecheck + lint clean, **127** tests green.

---

## Features

### Payment Methods
- **USDC on Base** - Direct deposit, instant crediting
- **Solana SOL** - Cross-chain via Jupiter swap
- **20+ Chains** - Any token via HoudiniSwap
- **x402 Payments** - On-demand payment receipts for AI agents

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

# Or manually:
cd app && pnpm dev       # Frontend :3000
cd server && pnpm dev    # Backend (Hono API) :3001
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
     │  Redis  │   │  Venice  │   │ Houdini  │   │On-chain │
     │ (Rate    │   │   AI     │   │  Swap   │   │(Base)   │
     │ Limits) │   │          │   │  CCTP   │   │         │
     └─────────┘   └──────────┘   └──────────┘   └─────────┘
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/nonce` | Get SIWE nonce for wallet |
| POST | `/auth/verify` | Verify signature, get session |
| POST | `/auth/wallet` | Sign message, get API key |
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
| POST | `/v1/deposit/houdini` | Cross-chain via Houdini |
| GET | `/v1/deposit/pending` | List pending deposits |

### x402 Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/x402/verify` | Verify payment receipt |
| POST | `/x402/settle` | Settle payment |

---

## Available Models

Live catalog fetched from `GET /v1/models` (OpenAI-compatible) — returns the
full list with `inputPricePer1M`, `outputPricePer1M`, `capabilities`, and
`maxTokens`. The `app/src/lib/models-data.ts` module ships a small hand-picked
fallback for SSR metadata so layout descriptions and `MODEL_COUNT` work
without an async fetch.

- **Web UI:** [oma-ai.com/models](https://oma-ai.com/models)
- **API:** `GET https://api.oma-ai.com/v1/models`

### Model Tiers (representative)

| Tier | Examples | Price range (input / 1M tokens) |
|------|----------|-----------------------------------|
| **Frontier** | `claude-opus-4-1` | ~$3.00 – $6.00 |
| **Premium** | `gemini-2.5-pro`, `qwen3-coder-480b-a35b-instruct` | ~$1.00 – $3.60 |
| **Mid-Range** | `llama-3.3-70b`, `kimi-k2.6`, `mistral-31-24b` | ~$0.30 – $1.73 |
| **Budget** | `deepseek-v3.2-exp`, `llama-3.2-3b`, `glm-5.2-fp8` | ~$0.01 – $0.70 |

See `GET /v1/models` for the live, complete catalog and current pricing.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15, React 19 | Landing, dashboard, pages |
| Backend | Hono.js, Node.js 22 | API server |
| Database | PostgreSQL (Drizzle ORM) | Users, credits, deposits |
| Cache | Redis | Rate limiting, sessions |
| Blockchain | Base (EVM), Solana | Deposits, staking |

---

## Cost to Run

| Service | Free Tier | Production |
|---------|-----------|------------|
| Neon PostgreSQL | 0.5GB | ~$10/mo |
| Upstash Redis | 10K ops/day | ~$10/mo |
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