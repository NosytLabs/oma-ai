# OMA Architecture

**Version:** 1.0.0  
**Status:** MVP Complete  
**Domain:** oma-ai.com

---

## Overview

OMA is a self-hosted AI inference gateway with wallet-based auth (zero KYC), multi-provider routing, cross-chain deposits, and x402 payment support.

**Stack:**
- Backend: Hono.js (Node.js 22, TypeScript)
- Frontend: Next.js 15 (App Router)
- Database: PostgreSQL (Neon)
- Cache: Redis (Upstash)
- Blockchain: Base (primary), Solana (secondary)
- Auth: SIWE (Sign-In With Ethereum)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OMA AI Gateway                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│   │   Next.js  │     │   Hono API  │     │  Multi-Provider Router  │  │
│   │   Frontend │────▶│   Server    │────▶│  - Venice AI (primary)  │  │
│   │   :3000    │     │   :3001     │     │  - AntSeed (backup)    │  │
│   └─────────────┘     └──────┬──────┘     └─────────────────────────┘  │
│                              │                                          │
│         ┌────────────────────┼────────────────────┐                     │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│   ┌──────────┐       ┌──────────────┐      ┌──────────────┐             │
│   │  SIWE    │       │   Credits   │      │  x402        │             │
│   │  Auth    │       │   System    │      │  Facilitator │             │
│   └──────────┘       └──────┬──────┘      └──────┬───────┘             │
│                              │                    │                      │
└──────────────────────────────┼────────────────────┼──────────────────────┘
                               │                    │
         ┌─────────────────────┴┐                  │
         ▼                      ▼                  ▼
┌─────────────────┐   ┌─────────────────┐  ┌─────────────────────┐
│  PostgreSQL      │   │  Redis          │  │  Cross-Chain        │
│  (Neon)          │   │  (Upstash)      │  │  Deposits           │
│  - api_keys      │   │  - rate limits  │  │  - HoudiniSwap      │
│  - users         │   │  - nonce cache  │  │  - CCTP (USDC)      │
│  - credits       │   │  - sessions     │  │                     │
│  - deposits      │   │                 │  └─────────────────────┘
└─────────────────┘   └─────────────────┘
```

---

## Core Components

### Backend (Hono.js Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/nonce` | POST | Get SIWE nonce for wallet auth |
| `/auth/wallet` | POST | Sign message, get API key (zero KYC) |
| `/v1/chat/completions` | POST | OpenAI-compatible AI inference |
| `/v1/models` | GET | List 50+ available models |
| `/v1/deposit/*` | POST/GET | Deposit endpoints (USDC, SOL, cross-chain) |
| `/x402/verify` | POST | x402 payment verification |
| `/health` | GET | Health check |

### Frontend (Next.js 15)

| Page | Description |
|------|-------------|
| `/` | Landing page with wallet connect |
| `/dashboard` | User dashboard (API key, usage) |
| `/deposit` | Deposit USDC, SOL, or cross-chain |
| `/stake` | OMA token staking |
| `/models` | Model pricing & info |
| `/playground` | Interactive API playground |
| `/settings` | API key management |

---

## Provider Routing

### Circuit Breaker Pattern

```
Request ──▶ Venice AI ──▶ Success ──▶ Response
              │
              ▼ Fail (>3x in 5min)
         Circuit OPEN ──▶ AntSeed ──▶ Response
              │
              ▼ Fail
         Circuit HALF-OPEN ──▶ Try Venice again
```

### Provider Selection

1. **Venice AI** (primary): 50+ models, competitive pricing
2. **AntSeed** (backup): Local proxy, requires local setup

---

## Payment Flows

### Flow 1: Credit-Based (Default)

```
1. User deposits crypto via HoudiniSwap
2. OMA credits account with USDC equivalent
3. User calls inference with API key
4. Credits deducted per token consumed
```

### Flow 2: x402 Direct (Agent-Native)

```
1. Agent requests quote: POST /v1/x402/quote
2. OMA returns: total cost + deposit address
3. Agent sends tokens to deposit address
4. OMA verifies settlement, generates x402 receipt
5. Agent calls inference with receipt
```

### Flow 3: Cross-Chain via HoudiniSwap

```
User (any chain) ──▶ HoudiniSwap ──▶ OMA ──▶ USDC on Base/Solana ──▶ Credits
                     Supports: BTC, ETH, SOL, TRX, BNB, XMR, 20+ chains
```

---

## Smart Contracts

| Contract | Chain | Purpose |
|----------|-------|---------|
| `OMA.sol` | Base | OMA token (ERC20) |
| `xOMA.sol` | Base | Staked OMA (veOMA-like) |
| `OMADeposit.sol` | Base | Deposit vault for staking |

---

## Security

### Auth (SIWE)
- Zero KYC: wallet signature only
- Nonce-based replay protection
- 5-minute nonce expiry

### API Security
- Rate limiting per API key
- Spend limits configurable
- HMAC-SHA256 webhook verification

### Infrastructure
- JWT_SECRET required (40+ chars)
- PostgreSQL SSL connections
- FACILITATOR_MODE for x402

---

## Cost Structure

| Component | Service | Monthly Cost |
|-----------|---------|---------------|
| Database | Neon PostgreSQL (Free) | $0 |
| Cache | Upstash Redis (Free) | $0 |
| Hosting | Self-hosted (Coolify) | $5-10 |
| Domain | .com | ~$1/mo |
| **Total** | | **$6-11/mo** |

---

## Phase 2 Features (Status)

- [x] OMA Token Staking (partially implemented - contracts ready)
- [x] Coin deposits (USDC direct, SOL) - IMPLEMENTED
- [x] CCTP for native USDC bridging - IMPLEMENTED
- [x] HoudiniSwap integration - IMPLEMENTED
- [x] x402 payment receipts - IMPLEMENTED
- [ ] WebSocket notifications - PENDING

---

## File Structure

```
oma/
├── server/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── x402/            # Payment facilitator
│   │   ├── credits/         # Credit system
│   │   ├── inference/       # AI providers
│   │   ├── auth/            # SIWE auth
│   │   └── db/              # Database schema
│   ├── Dockerfile
│   └── .env.example
├── app/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   ├── components/      # React components
│   │   └── lib/             # Utilities
│   ├── Dockerfile
│   └── .env.example
├── contracts/               # Smart contracts
├── deploy/coolify/          # Deployment configs
└── oma/
    ├── README.md            # Main docs
    ├── DEPLOYMENT.md       # Deployment guide
    ├── ARCHITECTURE.md     # This file
    └── PHASE-2-PLAN.md     # Future features
```

---

*Built with Hono.js, Next.js 15, wagmi, SIWE, Venice AI, Neon PostgreSQL*