# OMA AI Gateway

**Version:** 1.0.0  
**Domain:** oma-ai.com  
**Status:** MVP Complete - Ready for Deployment

Self-hosted AI inference gateway with wallet-based auth (zero KYC), multi-provider routing, cross-chain deposits, and x402 payment support.

---

## What's Built

### Backend (Hono.js - Port 3001)
- `POST /auth/nonce` - SIWE nonce for wallet auth
- `POST /auth/wallet` - Sign message, get API key (zero KYC)
- `POST /v1/chat/completions` - OpenAI-compatible AI inference
- `GET /v1/models` - 50+ available models
- `POST /x402/verify` - x402 payment verification
- `GET /health` - Health check

### Frontend (Next.js 15 - Port 3000)
- Landing page with wallet connect
- API key generation (sign wallet)
- Model showcase and pricing
- Deposit pages (USDC, SOL, cross-chain)
- Staking interface

### Smart Contracts (Base)
- `OMA.sol` - OMA token (ERC20)
- `xOMA.sol` - Staked OMA (veOMA-like)
- `OMADeposit.sol` - Deposit vault

---

## Quick Start

### Local Development

```bash
# 1. Copy env files
cp server/.env.example server/.env
cp app/.env.example app/.env.local

# 2. Edit server/.env:
#    - DATABASE_URL (Neon PostgreSQL)
#    - VENICE_API_KEY
#    - JWT_SECRET (40+ chars)

# 3. Start
cd oma
./start-dev.sh
```

### Production Deployment

See [deploy/deployment-guide.md](deploy/deployment-guide.md) for full deployment guide.

```bash
# 1. Create Neon database: https://neon.tech
# 2. Get Venice API key: https://venice.ai/api
# 3. Deploy via Coolify (see DEPLOYMENT.md)
```

---

## Auth Flow (Zero KYC)

```
Connect Wallet (MetaMask/Coinbase/WalletConnect)
    │
    ▼
Sign SIWE message
    │
    ▼
Get API key (oma_sk_xxx)
    │
    ▼
Use for AI inference
```

---

## Key Files

| File | Description |
|------|-------------|
| [docs/OMA-ARCHITECTURE.md](docs/OMA-ARCHITECTURE.md) | System design and components |
| [deploy/deployment-guide.md](deploy/deployment-guide.md) | Deployment guide (Coolify, Neon) |
| [docs/OMA-PHASE-2-PLAN.md](docs/OMA-PHASE-2-PLAN.md) | Future features (staking, CCTP) |

---

## Implemented Features

- [x] SIWE wallet auth (zero KYC)
- [x] Multi-provider AI inference (Venice AI, LiLii AI)
- [x] Credit-based billing with prepaid deposits
- [x] USDC deposits on Base chain
- [x] SOL deposits on Solana
- [x] Cross-chain deposits via HoudiniSwap (20+ chains)
- [x] x402 direct payment verification
- [x] x402 payment facilitation (mock + live modes)
- [x] Cross-chain x402 swaps via HoudiniSwap
- [x] Fiat on-ramp (webhook-based)
- [x] Rate limiting (per-key + per-IP)
- [x] Circuit breaker pattern for provider failover
- [x] 50+ AI models available
- [x] OpenAI-compatible API (/v1/chat/completions)

### In Progress / Future

- [ ] OMA Token Staking (xOMA)
- [ ] CCTP integration (Circle native USDC bridging)
- [ ] WebSocket subscriptions for real-time settlement
- [ ] Analytics dashboard

---

## Cost

| Service | Tier | Monthly |
|---------|------|---------|
| PostgreSQL (Neon/local) | Free tier / Docker | $0 |
| Redis (Upstash/local) | Free tier / Docker | $0 |
| Coolify (self-hosted) | $5-10/mo VPS | $5-10 |
| AI Inference (Venice AI) | Pay-per-token | ~$1-5 |
| Domain | $12/yr | ~$1 |
| **Total** | | **$6-16/mo** |

---

## Tech Stack

- Backend: Hono.js (Node.js 22, TypeScript) on port 3001
- Frontend: Next.js 15 (App Router, React 19) on port 3000
- Database: PostgreSQL via Drizzle ORM
- Cache: Redis (rate limiting, sessions, job queues)
- Blockchain: Base (primary EVM), Solana (secondary)
- Auth: SIWE (Sign-In With Ethereum)
- AI: Venice AI (primary), LiLii AI (secondary)
- Cross-chain: HoudiniSwap API, LI.FI SDK

---

## Support

- Docs: https://oma-ai.com/docs
- x402: https://x402.org
- Base: https://docs.base.org
- HoudiniSwap: https://houdiniswap.com

---

*Self-host for full control. Zero KYC. AI-native payments.*