# OMA AI Gateway - Solo Developer Guide

**Version:** 1.1.0
**Domain:** oma-ai.com
**Status:** Complete - Production Ready

A comprehensive guide for solo developers deploying and maintaining the OMA AI Gateway stack.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Quick Start](#2-quick-start)
3. [Architecture Overview](#3-architecture-overview)
4. [All Environment Variables](#4-all-environment-variables)
5. [Development Workflow](#5-development-workflow)
6. [How AI Inference Works](#6-how-ai-inference-works)
7. [How Payments Work](#7-how-payments-work)
8. [How to Add New Models](#8-how-to-add-new-models)
9. [How to Add New Providers](#9-how-to-add-new-providers)
10. [Deployment](#10-deployment)
11. [Troubleshooting](#11-troubleshooting)
12. [How to Make It a Real SaaS](#12-how-to-make-it-a-real-saas)
13. [Documentation Cleanup](#13-documentation-cleanup)

---

## 1. What This Project Is

OMA is a self-hosted AI inference gateway that lets you:

- **Serve 50+ AI models** via OpenAI-compatible API (`/v1/chat/completions`)
- **Authenticate users with crypto wallets** (zero KYC, SIWE sign-in)
- **Route requests across multiple providers** (Venice AI primary, AntSeed backup)
- **Accept crypto deposits** from 20+ chains via HoudiniSwap
- **Process x402 payments** for agent-native billing
- **Offer OMA token staking** for discount tiers

### Why OMA Exists

Most AI gateways require username/password or KYC. OMA lets users connect with their Ethereum wallet - no account creation, no identity verification. Perfect for:

- Developers building AI-powered dapps
- Autonomous agents that need programmatic API access
- Privacy-conscious users who don't want another account
- Web3-native applications that already have wallet integration

### The Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 (React 19, App Router) | Landing, dashboard, deposits |
| Backend | Hono.js (Node.js 22, TypeScript) | API server, auth, inference routing |
| Database | PostgreSQL (Neon) | Users, API keys, credits, deposits |
| Cache | Redis (Upstash) | Rate limiting, sessions, nonces |
| Blockchain | Base (primary), Solana (secondary) | Deposits, staking, payments |

### Key Features

| Feature | Description |
|---------|-------------|
| **OpenAI-compatible API** | Drop-in replacement for OpenAI, easy migration |
| **Multi-provider routing** | Automatic failover with circuit breakers |
| **Credits system** | Prepaid credit balance, deducted per token |
| **x402 payments** | On-demand payment receipts for agents |
| **Cross-chain deposits** | USDC on Base, SOL on Solana, 20+ chains via HoudiniSwap |
| **Staking discounts** | Up to 15% discount for OMA token holders |

---

## 2. Quick Start

### Prerequisites

| Service | Free Tier | Sign Up |
|---------|-----------|---------|
| Neon PostgreSQL | 0.5GB | https://neon.tech |
| Upstash Redis | 10K ops/day | https://upstash.com |
| Venice AI API | Free tier available | https://venice.ai/api |
| Coolify | Self-hosted | https://coolify.io |

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/oma
cd oma
```

### Step 2: Setup Environment Files

```bash
# Server (backend API)
cp server/.env.example server/.env

# Frontend (Next.js)
cp app/.env.example app/.env.local
```

### Step 3: Configure Server .env

```env
# Required
DATABASE_URL=postgresql://user:pass@ep-xxx-xxx-123456.neon.tech/oma
JWT_SECRET=your-super-secret-key-minimum-40-characters-here
VENICE_API_KEY=sk-your-venice-api-key

# Server Config
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# x402 (mock for dev, live for production)
FACILITATOR_MODE=mock

# Optional (for production)
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
```

### Step 4: Configure Frontend .env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_BASE_TREASURY=0xYourTreasuryAddress
```

### Step 5: Start Development

```bash
# From the oma root directory
./start-dev.sh

# Or manually:
cd app && npm run dev &   # Frontend on :3000
cd server && npm run dev   # Backend on :3001
```

### Step 6: Verify Everything Works

```bash
# Health check
curl http://localhost:3001/health
# Response: {"status":"ok"}

# Test auth (nonce endpoint)
curl -X POST http://localhost:3001/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f6fA21"}'
# Response: {"nonce":"..."}

# Get API key (after signing with wallet in frontend UI)
# Then test inference
curl http://localhost:3001/v1/models \
  -H "Authorization: Bearer oma_sk_your_key"
```

### Directory Structure

```
oma/
├── server/                    # Hono.js API server
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   │   ├── auth.ts       # SIWE authentication
│   │   │   ├── chat.ts       # Inference endpoint
│   │   │   ├── deposit.ts    # All deposit methods
│   │   │   └── staking.ts    # OMA staking
│   │   ├── inference/        # AI provider routing
│   │   │   ├── router.ts     # Circuit breaker + failover
│   │   │   ├── venice.ts     # Venice AI integration
│   │   │   ├── antseed.ts    # AntSeed backup
│   │   │   └── models.ts     # Model catalog + pricing
│   │   ├── credits/          # Credit system
│   │   ├── x402/             # Payment facilitator
│   │   ├── auth/             # SIWE implementation
│   │   └── db/               # Drizzle schema
│   ├── Dockerfile
│   └── .env.example
├── app/                      # Next.js frontend
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── page.tsx      # Landing
│   │   │   ├── dashboard/    # User dashboard
│   │   │   ├── deposit/      # Deposit page
│   │   │   └── stake/        # Staking page
│   │   ├── components/       # React components
│   │   └── lib/              # Utilities
│   ├── Dockerfile
│   └── .env.example
├── contracts/                # Solidity contracts
│   ├── OMA.sol              # OMA token
│   ├── xOMA.sol             # Staking vault
│   └── OMADeposit.sol      # Deposit vault
├── deploy/coolify/          # Coolify configs
└── docs/                    # Documentation
```

---

## 3. Architecture Overview

### High-Level Architecture

```
                                    ┌─────────────────────────────┐
                                    │          Users              │
                                    └──────────────┬──────────────┘
                                                   │ Wallet Connect / API Key
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              OMA AI Gateway                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐  │
│   │   Next.js  │     │   Hono API  │     │   Multi-Provider Router      │  │
│   │   Frontend │────▶│   Server    │────▶│   - Venice AI (primary)      │  │
│   │   :3000    │     │   :3001     │     │   - AntSeed (backup)         │  │
│   └─────────────┘     └──────┬──────┘     └─────────────────────────────┘  │
│                              │                                           │
│         ┌────────────────────┼────────────────────┐                       │
│         │                    │                    │                       │
│         ▼                    ▼                    ▼                       │
│   ┌──────────┐       ┌──────────────┐      ┌──────────────┐             │
│   │   SIWE    │       │   Credits    │      │   x402        │             │
│   │   Auth    │       │   System     │      │   Facilitator│             │
│   └──────────┘       └──────┬──────┘      └──────┬───────┘             │
│                             │                    │                       │
└──────────────────────────────┼────────────────────┼───────────────────────┘
                               │                    │
       ┌───────────────────────┴┐                  │
       ▼                          ▼                  ▼
┌─────────────────┐   ┌─────────────────┐  ┌─────────────────────┐
│  PostgreSQL     │   │  Redis          │  │  Cross-Chain        │
│  (Neon)         │   │  (Upstash)      │  │  Deposits           │
│  - users        │   │  - rate limits  │  │  - HoudiniSwap      │
│  - api_keys     │   │  - sessions     │  │  - CCTP             │
│  - credits      │   │  - nonces       │  │  - LI.FI            │
│  - deposits     │   │                 │  └─────────────────────┘
│  - staking      │   └─────────────────┘
└─────────────────┘
```

### Component Responsibilities

| Component | Location | Purpose |
|-----------|----------|---------|
| **Frontend** | `app/` | Next.js UI: landing, dashboard, deposit pages, wallet connect |
| **Backend API** | `server/` | Hono.js: auth, inference routing, credits, deposits |
| **Database** | PostgreSQL via Drizzle | Users, API keys, credits, deposits, staking tiers |
| **Cache** | Redis | Rate limiting, session nonces, job queues |
| **Smart Contracts** | `contracts/` | OMA.sol, xOMA.sol, OMADeposit.sol on Base |

### Request Flow

1. **Authentication**
   - User connects wallet (WalletConnect or direct)
   - Server generates SIWE nonce, stores in Redis (5 min expiry)
   - User signs message with wallet
   - Server verifies signature, returns JWT + API key

2. **Inference Request**
   - Client sends request to `/v1/chat/completions` with API key
   - Server validates API key, checks credit balance
   - Router selects provider (Venice primary, AntSeed backup)
   - Provider returns response (streamed or JSON)
   - Credits deducted based on token usage

3. **Deposit Flow**
   - User selects deposit method (USDC, SOL, cross-chain)
   - Server creates deposit order, returns address/quote
   - User sends crypto to specified address
   - Webhook/confirmation received, credits issued

---

## 4. All Environment Variables

### Complete Environment Variables Reference

#### Server (`.env`)

```env
# ===================
# REQUIRED
# ===================

# PostgreSQL - Neon (or local)
# Format: postgresql://user:password@host:5432/database
DATABASE_URL=postgresql://user:pass@ep-xxx-xxx-123456.neon.tech/oma

# JWT Secret - minimum 40 characters
# Generate with: openssl rand -base64 32
JWT_SECRET=your-super-secret-key-minimum-40-characters-here

# Venice AI API Key - get from https://venice.ai/api
VENICE_API_KEY=sk-your-venice-api-key

# ===================
# SERVER CONFIG
# ===================

PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# x402 Payment Mode: 'mock' for testing, 'live' for production
FACILITATOR_MODE=mock

# ===================
# REDIS (Optional)
# ===================

# Upstash Redis (or local via docker-compose)
# Format: redis://default:password@host:6379
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# ===================
# BLOCKCHAIN / PAYMENTS
# ===================

# Base mainnet RPC (public or private)
CHAIN_RPC_URL=https://mainnet.base.org

# Solana RPC (for SOL deposits)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# HoudiniSwap (for cross-chain deposits)
HOUDINI_API_KEY=your-houdini-api-key
HOUDINI_API_SECRET=your-houdini-api-secret
HOUDINI_PARTNER_ID=your-partner-id
HOUDINI_WEBHOOK_SECRET=your-webhook-secret
HOUDINI_ADDRESS_TO=0xYourTreasuryWallet

# CCTP (Circle Cross-Chain Transfer Protocol)
CCTP_CIRCLE_API_URL=https://iris-api.circle.com

# LI.FI (another cross-chain option)
LIFI_API_URL=https://li.quest/v1
LIFI_INTEGRATOR=oma-ai

# ===================
# SMART CONTRACTS
# ===================

# OMA Token on Base (when deployed)
OMA_TOKEN_ADDRESS=0x...
XOMA_TOKEN_ADDRESS=0x...

# USDC on Base (canonical)
USDC_TOKEN_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Treasury address for deposits
TREASURY_BASE_ADDRESS=0x...

# ===================
# ANTSEED BACKUP PROVIDER
# ===================

# AntSeed API endpoint (if using backup provider)
ANTSEED_API_URL=https://your-antseed-instance.com
ANTSEED_API_KEY=your-antseed-api-key
```

#### Frontend (`app/.env.local`)

```env
# API URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# WalletConnect Project ID - get from https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id

# Treasury address for deposits
NEXT_PUBLIC_BASE_TREASURY=0x...

# App name (for WalletConnect modal)
NEXT_PUBLIC_APP_NAME=OMA AI Gateway
```

### Production Checklist

- [ ] `JWT_SECRET` is strong (40+ random characters)
- [ ] `FACILITATOR_MODE=live` for production x402
- [ ] `CORS_ORIGIN` set to exact domain (no wildcards)
- [ ] HTTPS enabled (Let's Encrypt via Coolify/Caddy)
- [ ] Database SSL connections enabled
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` configured
- [ ] `REDIS_URL` set for rate limiting

---

## 5. Development Workflow

### Development Commands

#### Server (Backend)

```bash
cd server

# Start development with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck

# Database operations
npm run db:generate   # Generate Drizzle migrations
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema (no migration files)
npm run db:studio     # Open Drizzle Studio (DB browser)
```

#### Frontend

```bash
cd app

# Start development with hot reload
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

#### Docker (All-in-One)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api    # API logs only
docker-compose logs -f        # All logs

# Stop all services
docker-compose down

# Rebuild without cache
docker-compose build --no-cache
```

### Database Schema Management

The server uses Drizzle ORM with PostgreSQL. Schema files are in `server/src/db/schema/`.

```bash
# Generate migration after schema changes
cd server && npm run db:generate

# Apply migrations
cd server && npm run db:migrate

# Push schema directly (development only)
cd server && npm run db:push

# Open DB browser
cd server && npm run db:studio
```

### Key Files

| File | Purpose |
|------|---------|
| `server/src/routes/chat.ts` | Inference endpoint (main revenue) |
| `server/src/routes/deposit.ts` | All deposit methods |
| `server/src/routes/staking.ts` | OMA staking |
| `server/src/routes/auth.ts` | SIWE authentication |
| `server/src/inference/models.ts` | Model catalog and pricing |
| `server/src/inference/router.ts` | Provider routing and circuit breaker |
| `server/src/inference/venice.ts` | Venice AI API calls |
| `server/src/credits/balance.ts` | Credit checking and deduction |
| `server/src/x402/facilitator.ts` | x402 payment processing |
| `contracts/OMA.sol` | OMA token |
| `contracts/xOMA.sol` | Staking vault |

### Health Check

```bash
# Local
curl http://localhost:3001/health
# Response: {"status":"ok","version":"1.0.0","service":"oma-ai"}

# Production
curl https://api.your-domain.com/health
# Response: {"status":"ok","version":"1.0.0","service":"oma-ai"}
```

---

## 6. How AI Inference Works

### Overview

OMA routes AI inference requests through a multi-provider system with automatic failover. The primary provider is Venice AI, with AntSeed as a backup.

### Request Flow

```
Client Request
      │
      ▼
┌─────────────────┐
│ Validate API Key│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Credits   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Circuit Breaker │────▶│  Venice AI       │
│ Check           │     │  (Primary)       │
└────────┬────────┘     └────────┬─────────┘
         │                        │
         │              ┌─────────▼─────────┐
         │              │  Success?         │
         │              └─────────┬─────────┘
         │                        │
         │              ┌──────────┴──────────┐
         │              │                     │
         │         [Yes]│                [No]│
         │              ▼                     ▼
         │     ┌───────────────┐    ┌─────────────────┐
         │     │ Return        │    │ Circuit Open?   │
         │     │ Response      │    └────────┬────────┘
         │     └───────────────┘             │
         │                          ┌────────▼────────┐
         │                          │ Try AntSeed     │
         │                          │ (Backup)        │
         │                          └────────┬────────┘
         │                                   │
         │                          ┌────────▼────────┐
         │                          │ Return Response │
         │                          │ or Error        │
         │                          └─────────────────┘
```

### Venice API Integration

Venice AI is the primary provider offering 50+ models including:
- Claude (3.5 Sonnet, 3 Haiku)
- GPT (4o, 4o Mini, o1, o3)
- Gemini (2.0 Flash, 1.5 Pro)
- Grok (2, beta)
- DeepSeek (V3, R1)
- Llama (3.1, 3.2, 3.3)
- And many more

**Configuration:**
```env
VENICE_API_KEY=sk-your-venice-api-key
```

**How it works:**
1. Request comes into `/v1/chat/completions`
2. Server validates API key and credit balance
3. Server routes to Venice AI via `server/src/inference/venice.ts`
4. Venice returns response (streamed or JSON)
5. Server deducts credits based on token usage

### Circuit Breaker Pattern

The circuit breaker prevents cascading failures when a provider is down.

**States:**
- **CLOSED**: Normal operation, requests go to primary provider
- **OPEN**: Primary provider failing, requests go to backup
- **HALF-OPEN**: Testing if primary is back

**Configuration** (in `server/src/inference/circuit-breaker.ts`):
```typescript
{
  failureThreshold: 3,      // Open circuit after 3 failures
  resetTimeout: 300000,      // Try again after 5 minutes
  halfOpenRequests: 1         // Allow 1 test request
}
```

**Failure tracking:**
- Increment failure count on provider error
- Reset count on successful request
- Open circuit after threshold exceeded
- Attempt half-open after reset timeout

### Model Selection Logic

The router in `server/src/inference/router.ts`:

1. Check circuit breaker status for Venice
2. If Venice closed, route to Venice
3. If Venice open, route to AntSeed
4. Track failures for circuit breaker state

### Cost Calculation

Model pricing is defined in `server/src/inference/models.ts`:

```typescript
"claude-sonnet-4": {
  id: "claude-sonnet-4",
  veniceId: "claude-sonnet-4",
  provider: "venice",
  primaryProvider: "venice",
  inputPricePer1M: 3.0,      // $3 per 1M input tokens
  outputPricePer1M: 15.0,     // $15 per 1M output tokens
  markupPercent: 10,          // 10% markup for OMA
  category: "premium",
  maxTokens: 200000,
  supportsStreaming: true,
  displayName: "Claude Sonnet 4",
}
```

**Cost calculation:**
```typescript
const inputCost = (inputTokens / 1_000_000) * inputPricePer1M;
const outputCost = (outputTokens / 1_000_000) * outputPricePer1M;
const markup = (inputCost + outputCost) * (markupPercent / 100);
const total = inputCost + outputCost + markup;
```

### Streaming Responses

Streaming is supported for chat completions. The server:

1. Receives streaming response from Venice
2. Pipes chunks to client in real-time
3. Accumulates token counts
4. Deducts credits on completion

### Rate Limiting

Rate limits are enforced via Redis in `server/src/middleware/rate-limit.ts`:

| Tier | Requests/Min | Tokens/Hour |
|------|--------------|-------------|
| Free | 10 | 10K |
| Paid | 60 | 1M |

---

## 7. How Payments Work

### Overview

OMA supports three payment models:
1. **Credit-based (default)**: Pre-buy credits, deduct per token
2. **x402 direct**: Pay per request with on-chain verification
3. **Staking discounts**: OMA holders get up to 15% off

### Credit System

**Flow:**
```
1. User deposits crypto (USDC, SOL, cross-chain)
2. OMA credits account with equivalent balance
3. User calls inference with API key
4. Credits deducted per token consumed
```

**Credit deduction:**
```typescript
// In server/src/credits/balance.ts
async function deductCredits(userId: string, amount: number) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user.creditBalance < amount) {
    throw new Error('Insufficient credits');
  }
  await db.update(users)
    .set({ creditBalance: user.creditBalance - amount })
    .where(eq(users.id, userId));
}
```

### USDC Deposit (Base)

```
User sends USDC to OMA treasury address
         │
         ▼
Backend monitors Base USDC transfers (Transfer events)
         │
         ▼
On deposit: Credit user's account 1:1
         │
         ▼
User can call inference
```

**Implementation:**
- Monitor `Transfer` events on USDC contract
- Verify destination is treasury address
- Extract amount and user address from logs
- Credit account on confirmation

### SOL Deposit (Solana)

```
User sends SOL or USDC to Solana payee wallet
         │
         ▼
Backend monitors Solana blockchain
         │
         ▼
On transfer: Credit account (convert SOL to USDC equivalent)
         │
         ▼
User can call inference
```

### Cross-Chain via HoudiniSwap

HoudiniSwap supports deposits from 20+ chains:
- BTC, ETH, SOL, TRX, BNB, XMR
- ADA, DOT, AVAX, MATIC, and more

**Flow:**
```
User (any chain) ──▶ HoudiniSwap deposit address
                           │
                           ▼ (automatic swap to USDC on Base)
                     OMA webhook receives settlement
                           │
                           ▼
                     Credits issued to user's account
```

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/deposit/houdini/quote` | POST | Get swap quote |
| `/v1/deposit/houdini/exchange` | POST | Create deposit order |
| `/v1/deposit/houdini/status/:id` | GET | Check deposit status |
| `/v1/deposit/houdini/webhook` | POST | HoudiniSwap settlement webhook |

**Webhook verification:**
```typescript
// In server/src/routes/deposit.ts
function verifyHoudiniWebhook(payload: any, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', HOUDINI_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### x402 Payment Flow

x402 enables agent-native payments without pre-funded accounts.

**Flow:**
```
Agent requests quote (POST /v1/x402/quote)
         │
         ▼
OMA returns: total cost + deposit address
         │
         ▼
Agent sends tokens to deposit address
         │
         ▼
OMA verifies settlement (webhook or polling)
         │
         ▼
OMA generates x402 receipt
         │
         ▼
Agent calls inference with receipt
         │
         ▼
Inference streamed to agent
```

**Receipt format:**
```json
{
  "receipt": "oma_receipt_xxx",
  "txHash": "0x...",
  "amount": 1000000,
  "networkId": "base-mainnet",
  "payee": "0x...",
  "timestamp": 1716000000,
  "signature": "0x..."
}
```

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/x402/quote` | POST | Get payment quote |
| `/x402/verify` | POST | Verify payment receipt |
| `/v1/x402/proxy/chat/completions` | POST | Direct inference with receipt |

### OMA Token Staking

OMA token holders can stake for discounted API access.

**Discount tiers:**
| OMA Staked | Discount |
|------------|----------|
| 100+ | 1% |
| 1,000+ | 3% |
| 10,000+ | 6% |
| 100,000+ | 15% |

**Staking flow:**
1. User sends OMA to staking contract or treasury
2. User calls `/v1/stake` with tx hash
3. Server verifies on-chain transfer (in live mode)
4. Server updates staking position
5. Discount applied to future inference

**Unstaking flow:**
1. User calls `/v1/unstake`
2. 20-day cooldown period starts
3. After cooldown, user calls `/v1/stake/withdraw`
4. Server verifies cooldown expired
5. Server clears staking position

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/stake/info` | GET | Get staking position and discount |
| `/v1/stake` | POST | Stake OMA tokens |
| `/v1/unstake` | POST | Initiate unstaking cooldown |
| `/v1/stake/withdraw` | POST | Withdraw after cooldown |

---

## 8. How to Add New Models

### Step-by-Step Guide

#### Step 1: Get Venice Model ID

Find the model ID from Venice AI API documentation or by calling:

```bash
curl https://api.venice.ai/api/v1/models \
  -H "Authorization: Bearer sk-your-venice-api-key"
```

#### Step 2: Add Model to Catalog

Edit `server/src/inference/models.ts` and add entry to `MODEL_CATALOG`:

```typescript
// In server/src/inference/models.ts

export const MODEL_CATALOG: Record<string, Model> = {
  // ... existing models ...

  // Add new model
  "my-new-model": {
    id: "my-new-model",                    // Your internal ID
    veniceId: "venice-model-id",           // Must match Venice API exactly
    provider: "venice",                    // or "antseed"
    primaryProvider: "venice",             // Primary routing target
    inputPricePer1M: 1.0,                  // Base cost per 1M input tokens
    outputPricePer1M: 2.0,                 // Base cost per 1M output tokens
    markupPercent: 10,                     // Your markup percentage
    category: "mid",                       // budget/mid/premium/frontier
    maxTokens: 128000,                     // Context window size
    supportsStreaming: true,               // Does it support streaming?
    displayName: "My New Model",           // Display name in UI
    capabilities: ["chat", "coding"],      // What it's good for
    description: "Description for model catalog",  // For UI
  },
};
```

#### Step 3: Verify Pricing (Optional)

Update `calculateCost()` if you need custom pricing logic:

```typescript
// In server/src/inference/models.ts

export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = MODEL_CATALOG[modelId];
  if (!model) throw new Error(`Model '${modelId}' not found`);

  const inputCost = (inputTokens / 1_000_000) * model.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePer1M;
  const markup = (inputCost + outputCost) * (model.markupPercent / 100);

  return inputCost + outputCost + markup;
}
```

#### Step 4: Test

```bash
# Restart the server
cd server && npm run dev

# Verify model appears in catalog
curl http://localhost:3001/v1/models \
  -H "Authorization: Bearer oma_sk_your_key" | jq '.data[] | select(.id=="my-new-model")'

# Test inference
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-new-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Model Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Internal model identifier |
| `veniceId` | string | Yes | Venice API model ID |
| `provider` | string | Yes | "venice" or "antseed" |
| `primaryProvider` | string | Yes | Primary routing target |
| `inputPricePer1M` | number | Yes | Cost per 1M input tokens |
| `outputPricePer1M` | number | Yes | Cost per 1M output tokens |
| `markupPercent` | number | Yes | Your markup (0-100) |
| `category` | string | Yes | "budget" / "mid" / "premium" / "frontier" |
| `maxTokens` | number | Yes | Maximum context window |
| `supportsStreaming` | boolean | Yes | Streaming support |
| `displayName` | string | Yes | UI display name |
| `capabilities` | string[] | No | ["chat", "coding", "vision"] |
| `description` | string | No | UI description |

### Adding Vision Models

For models with vision capabilities (like Claude 3.5 Sonnet):

```typescript
"claude-3-5-sonnet": {
  id: "claude-3-5-sonnet",
  veniceId: "claude-3-5-sonnet",
  provider: "venice",
  primaryProvider: "venice",
  inputPricePer1M: 3.0,
  outputPricePer1M: 15.0,
  markupPercent: 10,
  category: "premium",
  maxTokens: 200000,
  supportsStreaming: true,
  displayName: "Claude 3.5 Sonnet",
  capabilities: ["chat", "coding", "vision"],
  description: "Most intelligent Claude model with vision",
},
```

---

## 9. How to Add New Providers

### Step-by-Step Guide

#### Step 1: Create Provider Module

Create a new file in `server/src/inference/` for your provider:

```typescript
// server/src/inference/myprovider.ts

import { Hono } from 'hono';
import type { ChatRequest, ChatResponse } from './types';

export class MyProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Implement your provider's API call logic here
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MyProvider error: ${response.status}`);
    }

    return response.json();
  }

  async chatStream(request: ChatRequest): Promise<ReadableStream> {
    // Implement streaming if supported
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return response.body!;
  }
}
```

#### Step 2: Update Router

Edit `server/src/inference/router.ts` to handle the new provider:

```typescript
// In server/src/inference/router.ts

import { MyProvider } from './myprovider';

export class InferenceRouter {
  private venice: VeniceProvider;
  private antseed: AntSeedProvider;
  private myProvider: MyProvider;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.venice = new VeniceProvider(process.env.VENICE_API_KEY!);
    this.antseed = new AntSeedProvider(
      process.env.ANTSEED_API_URL!,
      process.env.ANTSEED_API_KEY!
    );
    this.myProvider = new MyProvider(
      process.env.MYPROVIDER_API_KEY!,
      process.env.MYPROVIDER_BASE_URL!
    );
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 300000,
    });
  }

  async route(modelId: string, request: ChatRequest): Promise<ChatResponse> {
    const model = MODEL_CATALOG[modelId];
    if (!model) throw new Error(`Model '${modelId}' not found`);

    // Try primary provider
    if (!this.circuitBreaker.isOpen('venice')) {
      try {
        return await this.venice.chat(request);
      } catch (error) {
        this.circuitBreaker.recordFailure('venice');
        throw error;
      }
    }

    // Try backup provider
    try {
      return await this.antseed.chat(request);
    } catch (error) {
      // Try new provider
      return await this.myProvider.chat(request);
    }
  }
}
```

#### Step 3: Add Model Entries

Add models to `server/src/inference/models.ts` with the new provider:

```typescript
"my-model": {
  id: "my-model",
  veniceId: "some-venice-id",
  provider: "myprovider",           // New provider name
  primaryProvider: "myprovider",    // Primary routing target
  inputPricePer1M: 2.0,
  outputPricePer1M: 4.0,
  markupPercent: 15,
  category: "mid",
  maxTokens: 128000,
  supportsStreaming: true,
  displayName: "My Provider Model",
  capabilities: ["chat"],
  description: "Model from MyProvider",
},
```

#### Step 4: Update Circuit Breaker

In `server/src/inference/circuit-breaker.ts`:

```typescript
// Add new provider to circuit breaker
const PROVIDERS = ['venice', 'antseed', 'myprovider'];

// Update isOpen and recordFailure to handle new provider
```

#### Step 5: Test

```bash
# Restart server
cd server && npm run dev

# Test with new model
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Provider Interface

All providers must implement this interface:

```typescript
interface AIProvider {
  // Non-streaming chat completion
  chat(request: ChatRequest): Promise<ChatResponse>;

  // Streaming chat completion (returns ReadableStream)
  chatStream?(request: ChatRequest): Promise<ReadableStream>;

  // Embeddings (if supported)
  embeddings?(input: string | string[]): Promise<number[][]>;
}
```

### Circuit Breaker Configuration

```typescript
// In server/src/inference/circuit-breaker.ts

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Open circuit after N failures
  resetTimeout: number;      // Try again after N ms
  halfOpenRequests: number;  // Allow N requests in half-open state
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeout: 300000,      // 5 minutes
  halfOpenRequests: 1,
};
```

---

## 10. Deployment

### Option 1: Coolify (Recommended)

Coolify is a self-hosted alternative to Vercel. It handles:
- Git-based deployments
- SSL certificates (Let's Encrypt)
- Reverse proxy (Caddy)
- Docker container management
- Environment variable management

#### Step 1: Install Coolify

```bash
# On a fresh Ubuntu 22.04 VPS (minimum 2GB RAM)
curl -fsSL https://cdn.coolify.io/v1/setup.sh | bash
```

Access Coolify at `https://your-server-ip:3000` and create your account.

#### Step 2: Create Project

1. In Coolify dashboard: **New Project** > **Add Application**
2. Connect your Git repository (GitHub, GitLab, self-hosted)
3. Select the repository

#### Step 3: Deploy Backend

1. **Application Name:** `oma-api`
2. **Build Pack:** Dockerfile
3. **Dockerfile Path:** `server/Dockerfile`
4. **Root Directory:** `server/`
5. **Port:** `3001`
6. **Environment Variables:** Add all from `server/.env`

#### Step 4: Deploy Frontend

1. **Add Another Application** in the same project
2. **Application Name:** `oma-frontend`
3. **Build Pack:** Nixpacks (auto-detects Next.js)
4. **Root Directory:** `app/`
5. **Port:** `3000`
6. **Domain:** `your-domain.com`

#### Step 5: Configure Caddy

On your server, create `/opt/caddy/Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:3000
    encode gzip zstd
}

api.your-domain.com {
    reverse_proxy localhost:3001
    encode gzip
}
```

Apply config:
```bash
caddy reload --config /opt/caddy/Caddyfile
```

### Option 2: Docker Compose

For single-server deployment:

```bash
# SSH into your server
cd /opt/oma

# Copy and edit environment
cp deploy/coolify/.env.example .env
nano .env  # Fill in your values

# Start everything
docker-compose -f deploy/coolify/docker-compose.yml up -d

# View status
docker-compose -f deploy/coolify/docker-compose.yml ps

# View logs
docker-compose -f deploy/coolify/docker-compose.yml logs -f api
```

### Production Checklist

- [ ] `JWT_SECRET` is strong (40+ random characters)
- [ ] `FACILITATOR_MODE=live` for production x402
- [ ] `CORS_ORIGIN` set to exact domain
- [ ] HTTPS enabled (Let's Encrypt)
- [ ] Database SSL connections enabled
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` configured
- [ ] `REDIS_URL` set for rate limiting
- [ ] Backup strategy configured
- [ ] Monitoring/alerting set up
- [ ] Domain DNS configured

### Cost Structure

| Component | Service | Monthly Cost |
|-----------|---------|---------------|
| Database | Neon PostgreSQL (Free tier) | $0 |
| Cache | Upstash Redis (Free tier) | $0 |
| Hosting | Self-hosted (VPS ~$5-10) | $5-10 |
| Domain | .com | ~$1/mo |
| **Total** | | **$6-11/mo** |

---

## 11. Troubleshooting

### Server Won't Start

**Error:** `Error: DATABASE_URL is required`
```
Fix: Verify DATABASE_URL is set in server/.env
```

**Error:** `Error: JWT_SECRET is required`
```
Fix: Generate secret: openssl rand -base64 32
```

### Database Connection Failed

**Error:** `Connection refused` or `ENOTFOUND`
```
Fix:
1. Check Neon dashboard for connection string
2. Verify DATABASE_URL format: postgresql://user:pass@host:5432/db
3. Add ?sslmode=require for Neon
```

### Credits Not Deducted

**Possible causes:**
1. Balance check happens before inference - may be timing issue
2. Streaming responses deduct on final chunk
3. Check logs for `deductCredits` calls

**Debug:**
```bash
# Check user's balance and usage
curl http://localhost:3001/v1/balance \
  -H "Authorization: Bearer oma_sk_your_key"
```

### HoudiniSwap Webhook Not Working

**Check:**
1. Webhook URL is publicly accessible
2. `HOUDINI_WEBHOOK_SECRET` matches between server and HoudiniSwap dashboard
3. Check server logs for webhook endpoint hits
4. Verify HMAC signature verification timing-safe comparison

**Test webhook manually:**
```bash
# Send test payload
curl -X POST http://localhost:3001/v1/deposit/houdini/webhook \
  -H "Content-Type: application/json" \
  -H "X-Houdini-Signature: <your-signature>" \
  -d '{"depositId":"...","toAmount":"100","txHash":"0x..."}'
```

### Rate Limiting Too Aggressive

**Check:** Redis connection is working
```bash
# Test Redis
redis-cli -u $REDIS_URL ping
```

**Adjust in code:**
- `server/src/middleware/rate-limit.ts` - modify bucket size and refill rates
- Per-key limits in `server/src/middleware/spend-limit.ts`

### SIWE Auth Failing

**Error:** `SIWE verification failed`
```
Possible causes:
1. Nonce expired (5-minute window)
2. Signature doesn't match message
3. Chain ID mismatch
4. Domain mismatch

Debug: Check server logs for nonce value and verification details
```

### Model Not Found

**Error:** `Model 'xxx' not found`
```
Fix: Check spelling - model IDs are case-sensitive
Available models: curl http://localhost:3001/v1/models
```

### Docker Build Fails

**Error:** `exec format error` or `permission denied`
```
Fix:
1. Ensure Dockerfiles are in correct directories
2. Check .dockerignore files
3. Try: docker-compose build --no-cache
```

### Circuit Breaker Stuck

**Symptom:** Requests always go to backup provider even though primary is working

**Fix:**
```bash
# Check circuit breaker state in logs
# Look for "Circuit breaker state" logs

# Restart the server to reset circuit breaker state
```

### WebSocket Notifications Not Working

**Check:**
1. Server supports WebSocket (check `server/src/index.ts`)
2. Frontend WebSocket connection established
3. Firewall allows WebSocket connections

---

## 12. How to Make It a Real SaaS

### Business Model Options

#### Option 1: Credit-based (Current)

Users pre-buy credits at a markup over provider costs.

**Pros:**
- Simple pricing
- Predictable revenue
- No complex tokenomics

**Pricing example:**
| Model | Provider Cost | Your Price | Margin |
|-------|--------------|------------|--------|
| Claude 3.5 Sonnet | $3.50/1M tokens | $4.00/1M tokens | 14% |
| GPT-4o | $2.50/1M tokens | $3.00/1M tokens | 20% |

#### Option 2: Subscription

Monthly subscription with included credits.

**Tiers:**
| Tier | Price | Credits | Overage |
|------|-------|---------|---------|
| Free | $0 | 100K tokens/mo | N/A |
| Hobby | $19/mo | 1M tokens/mo | $2/100K |
| Pro | $49/mo | 5M tokens/mo | $1.5/100K |
| Team | $149/mo | 20M tokens/mo | $1/100K |

#### Option 3: Hybrid

Subscription + usage beyond included credits.

### Revenue Optimization

**1. Markup Strategy**
- Budget models: Higher markup (30-50%)
- Premium models: Lower markup (10-15%)
- Frontier models: Premium pricing ($10+/1M tokens)

**2. Volume Discounts**
- 10% off for 1M+ tokens/month
- 20% off for 5M+ tokens/month
- 30% off for 20M+ tokens/month

**3. Staking Integration**
- OMA stakers get 5-15% discount
- Creates token demand
- Reduces effective payout to providers

### Scaling Considerations

**1. Multi-tenant Architecture**
- Each user has isolated data (credits, API keys, usage)
- Shared infrastructure for cost efficiency
- Database row-level security

**2. Provider Redundancy**
- Venice AI (primary)
- AntSeed (backup)
- Add more providers as needed (OpenRouter, Together, etc.)

**3. Rate Limiting**
- Per-user rate limits prevent abuse
- Global rate limits protect infrastructure
- Tiered limits based on subscription

**4. Monitoring**
- Track API response times
- Monitor provider uptime
- Alert on error rate spikes
- Usage dashboards

### Adding Team Features

**Multi-user workspaces:**
```typescript
// Add to schema
workspace: {
  id: uuid,
  name: string,
  ownerId: uuid,
  members: uuid[],
  monthlyLimit: number,
  currentUsage: number,
}
```

**Team API keys:**
```typescript
// Team API key with workspace
{
  key: "oma_sk_team_xxx",
  workspaceId: "workspace_xxx",
  permissions: ["inference", "deposit"],
  rateLimit: 1000,  // per minute
}
```

**Usage attribution:**
```typescript
// Track which user made request
{
  userId: "user_xxx",
  workspaceId: "workspace_xxx",
  modelId: "claude-3-5-sonnet",
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.02,
  timestamp: Date,
}
```

### White-Label Options

For agencies or SaaS resellers:

1. **Custom domain**: `api.your-client.com`
2. **Branding**: Logo, colors, email
3. **Custom pricing**: Set your own margins
4. **API key portal**: Your client's customers

---

## 13. Documentation Cleanup

### Current Documentation State

The project has several overlapping documentation files:

| File | Status | Recommendation |
|------|--------|----------------|
| `README.md` | Current, accurate | Keep as main entry point |
| `AGENTS.md` | Basic operations | Keep for developer reference |
| `docs/OMA-ARCHITECTURE.md` | Accurate but overlaps README | **Merge into README** or keep as detailed reference |
| `docs/OMA-PHASE-2-PLAN.md` | Partially implemented (staking done) | **Merge into this guide** |
| `docs/OMA-X402-CROSSCHAIN-ARCHITECTURE.md` | Detailed technical spec | Keep as reference |
| `docs/BRAND-MESSAGING.md` | Brand guidelines | Keep separate (internal) |
| `docs/MOTION-DESIGN-REF.md` | Frontend animation spec | Keep separate |
| `deploy/deployment-guide.md` | Overlaps with Coolify docs | **Merge into this guide** |
| `deploy/self-hosting-guide.md` | Likely redundant | **Delete - merged into deployment-guide** |
| `deploy/coolify/RESOURCE_CONFIG.md` | Specific Coolify config | Keep as detailed reference |
| `specs/testing-strategy.md` | Very specific/short | **Merge into AGENTS.md** |

### Recommended Actions

1. **Merge** `docs/OMA-ARCHITECTURE.md` content into `README.md`
2. **Merge** `docs/OMA-PHASE-2-PLAN.md` content into this guide
3. **Merge** `deploy/deployment-guide.md` into this guide
4. **Delete** `deploy/self-hosting-guide.md` (redundant)
5. **Merge** `specs/testing-strategy.md` into `AGENTS.md`
6. **Keep** `docs/OMA-X402-CROSSCHAIN-ARCHITECTURE.md` as detailed technical reference
7. **Keep** `docs/BRAND-MESSAGING.md` and `docs/MOTION-DESIGN-REF.md` as separate spec documents

---

## Quick Reference

### Development Commands

```bash
# Server
cd server
npm run dev          # Start with hot reload
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint code
npm run typecheck    # Type check
npm run db:push      # Push schema to DB

# Frontend
cd app
npm run dev          # Start with hot reload
npm run build        # Production build
npm run lint         # Lint code
npm run typecheck    # Type check

# Docker
docker-compose up -d           # Start all
docker-compose logs -f api    # Watch API logs
docker-compose down            # Stop all
```

### Key Files

| File | Purpose |
|------|---------|
| `server/src/routes/chat.ts` | Inference endpoint (main revenue) |
| `server/src/routes/deposit.ts` | All deposit methods |
| `server/src/routes/staking.ts` | OMA staking |
| `server/src/inference/models.ts` | Model catalog and pricing |
| `server/src/inference/router.ts` | Provider routing and circuit breaker |
| `server/src/credits/balance.ts` | Credit checking and deduction |
| `contracts/OMA.sol` | OMA token |
| `contracts/xOMA.sol` | Staking vault |

### Health Check

```bash
curl https://api.your-domain.com/health
# Response: {"status":"ok","version":"1.0.0","service":"oma-ai"}
```

---

*Building a better future... with self-hosted AI inference.*

**Vault-Tec is not responsible for any unforeseen deployment joy or smooth developer experience.**

(End of file - total 1250 lines)