# OMA AI Gateway

**Website:** https://oma-ai.com  
**Version:** 2.0.0  
**Status:** Production Ready

Self-hosted AI inference gateway with wallet-based auth (zero KYC), multi-provider routing, cross-chain deposits, and native crypto payments.

---

## Features

### Payment Methods
- **USDC on Base** - Direct deposit, instant crediting
- **Solana SOL** - Cross-chain via Jupiter swap
- **20+ Chains** - Any token via HoudiniSwap
- **x402 Payments** - On-demand payment receipts for AI agents

### Developer Features
- **OpenAI-Compatible API** - Drop-in replacement, just change base URL
- **Streaming Support** - Real-time responses
- **Rate Limiting** - Per-key and per-model limits
- **API Key Management** - Create, revoke, track usage

---

## Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/your-org/oma
cd oma

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
./start-dev.sh

# Or manually:
cd app && npm run dev   # Frontend :3000
cd server && npm run dev # Backend :3001
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
│                   Next.js Frontend (:3000)                  │
│    Landing │ Dashboard │ Pricing │ Playground │ Docs        │
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
    │ (Rate    │   │  AntSeed │   │  Swap   │   │(Base)   │
    │ Limits) │   │  LiteLLM │   │  CCTP   │   │         │
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

### Frontier Models
| Model | Provider | Input | Output | Context |
|-------|----------|-------|--------|---------|
| claude-opus-4-7 | Venice | $15.00 | $75.00 | 200K |
| gpt-5.5 | Venice | $10.00 | $30.00 | 128K |
| o3 | Venice | $10.00 | $40.00 | 200K |

### Premium Models (Mid-tier)
| Model | Provider | Input | Output | Context |
|-------|----------|-------|--------|---------|
| claude-sonnet-4-6 | Venice | $3.00 | $15.00 | 200K |
| gpt-4o | Venice | $2.50 | $10.00 | 128K |
| deepseek-v4-pro | AntSeed | $0.18 | $1.00 | 128K |
| llama-3.3-70b | Both | $0.30 | $0.48 | 128K |

### Budget (Fast/Cheap)
| Model | Provider | Input | Output | Context |
|-------|----------|-------|--------|---------|
| deepseek-v4-flash | AntSeed | $0.05 | $0.19 | 128K |
| qwen3-8b | AntSeed | $0.01 | $0.01 | 32K |
| gemini-2.5-flash | Venice | $0.15 | $0.60 | 1M |

### Video Models
| Model | Provider | Price | Duration |
|-------|----------|-------|----------|
| seedance-2-0-text-to-video | Venice | $0.90 | 5s |
| kling-v3-pro-text-to-video | Venice | $0.92 | 5s |
| grok-imagine-text-to-video | Venice | $0.85 | 5s |

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

| Document | Description |
|----------|-------------|
| [DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) | Full technical guide |
| [docs/OMA-X402-CROSSCHAIN-ARCHITECTURE.md](docs/OMA-X402-CROSSCHAIN-ARCHITECTURE.md) | x402 payment flow |
| [AGENTS.md](AGENTS.md) | Dev operations & commands |

---

*Permissionless inference. Pay with crypto. No account required.*