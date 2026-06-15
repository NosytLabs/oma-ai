# OMA AI Gateway - Developer Guide

## What Is OMA?

**OMA = AI Gateway for Developers**

Pay for AI API calls with crypto. Skip account setup with OpenAI, Anthropic, and others. Here's how:

1. Deposit USDC into OMA
2. Receive credits
3. Call 91+ AI models via OMA's OpenAI-compatible API
4. OMA routes requests to the optimal provider

**Website:** https://oma-ai.com (currently running locally on your machine)

---

## How It Works - Simple Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVELOPER WORKFLOW                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CONNECT WALLET                                               │
│     └── MetaMask/WalletConnect → signs SIWE message             │
│                                                                  │
│  2. DEPOSIT USDC                                                  │
│     └── Send USDC to Base treasury → get credits (1:1)         │
│                                                                  │
│  3. GET API KEY                                                   │
│     └── Dashboard → Create API key (oma_sk_xxxxx)               │
│                                                                  │
│  4. USE AI API                                                    │
│     └── Send request with API key → credits deducted             │
│                                                                  │
│  5. OMA ROUTES TO BEST PROVIDER                                   │
│     └── Venice AI (primary) → AntSeed (backup) → LiteLLM         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Wallet Do You Need?

### Base Network Wallet (Required for USDC Deposits)

| Wallet | Type | Best For |
|--------|------|----------|
| **MetaMask** | Browser Extension | Most popular option |
| **Coinbase Wallet** | Browser Extension | Built-in Base support |
| **Rabby** | Browser Extension | Good Base support |
| **Rainbow** | Mobile App | Mobile users |

### Setup MetaMask for Base:

1. Install MetaMask: https://metamask.io
2. Add Base network manually:
   - Network Name: `Base`
   - RPC URL: `https://base-rpc.publicnode.com`
   - Chain ID: `8453`
   - Currency: `ETH`
   - Block Explorer: `https://basescan.org`

### Get USDC on Base:

1. Buy ETH on Coinbase or other exchange
2. Send ETH to your MetaMask
3. Bridge ETH to Base: https://superbridge.app/base or https://brid.gg/base (bridge.base.org is deprecated)
4. Swap ETH for USDC: https://app.uniswap.org (select Base network)

---

## How Deposits Work

### Option 1: USDC Direct (Fastest)

```
YOU                    OMA TREASURY              OMA SERVER
 │                          │                        │
 │  Send USDC to treasury   │                        │
 │────────────────────────>│                        │
 │                          │                        │
 │  (wait for confirm)      │                        │
 │                          │                        │
 │                          │  Webhook/Polling      │
 │                          │<───────────────────────│
 │                          │                        │
 │                          │  Verify deposit        │
 │                          │───────────────────────>│
 │                          │                        │
 │                          │  +Credits to account   │
 │                          │<───────────────────────│
```

**Steps:**
1. Go to `/deposit`
2. Select "USDC Direct"
3. Copy the treasury address
4. Send USDC from your wallet to that address
5. Wait ~10-15 seconds for confirmation
6. Credits appear in your dashboard

### Option 2: HoudiniSwap (Cross-Chain from any token)

If you have ETH, BTC, SOL, etc. on other chains:

1. Go to `/deposit`
2. Select token and chain (e.g., "ETH on Ethereum")
3. OMA generates a HoudiniSwap deposit address
4. Send tokens to that address
5. HoudiniSwap converts to USDC on Base
6. Credits issued (~1-5 minutes)

### Option 3: x402 (For AI Agents - Most Advanced)

x402 is a protocol for per-request payments without pre-funding. For full details, see [API-DOCUMENTATION.md](API-DOCUMENTATION.md#6-x402-payments).

---

## How API Keys Work

### Creating an API Key

1. Connect wallet
2. Go to `/dashboard`
3. Click "Create API Key"
4. Give it a name (e.g., "Production", "Dev")
5. Copy the key (shown ONCE only: `oma_sk_xxxxxxxxxxxx`)

### Using Your API Key

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### OpenAI-Compatible

Change your OpenAI code to OMA:

```python
# BEFORE (OpenAI)
from openai import OpenAI
client = OpenAI(api_key="sk-...",
                base_url="https://api.openai.com/v1")

# AFTER (OMA)
client = OpenAI(api_key="oma_sk_xxx",
                base_url="http://localhost:3001/v1")
```

All OpenAI SDK calls work the same - just change the key and base URL.

---

## Dual-Cookie Scheme

OMA uses **two separate cookies** that serve different purposes. Confusing them is a common source of bugs.

| Cookie | Set by | Purpose | Read by | Lifetime | Attributes |
|--------|--------|---------|---------|----------|------------|
| `oma_session` | `app/src/lib/auth.ts` (SIWE flow) | Proves the user is **logged in** to the dashboard/admin UI. Contains a short-lived JWT (HS256, `iss=oma-ai`, `aud=oma-ai-api`, 24h exp) signed by `JWT_SECRET`. | `app/src/middleware.ts` (Edge runtime, verifies with `jose.jwtVerify`) to gate dashboard/admin routes, and client UI to show logged-in state. | 24h sliding | `HttpOnly; SameSite=Lax; Secure` (prod) |
| `oma_api_key` | `server/src/auth/api-keys.ts` (`createApiKeyCookieHeader`) | Carries the user's **`oma_sk_...` API key** for the **first browser request** after login so server-side routes (e.g. `/v1/chat/completions` from a server-rendered page) can authenticate without a separate `Authorization` header. | `server/src/auth/middleware.ts` (`bearerAuth`) as a fallback to the `Authorization: Bearer` header. | 7 days, sliding via login | `HttpOnly; SameSite=Lax; Secure` (prod) |

### Why two cookies?

- **`oma_session`** answers "who is this user?" — used by the **frontend** to decide what UI to render and by **middleware** to gate protected pages. It is **never** sent to the `/v1/*` API surface as a credential.
- **`oma_api_key`** answers "what API key should the browser use to call the API?" — it lets the **same** browser tab call `/v1/chat/completions` from a client component without re-prompting for the key. For server-to-server or `curl` use, the key is passed via `Authorization: Bearer oma_sk_...` instead, and `oma_api_key` is irrelevant.

### Lifecycle

1. User signs in with SIWE → server issues a JWT and the app sets `oma_session`.
2. Server sets `oma_api_key` (if the user has an active key) so the first API call from the dashboard works.
3. On `oma_api_key` rotation/revocation the server emits a `Set-Cookie: oma_api_key=; Max-Age=0` to clear it (`createLogoutCookieHeader`).
4. On `oma_session` expiry the frontend middleware redirects to `/`; the API key cookie may still be valid and is re-used after the next sign-in.

### Security notes

- **Never** use `oma_session` as an API credential. The server's `bearerAuth` only accepts `oma_api_key` or the `Authorization: Bearer` header.
- **Never** send `oma_api_key` in the `Authorization` header in client code — let the cookie travel automatically for same-origin requests.
- The two cookies are intentionally independent: revoking an API key does **not** log the user out, and a session timeout does **not** invalidate the API key.
- In production, both cookies are `Secure`. The cookie helpers (`createApiKeyCookieHeader`, `createLogoutCookieHeader`) flip this based on `config.NODE_ENV`.

---

## Pricing (Credits)

| Model Tier | Examples | Cost per 1M input tokens |
|------------|----------|------------------------|
| **Frontier** | GPT-4o, Claude 4, Gemini 3.5 | $1.50-15.00 |
| **Premium** | GPT-4o-mini, DeepSeek V4, Qwen3 | $0.09-0.35 |
| **Budget** | Llama 3.3 70B, Gemma 3, Phi-4 | $0.05-0.25 |

Full pricing at: https://oma-ai.com/pricing or see [API-DOCUMENTATION.md](API-DOCUMENTATION.md#4-model-pricing)

---

## Setting Up Development Environment

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| npm | 10+ | Package manager |
| PostgreSQL | 15+ | Database |
| Redis | 7+ | Rate limiting (optional in dev) |

### 1. Clone and Install

```bash
cd app
npm install
```

### 2. Configure Server (.env)

```bash
cd server
cp .env.example .env
```

Edit `.env`:
```env
# Required - Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/oma"

# Required - Get from https://api.venice.ai
VENICE_API_KEY="sk-your-venice-api-key"

# Required - Random string, 40+ characters
JWT_SECRET="your-secure-secret-key-minimum-40-characters-long"

# Server config
PORT=3001
CORS_ORIGIN="http://localhost:3000"
NODE_ENV="development"

# Optional - Rate limiting works without Redis in dev
REDIS_URL="redis://localhost:6379"
```

### 3. Configure Frontend (.env.local)

```bash
cd app
cp .env.example .env.local
```

Edit `.env.local`:
```env
# API URL (server runs on 3001)
NEXT_PUBLIC_API_URL="http://localhost:3001"

# WalletConnect project ID (free from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_project_id"

# Treasury address (placeholder works in dev)
NEXT_PUBLIC_BASE_TREASURY="0x1234567890123456789012345678901234567890"
```

### 4. Get API Keys

#### Venice AI API Key:
1. Go to https://venice.ai
2. Sign up / log in
3. Go to Settings → API Keys
4. Create new key: `sk-...`

#### WalletConnect Project ID:
1. Go to https://cloud.walletconnect.com
2. Create new project
3. Copy Project ID

### 5. Set Up Database

```bash
cd server
npm run db:push    # Create tables
npm run db:generate  # Generate migrations (if needed)
```

Requires PostgreSQL running. Get free PostgreSQL at:
- https://neon.tech (cloud)
- Or install locally: https://postgresql.org

### 6. Start Servers

```bash
# Terminal 1 - API Server (port 3001)
cd server
npm run dev

# Terminal 2 - Frontend (port 3000)
cd app
npm run dev
```

### 7. Verify It Works

```bash
# Health check
curl http://localhost:3001/health

# Should return: {"status":"ok","version":"2.0.0","service":"oma-ai"}

# Open in browser
open http://localhost:3000
```

---

## Directory Structure

```
app/
├── app/                    # Next.js Frontend (port 3000)
│   ├── src/
│   │   ├── app/           # Pages (App Router)
│   │   │   ├── page.tsx  # Landing page
│   │   │   ├── dashboard/ # API keys, balance
│   │   │   ├── deposit/   # Deposit USDC
│   │   │   ├── pricing/   # Model pricing
│   │   │   ├── models/    # Model catalog
│   │   │   ├── playground/ # Test API
│   │   │   └── docs/       # API docs
│   │   ├── components/    # UI components
│   │   │   ├── navbar.tsx
│   │   │   ├── wallet-provider.tsx
│   │   │   └── ...
│   │   └── lib/
│   │       ├── wagmi.ts   # Wallet config
│   │       └── api.ts     # API client
│   └── package.json
│
├── server/                 # Hono.js API Server (port 3001)
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   │   ├── auth.ts   # Authentication (SIWE)
│   │   │   ├── chat.ts   # AI inference
│   │   │   ├── deposit.ts # Deposits
│   │   │   └── ...
│   │   ├── inference/   # AI providers
│   │   │   ├── router.ts # Circuit breaker
│   │   │   ├── venice.ts # Venice AI
│   │   │   ├── antseed.ts # AntSeed backup
│   │   │   └── models.ts # Model catalog
│   │   ├── credits/      # Credit system
│   │   ├── db/           # Database
│   │   │   └── schema.ts # Drizzle schema
│   │   └── middleware/  # Rate limiting
│   └── package.json
│
└── docs/                  # Documentation
    ├── API-DOCUMENTATION.md
    ├── BRAND-MESSAGING.md
    ├── CRITICAL-1-DEPLOYMENT-RUNBOOK.md
    ├── DEVELOPER-GUIDE.md  (this file)
    ├── INTERNAL-SOURCING.md
    ├── MOTION-DESIGN-REF.md
    ├── OMA-X402-CROSSCHAIN-ARCHITECTURE.md
    └── archive/  # Superseded audit reports
```

---

## Common Tasks

### Check Credit Balance

```bash
curl http://localhost:3001/v1/balance \
  -H "Authorization: Bearer oma_sk_your_key"
```

### List Available Models

```bash
curl http://localhost:3001/v1/models
```

### Test AI Request

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Say hello in one word"}]
  }'
```

### Create New API Key (via API)

```bash
curl -X POST http://localhost:3001/keys \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "My New Key"}'
```

---

## Architecture - How It All Fits

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                           │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Next.js Frontend (localhost:3000)                       │   │
│   │                                                          │   │
│   │  • Landing page (/, /pricing, /models)                   │   │
│   │  • Dashboard (/dashboard) → API keys, balance            │   │
│   │  • Deposit (/deposit) → USDC deposit                     │   │
│   │  • Playground (/playground) → Test AI                    │   │
│   │                                                          │   │
│   │  Wallet: MetaMask/WalletConnect → SIWE auth              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Hono.js API (localhost:3001)                            │   │
│   │                                                          │   │
│   │  Auth: SIWE (Sign-In With Ethereum)                       │   │
│   │  Chat: /v1/chat/completions → routes to AI provider      │   │
│   │  Deposit: USDC deposits, HoudiniSwap                      │   │
│   │  Credits: Balance tracking, deduction                      │   │
│   │                                                          │   │
│   │  Rate Limiting: Redis-backed token bucket                │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                    │
│          ┌──────────────────┼──────────────────┐                │
│          ▼                  ▼                  ▼                │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│   │   Venice AI │    │  AntSeed    │    │  PostgreSQL │          │
│   │  (Primary)  │    │  (Backup)   │    │  (Users,    │          │
│   │  api.venice │    │  P2P        │    │   Credits)  │          │
│   └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                          │
│   Base Blockchain ─────────────────────────────────────┘
│   (USDC deposits go to treasury address here)
└──────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### "Redis not available" warning
Redis is optional in development. Rate limiting defaults to fail-open. Install Redis or ignore the warning.

### "Invalid API key" error
Verify your API key uses `oma_sk_...` format and is active in the dashboard.

### "Insufficient credits" error
Deposit USDC to add credits. Check balance at `/dashboard`.

### Wallet won't connect
1. Ensure MetaMask is installed and unlocked
2. Add the Base network if not already configured
3. Verify WalletConnect Project ID is set in `.env.local`

---

## Next Steps

1. Get Venice API key from https://api.venice.ai
2. Set up MetaMask with Base network
3. Acquire USDC on Base
4. Start the servers: `./start-dev.sh`
5. Open http://localhost:3000
6. Connect wallet → Deposit USDC → Create API key → Build

---

**Questions?** Check the docs at `/docs` in the running app, or read `docs/INTERNAL-SOURCING.md` for the operator-side view of how OMA sources inference.