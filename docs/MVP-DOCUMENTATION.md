# OMA AI Gateway - MVP Documentation

**Version:** 2.0.0  
**Status:** Current Production Build  
**Updated:** 2026-05-22

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Features](#2-core-features)
3. [How It Works](#3-how-it-works)
4. [Frontend Pages](#4-frontend-pages)
5. [API Endpoints](#5-api-endpoints)
6. [Architecture](#6-architecture)
7. [Deployment](#7-deployment)

---

## 1. Overview

OMA (Open Model Access) AI Gateway is a production-ready AI inference service that provides:

- **Unified API access** to 50+ AI models via OpenAI-compatible endpoints
- **Multi-provider routing** with automatic failover (Venice AI + AntSeed P2P)
- **Crypto-native payments** with credit-based billing
- **Cross-chain deposits** from 100+ cryptocurrencies via HoudiniSwap
- **x402 protocol support** for gasless, per-request payments
- **OMA token staking** for discount tiers

---

## 2. Core Features

### 2.1 AI Inference

| Feature | Description |
|---------|-------------|
| **Chat Completions** | OpenAI-compatible `/v1/chat/completions` endpoint with streaming |
| **Model Catalog** | 50+ models across Frontier, Premium, Mid, and Budget tiers |
| **Provider Routing** | Automatic failover between Venice AI and AntSeed P2P |
| **Circuit Breaker** | Prevents cascading failures when providers are down |
| **Rate Limiting** | Redis-backed rate limits per API key |

### 2.2 AI Capabilities

| Feature | Description |
|---------|-------------|
| **Text Completion** | `/v1/completions` legacy endpoint |
| **Embeddings** | `/v1/embeddings` for vector generation |
| **Image Generation** | SDXL, Flux, Stable Diffusion via Venice AI |
| **Video Generation** | Seedance 2.0, Kling V3 Pro, Grok Imagine |
| **Text-to-Speech** | TTS via `/v1/audio/speech` |

### 2.3 Payments

| Feature | Description |
|---------|-------------|
| **USDC Deposits** | Direct Base/Solana transfers, instant 1:1 credits |
| **OMA Token Deposits** | +5% bonus, TWAP oracle pricing |
| **HoudiniSwap** | Cross-chain from 100+ tokens |
| **x402 Pay-Per-Request** | Gasless payments on Base/Solana |
| **Staking Discounts** | 3-15% discounts based on OMA staked |

---

## 3. How It Works

### 3.1 Authentication Flow

```
1. User connects wallet (EVM via MetaMask/WalletConnect or Solana via Phantom)
2. Server generates SIWE nonce, stores in Redis (5 min expiry)
3. User signs EIP-4361 message with wallet
4. Server verifies signature, returns JWT session token
5. User can generate API keys from dashboard
```

### 3.2 Inference Request Flow

```
1. Client sends request to /v1/chat/completions with API key
2. Server validates API key (SHA-256 hash lookup)
3. Check credit balance >= estimated cost
4. Route to primary provider (Venice AI)
5. If Venice fails, circuit breaker activates, route to AntSeed
6. Stream response to client
7. Deduct credits based on actual token usage
8. Log usage record for dashboard
```

### 3.3 Deposit Flow

```
USDC Direct:
User -> Base/Solana transfer -> Treasury wallet -> Webhook confirms -> Credits issued

OMA Token:
User -> Approve OMA token -> Call depositOma() -> Contract receives -> TWAP oracle rate -> Credits with 5% bonus

HoudiniSwap:
User -> Select token -> Create exchange order -> HoudiniSwap deposit address
     -> User sends tokens -> Houdini converts to USDC on Base
     -> Webhook confirms settlement -> Credits issued
```

---

## 4. Frontend Pages

### 4.1 Landing Page (`/`)

**Components:**
- Hero section with CTA
- How It Works explanation
- Model Highlights showcase
- Pricing & Payments overview
- For Developers section
- Footer with links

**Purpose:** Marketing and user acquisition

### 4.2 Dashboard (`/dashboard`)

**Features:**
- Credit balance display
- API key management (create, revoke, copy)
- Usage history table with pagination
- Quick stats (today's calls, costs)
- Connect wallet prompt for unauthenticated users

**Access:** Requires wallet connection

### 4.3 Deposit (`/deposit`)

**Features:**
- Coin selector (USDC, ETH, SOL, OMA, BTC, XMR, etc.)
- Amount input with USD conversion
- Auto-detect routing (Direct USDC, OMA staking, HoudiniSwap)
- Transaction processing with wallet prompts
- x402 payment link generation

**Access:** Requires wallet connection

### 4.4 Pricing (`/pricing`)

**Features:**
- Payment method cards (USDC, HoudiniSwap, x402)
- Model pricing table with filtering by category
- FAQ accordion
- Credits & billing info

### 4.5 Models (`/models`)

**Features:**
- 50+ model cards with pricing
- Category filters (Budget, Mid, Premium, Frontier, Coding, Reasoning, Uncensored)
- Search functionality
- Provider badges (Venice, AntSeed, Both)
- Privacy/P2P indicators

### 4.6 Playground (`/playground`)

**Features:**
- Real-time chat interface
- Model selector dropdown
- Settings sidebar (API key, temperature, max tokens, TTS voice)
- Markdown rendering with code syntax highlighting
- Text-to-speech for assistant responses
- Streaming response support
- Clear conversation

**Access:** Can use with or without API key

### 4.7 Docs (`/docs`)

**Sections:**
- Quick Start
- Authentication
- Chat Completions
- Completions
- Models
- Embeddings
- Image Generation
- Video Generation
- Audio/Speech
- Payments
- Error Codes
- x402 Protocol

### 4.8 Image Generation (`/image-generation`)

**Features:**
- Prompt input
- Model selector (SDXL, Flux, etc.)
- Size options (512x512, 1024x1024, etc.)
- Count selector (1-4)
- Results gallery with download

### 4.9 Video Generation (`/video-generation`)

**Features:**
- Text-to-Video / Image-to-Video modes
- Model selector (Seedance, Kling, Grok)
- Aspect ratio, duration, resolution
- File upload for image-to-video
- Async polling for completion
- Video player with download

### 4.10 Crypto Payments (`/crypto-payments`)

**Features:**
- Payment feature overview
- x402 protocol explanation
- Supported tokens list
- Wallet compatibility
- How it works steps
- Payment link integration

### 4.11 Settings (`/settings`)

**Features:**
- API key management
- Wallet linking
- Account deletion

### 4.12 Compare Pages

- `/compare/openrouter-alternative` - OMA vs OpenRouter
- `/compare/venice-ai-alternative` - OMA vs Venice Direct
- `/compare/cheaptokens-alternative` - OMA vs Price Arbitrage

### 4.13 Utility Pages

- `/private-ai-api` - Privacy-focused AI API marketing
- `/use-cases/ai-agents` - AI agents use case
- `/use-cases/apps` - Application use cases
- `/use-cases/chatbots` - Chatbot use cases
- `/swap` - Token swap (placeholder)
- `/privacy` - Privacy policy
- `/terms` - Terms of service

---

## 5. API Endpoints

### 5.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/nonce` | Get SIWE nonce for wallet |
| POST | `/auth/verify` | Verify SIWE signature |
| POST | `/auth/wallet` | Link wallet to session |
| POST | `/auth/logout` | End session |
| GET | `/user` | Get current user |

### 5.2 API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/keys` | List API keys |
| POST | `/keys` | Create new API key |
| DELETE | `/keys/:id` | Revoke API key |

### 5.3 Inference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Chat completions (streaming) |
| POST | `/v1/completions` | Legacy text completions |
| GET | `/v1/models` | List available models |
| POST | `/v1/embeddings` | Generate embeddings |
| POST | `/v1/images/generations` | Generate images |
| POST | `/v1/videos/generations` | Submit video job |
| GET | `/v1/videos/retrieve` | Poll video status |
| POST | `/v1/audio/speech` | Text-to-speech |

### 5.4 Credits & Balance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/balance` | Get credit balance |
| GET | `/v1/usage` | Get usage history |

### 5.5 Deposits

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/deposit/usdc` | Report USDC deposit |
| POST | `/v1/deposit/oma` | Report OMA token deposit |
| POST | `/v1/deposit/houdini` | Initiate HoudiniSwap |
| GET | `/v1/deposit/status/:id` | Check deposit status |
| GET | `/v1/deposit/pending` | List pending deposits |
| GET | `/v1/deposit/houdini/tokens` | Supported Houdini tokens |
| POST | `/v1/deposit/houdini/exchange` | Execute Houdini swap |

### 5.6 Staking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/stake/info` | Get staking info |
| POST | `/v1/stake` | Stake OMA tokens |
| POST | `/v1/unstake` | Initiate unstaking |
| POST | `/v1/stake/withdraw` | Withdraw after cooldown |

### 5.7 x402

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/x402/verify` | Verify payment receipt |
| POST | `/x402/settle` | Settle payment |
| POST | `/v1/x402/quote` | Get payment quote |
| POST | `/v1/x402/deposit` | Create x402 deposit |
| GET | `/v1/x402/deposit/:id/status` | Check x402 status |

### 5.8 Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/pricing/crypto` | Crypto pricing info |

---

## 6. Architecture

### 6.1 Frontend (Next.js)

```
oma/app/
├── src/
│   ├── app/              # Pages (App Router)
│   │   ├── page.tsx      # Landing
│   │   ├── dashboard/   # User dashboard
│   │   ├── deposit/     # Deposit page
│   │   ├── pricing/     # Pricing page
│   │   ├── models/      # Model catalog
│   │   ├── playground/  # Chat playground
│   │   ├── docs/        # API documentation
│   │   ├── image-generation/
│   │   ├── video-generation/
│   │   ├── crypto-payments/
│   │   └── ...
│   ├── components/       # Reusable components
│   │   ├── landing/    # Landing page sections
│   │   ├── ui/         # UI primitives
│   │   ├── chat/       # Chat components
│   │   ├── navbar.tsx
│   │   ├── footer.tsx
│   │   └── wallet-provider.tsx
│   └── lib/             # Utilities
│       ├── api.ts       # API client
│       ├── wagmi.ts     # Wallet config
│       └── prices.ts    # Crypto prices
```

### 6.2 Backend (Hono.js)

```
oma/server/
├── src/
│   ├── routes/          # API endpoints
│   │   ├── auth.ts      # Authentication
│   │   ├── chat.ts      # Inference
│   │   ├── models.ts    # Model listing
│   │   ├── deposit.ts   # Deposits
│   │   ├── stake.ts      # Staking
│   │   └── onramp.ts    # Fiat onramp
│   ├── inference/      # AI provider routing
│   │   ├── router.ts    # Circuit breaker
│   │   ├── venice.ts    # Venice AI
│   │   ├── antseed.ts   # AntSeed backup
│   │   ├── litellm.ts   # LiteLLM
│   │   └── models.ts    # Model catalog
│   ├── credits/        # Credit system
│   ├── x402/           # Payment facilitator
│   ├── auth/           # SIWE implementation
│   ├── db/             # Drizzle ORM
│   └── middleware/     # Rate limiting, security
```

### 6.3 Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL (Neon) | Users, keys, credits, deposits |
| Cache | Redis (Upstash) | Rate limiting, sessions, nonces |
| Blockchain | Base (primary), Solana (secondary) | Deposits, staking |
| CDN | Cloudflare | Static assets, edge caching |

---

## 7. Deployment

### 7.1 Environment Variables

**Server (.env):**
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
VENICE_API_KEY=...
PORT=3001
CORS_ORIGIN=https://oma-ai.com
REDIS_URL=redis://...
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=https://api.oma-ai.com
NEXT_PUBLIC_APP_URL=https://oma-ai.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

### 7.2 Docker Compose

```bash
cd oma
docker-compose up -d
```

### 7.3 Coolify Deployment

1. Create project in Coolify
2. Add `server/` as API application (port 3001)
3. Add `app/` as Frontend application (port 3000)
4. Configure environment variables
5. Deploy

---

## Quick Reference

### Development
```bash
cd oma/app && npm run dev    # Frontend on :3000
cd oma/server && npm run dev  # Backend on :3001
```

### Health Check
```bash
curl https://api.oma-ai.com/health
```

### Test Inference
```bash
curl -X POST https://api.oma-ai.com/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'
```

---

*Built with modern developer tools.*