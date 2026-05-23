# OMA AI Gateway - Running Guide for Tyson

**Last Updated:** May 22, 2026

---

## Current Status - All Working

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:3000 | Running - loads correctly |
| API Server | http://localhost:3001 | Running - 60+ models available |
| Health | http://localhost:3001/health | `{"status":"ok"}` |

---

## What You Need To Use OMA

### 1. Venice AI API Key (REQUIRED FOR AI TO WORK)

Get from: https://api.venice.ai

**Current status:** `VENICE_API_KEY=sk-your-venice-api-key` (NOT SET - needs real key)

Without this, AI requests will fail. Get a free key from venice.ai.

### 2. Database (REQUIRED)

**Current:** `DATABASE_URL=postgresql://user:pass@localhost:5432/oma` (NOT CONNECTED)

You need PostgreSQL running. Get free cloud DB at https://neon.tech

### 3. Base Wallet with USDC (For Real Deposits)

**Purpose:** Pay for AI API calls with USDC

**Setup:**
1. Install MetaMask: https://metamask.io
2. Add Base network manually:
   - Network Name: `Base`
   - RPC URL: `https://mainnet.base.org`
   - Chain ID: `8453`
   - Currency: `ETH`
   - Block Explorer: `https://basescan.org`

**Get USDC on Base:**
1. Buy ETH on Coinbase (or any exchange)
2. Send ETH to your MetaMask
3. Bridge to Base: https://bridge.base.org
4. Swap ETH for USDC: https://app.uniswap.org (select Base network)

---

## How Development Mode Works (Current)

**Mode:** `FACILITATOR_MODE=mock` (in server/.env)

This means:
- Deposits are **simulated** - no real USDC needed
- Credits added instantly to your account
- Perfect for development/testing
- Blockchain not required in mock mode

---

## How To Build Things With OMA

### Step 1: Start Servers (Already Running)

```bash
cd oma && ./start-dev.sh

# Or manually:
cd server && npm run dev   # port 3001
cd app && npm run dev       # port 3000
```

### Step 2: Open Frontend

```
http://localhost:3000
```

### Step 3: Connect Wallet

1. Click "Connect Wallet" on the homepage
2. Choose MetaMask or WalletConnect
3. Sign the message with your wallet
4. Done - you're logged in

### Step 4: Get API Key

1. Go to `/dashboard`
2. Click "Create API Key"
3. Copy your key: `oma_sk_xxxxxxxxxxxx`

### Step 5: Deposit Credits (Mock Mode)

Go to `/deposit`:
- Click "Mock Deposit" button
- Enter amount (e.g., 1000)
- Credits added instantly - no real USDC

### Step 6: Use AI API

```bash
# Test chat (need API key first)
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Say hi in one word"}]}'

# List all models
curl http://localhost:3001/v1/models

# Check balance
curl http://localhost:3001/v1/balance \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Python Example (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="http://localhost:3001/v1"
)

# Works exactly like OpenAI - just change the URL and key
response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

---

## Environment Files

### Server (`server/.env`)

```env
# Database - MUST SET UP
DATABASE_URL=postgresql://user:pass@localhost:5432/oma

# AI Provider - MUST GET FROM venice.ai
VENICE_API_KEY=sk-your-venice-api-key

# Security
JWT_SECRET=any-random-string-at-least-40-characters

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

# Payment Mode (mock = dev, live = prod)
FACILITATOR_MODE=mock
```

### Frontend (`app/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_BASE_TREASURY=0xYourTreasuryAddress
```

---

## Model Pricing

| Model | Input $/1M | Output $/1M | Context |
|-------|-----------|-------------|---------|
| **Budget** |
| qwen3-8b | $0.01 | $0.01 | 32K |
| deepseek-r1-8b | $0.01 | $0.01 | 32K |
| phi-4-mini | $0.01 | $0.01 | 64K |
| **Value** |
| deepseek-v4-flash | $0.05 | $0.19 | 128K |
| gemini-2.5-flash | $0.15 | $0.60 | 1M |
| gpt-4o-mini | $0.15 | $0.60 | 128K |
| **Premium** |
| gpt-4o | $2.50 | $10.00 | 128K |
| claude-haiku-4.5 | $0.80 | $4.00 | 200K |
| deepseek-r1 | $0.55 | $2.19 | 64K |
| **Frontier** |
| claude-opus-4.7 | $15.00 | $75.00 | 200K |
| gpt-5.5 | $10.00 | $30.00 | 128K |
| o3 | $10.00 | $40.00 | 200K |
| **Video** |
| seedance-2-0 | $0.90/video | - | 5s |
| kling-v3-pro | $0.92/video | - | 5s |
| grok-imagine | $0.85/video | - | 5s |

Full list: `curl http://localhost:3001/v1/models`

---

## x402 Payments (For AI Agents)

x402 = pay per request without pre-funding

### Flow

```
1. Get quote
   POST /v1/x402/quote
   { model, inputTokens, fromToken, fromChain }

2. Create deposit order
   POST /v1/x402/deposit
   { quoteId }

3. Send tokens to deposit address (from response)

4. Poll for settlement (~1-5 min for cross-chain)
   GET /v1/x402/deposit/:orderId/status

5. Call inference
   POST /v1/x402/proxy/chat/completions
   X-Houdini-Order-Id: <orderId>
```

### Example

```bash
# Get quote
curl -X POST http://localhost:3001/v1/x402/quote \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","inputTokens":1000,"fromToken":"ETH","fromChain":"ethereum"}'

# Create deposit (returns deposit address)
curl -X POST http://localhost:3001/v1/x402/deposit \
  -H "Content-Type: application/json" \
  -d '{"quoteId":"quote_xxx"}'

# Poll status
curl http://localhost:3001/v1/x402/deposit/order_xxx/status

# Call inference with order
curl -X POST http://localhost:3001/v1/x402/proxy/chat/completions \
  -H "X-Houdini-Order-Id: order_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Hi"}]}'
```

---

## Database Setup

```bash
# 1. Get PostgreSQL (free at neon.tech)

# 2. Set DATABASE_URL in server/.env

# 3. Create tables
cd server && npm run db:push

# 4. Check it works
curl http://localhost:3001/health
```

---

## Quick Test Commands

```bash
# Health check
curl http://localhost:3001/health

# List models (60+)
curl http://localhost:3001/v1/models

# Test chat (after getting API key)
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Hi"}]}'

# Test streaming
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Count to 3"}],"stream":true}'

# Run tests
cd server && npm test
cd app && npm run test
```

---

## What You Need To Do Right Now

| Task | Status | Action |
|------|--------|--------|
| Set Venice API Key | REQUIRED | Get from https://api.venice.ai |
| Set up PostgreSQL | REQUIRED | Get free at https://neon.tech |
| Connect Database | REQUIRED | Set DATABASE_URL |
| Base Wallet | Optional | For real USDC deposits |
| WalletConnect ID | Optional | For WalletConnect UI |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        YOU (Developer)                      │
│                                                              │
│  1. Connect wallet (MetaMask) → sign SIWE message            │
│  2. Deposit USDC → credits (mock = instant, no real USDC)   │
│  3. Create API key: oma_sk_xxxx                              │
│  4. Call /v1/chat/completions with your key                  │
│  5. Credits deducted per request                             │
│  6. OMA routes to: Venice AI → AntSeed → LiteLLM           │
└─────────────────────────────────────────────────────────────┘
```

**AI Provider Routing:**
| Provider | Role | Key |
|----------|------|-----|
| Venice AI | Primary | `sk-venice-*` (get from venice.ai) |
| AntSeed | Backup | `ant_*` |
| LiteLLM | Third backup | OpenAI-compatible |

**Payment Modes:**
| Mode | Deposits | Blockchain |
|------|----------|------------|
| mock | Simulated | None needed |
| live | Real USDC | Base blockchain |

---

## File Locations

```
oma/
├── server/
│   ├── .env              # API server config (NEED TO SET KEYS)
│   └── src/
│       ├── routes/       # API endpoints (auth, chat, deposit, etc)
│       ├── inference/     # AI providers (venice, antseed)
│       └── db/           # Database schema
├── app/
│   ├── .env.local        # Frontend config
│   └── src/
│       ├── app/          # Pages (dashboard, deposit, etc)
│       └── components/   # UI components
└── docs/
    ├── RUNNING.md        # This file
    └── API-DOCUMENTATION.md
```

---

## Next Steps

1. **Get Venice API key** from https://api.venice.ai
2. **Set up PostgreSQL** at https://neon.tech (free tier)
3. **Update server/.env** with real values
4. **Run `cd server && npm run db:push`** to create tables
5. **Restart server** - `cd server && npm run dev`
6. **Open http://localhost:3000** - connect wallet, create API key
7. **Test AI** - use the API key to call chat completions

---

**Questions?** Check docs at `/docs` in the running app, or read `docs/DEVELOPER-GUIDE.md`