# OMA AI Gateway - Complete API Documentation

**Version:** 2.0.0 | **Status:** Production Ready

---

## Table of Contents

1. [Overview](#1-overview)
2. [Setup Requirements](#2-setup-requirements)
3. [API Endpoints](#3-api-endpoints)
4. [Model Pricing](#4-model-pricing)
5. [Authentication](#5-authentication)
6. [x402 Payments](#6-x402-payments)
7. [Testing Guide](#7-testing-guide)
8. [Example Code](#8-example-code)

---

## 1. Overview

OMA is an AI inference gateway with OpenAI-compatible API. Pay with crypto, use 50+ models.

```
User ──► OMA API ──► Venice AI / AntSeed / LiteLLM
         │
         └── Credits deducted per request
```

### Base URL
- **Local Dev:** `http://localhost:3001`
- **Production:** `https://api.oma-ai.com`

### Key Features
- OpenAI-compatible endpoints
- 50+ AI models
- Multi-provider failover (Venice → AntSeed → LiteLLM)
- Rate limiting per API key
- Streaming support

---

## 2. Setup Requirements

### Required Services

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Venice AI** | Primary AI provider | https://api.venice.ai |
| **PostgreSQL** | User/credit storage | https://neon.tech (free tier) |
| **WalletConnect** | Wallet connection (optional dev) | https://cloud.walletconnect.com |

### Environment Variables

**Server (`server/.env`):**
```env
# REQUIRED
DATABASE_URL=postgresql://user:pass@host:5432/database
JWT_SECRET=your-super-secret-key-at-least-40-characters-long
VENICE_API_KEY=sk-your-venice-api-key

# SERVER CONFIG
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
FACILITATOR_MODE=mock

# OPTIONAL (for rate limiting)
REDIS_URL=redis://localhost:6379
```

**Frontend (`app/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_BASE_TREASURY=0xYourTreasuryAddress
```

### Database Setup

```bash
cd server
npm run db:push    # Creates tables
```

### Start Servers

```bash
# Both servers
cd oma && ./start-dev.sh

# Or individually
cd server && npm run dev   # :3001
cd app && npm run dev       # :3000
```

---

## 3. API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "service": "oma-ai"
}
```

---

### Authentication

#### Get SIWE Nonce
```http
POST /auth/nonce
Content-Type: application/json

{ "address": "0x..." }
```

**Response:**
```json
{ "nonce": "abc123xyz..." }
```

#### Verify SIWE Signature
```http
POST /auth/verify
Content-Type: application/json

{
  "message": "oma-ai.com wants you to sign in with your Ethereum account:\n0x...",
  "signature": "0x...",
  "type": "siwe"
}
```

**Response:**
```json
{
  "token": "eyJhbG...",
  "address": "0x..."
}
```

#### Wallet Connect (Get API Key)
```http
POST /auth/wallet
Content-Type: application/json

{
  "message": "...",
  "signature": "0x..."
}
```

**Response:**
```json
{
  "apiKey": "oma_sk_xxxxxxxxxxxx",
  "prefix": "oma_sk_xxxx",
  "id": "uuid",
  "name": "Default wallet key",
  "createdAt": "2026-05-22T..."
}
```

---

### API Keys

#### List Keys
```http
GET /keys
Authorization: Bearer <session_token>
```

#### Create Key
```http
POST /keys
Authorization: Bearer <session_token>
Content-Type: application/json

{ "name": "Production" }
```

#### Delete Key
```http
DELETE /keys/:id
Authorization: Bearer <session_token>
```

---

### Inference (OpenAI-Compatible)

#### Chat Completions
```http
POST /v1/chat/completions
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "llama-3.3-70b",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1747852800,
  "model": "llama-3.3-70b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 15,
    "total_tokens": 35
  }
}
```

#### Streaming Response
```http
POST /v1/chat/completions
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "llama-3.3-70b",
  "messages": [{"role": "user", "content": "Count to 5"}],
  "stream": true
}
```

**Response:** `text/event-stream`
```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"One"},"finish_reason":null}]}

data: {"id":"...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Two"},"finish_reason":null}]}

data: [DONE]
```

#### List Models
```http
GET /v1/models
```

**Response:**
```json
{
  "models": [
    {
      "id": "claude-opus-4-7",
      "category": "frontier",
      "inputPricePer1M": 15.0,
      "outputPricePer1M": 75.0,
      "maxTokens": 200000,
      "displayName": "Claude Opus 4.7",
      "capabilities": ["chat", "coding", "reasoning", "vision"]
    },
    ...
  ]
}
```

#### Embeddings
```http
POST /v1/embeddings
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "embed-english-v3.0",
  "input": "The quick brown fox"
}
```

#### Image Generation
```http
POST /v1/images/generations
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "flux-schnell",
  "prompt": "A cute cat",
  "n": 1,
  "size": "1024x1024"
}
```

#### Text-to-Speech
```http
POST /v1/audio/speech
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "speech-1",
  "input": "Hello, world!",
  "voice": "alloy"
}
```

**Response:** Binary audio (mp3/wav)

#### Video Generation
```http
POST /v1/videos/generations
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "seedance-2-0-text-to-video",
  "prompt": "A sunset over the ocean",
  "duration": "5s"
}
```

**Response:**
```json
{
  "id": "vid_abc123",
  "object": "video",
  "status": "processing",
  "queue_id": "abc123"
}
```

#### Retrieve Video
```http
GET /v1/videos/retrieve?queue_id=abc123
```

---

### Credits & Balance

#### Get Balance
```http
GET /v1/balance
Authorization: Bearer <api_key>
```

**Response:**
```json
{
  "balanceCents": 5000,
  "totalDepositedCents": 10000,
  "totalUsedCents": 5000
}
```

---

### Deposits

#### USDC Deposit (Base)
```http
POST /v1/deposit/usdc
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "amount": "1000000",  // 1 USDC (6 decimals)
  "txHash": "0x..."
}
```

#### USDC Deposit (Solana)
```http
POST /v1/deposit/usdc
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "amount": "1000000",
  "txHash": "solana_tx_hash",
  "network": "solana"
}
```

#### HoudiniSwap (Cross-Chain)
```http
POST /v1/deposit/houdini
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "fromToken": "ETH",
  "fromChain": "ethereum",
  "toToken": "USDC",
  "toChain": "base",
  "fromAmount": "1000000000000000000"  // 1 ETH in wei
}
```

**Response:**
```json
{
  "orderId": "houdini_order_id",
  "depositAddress": "0x...",  // Send tokens here
  "expiresAt": "2026-05-22T..."
}
```

#### HoudiniSwap Tokens
```http
GET /v1/deposit/houdini/tokens
```

---

### x402 Payments

#### Get Quote
```http
POST /v1/x402/quote
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
  "inputTokens": 1000,
  "fromToken": "ETH",
  "fromChain": "ethereum"
}
```

**Response:**
```json
{
  "quoteId": "quote_xxx",
  "fromToken": "ETH",
  "fromAmount": "100000000000000000",
  "toToken": "USDC",
  "toAmount": "5000000",
  "routingFee": "500000",
  "facilitatorFee": "75000",
  "totalCostUsd": 5.75,
  "expiresIn": 60
}
```

#### Create x402 Deposit
```http
POST /v1/x402/deposit
Content-Type: application/json

{
  "quoteId": "quote_xxx",
  "refundAddress": "0x..."
}
```

**Response:**
```json
{
  "orderId": "order_xxx",
  "depositAddress": "0x...",
  "fromToken": "ETH",
  "fromAmount": "100000000000000000",
  "expiresAt": "2026-05-22T..."
}
```

#### Check x402 Deposit Status
```http
GET /v1/x402/deposit/:orderId/status
```

**Response:**
```json
{
  "orderId": "order_xxx",
  "status": "settling",
  "houdiniStatus": "PROCESSING",
  "fromAmount": "100000000000000000",
  "toAmount": "4950000",
  "txHash": "0x..."
}
```

#### x402 Proxy (Direct)
```http
POST /v1/x402/proxy/chat/completions
X-Houdini-Order-Id: order_xxx
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
  "messages": [{"role": "user", "content": "Hello"}]
}
```

---

## 4. Model Pricing

### Frontier Models (Best Quality)

| Model | Input $/1M | Output $/1M | Context | Provider |
|-------|-----------|-------------|---------|----------|
| Claude Opus 4.7 | $15.00 | $75.00 | 200K | Venice |
| GPT-5.5 | $10.00 | $30.00 | 128K | Venice |
| o3 | $10.00 | $40.00 | 200K | Venice |
| Claude Sonnet 4.6 | $3.00 | $15.00 | 200K | Venice |
| GPT-4o | $2.50 | $10.00 | 128K | Venice |
| Mistral Large | $2.00 | $6.00 | 128K | Both |

### Premium Models (Best Value)

| Model | Input $/1M | Output $/1M | Context | Provider |
|-------|-----------|-------------|---------|----------|
| Claude Haiku 4.5 | $0.80 | $4.00 | 200K | Venice |
| GPT-4o Mini | $0.15 | $0.60 | 128K | Venice |
| Gemini 3.5 Flash | $1.50 | $9.00 | 1M | Venice |
| DeepSeek R1 | $0.55 | $2.19 | 64K | AntSeed |
| DeepSeek V4 Pro | $0.18 | $1.00 | 128K | AntSeed |

### Budget Models (Cheapest)

| Model | Input $/1M | Output $/1M | Context | Provider |
|-------|-----------|-------------|---------|----------|
| DeepSeek V4 Flash | $0.05 | $0.19 | 128K | AntSeed |
| Qwen3-8B | $0.01 | $0.01 | 32K | AntSeed |
| DeepSeek R1 8B | $0.01 | $0.01 | 32K | AntSeed |
| Phi-4 Mini | $0.01 | $0.01 | 64K | AntSeed |
| Gemini 2.5 Flash | $0.15 | $0.60 | 1M | Venice |
| Llama 3.1 8B | $0.01 | $0.01 | 128K | AntSeed |

### Video Models

| Model | Price | Duration |
|-------|-------|----------|
| Seedance 2.0 Text-to-Video | $0.90 | 5s |
| Seedance 2.0 Image-to-Video | $1.20 | 5s |
| Kling V3 Pro Text-to-Video | $0.92 | 5s |
| Kling V3 Pro Image-to-Video | $1.40 | 5s |
| Grok Imagine Text-to-Video | $0.85 | 5s |

### Uncensored Models

| Model | Input $/1M | Output $/1M | Context | Provider |
|-------|-----------|-------------|---------|----------|
| Venice Uncensored | $0.07 | $0.35 | 32K | Venice |

### Specialized Models

| Model | Input $/1M | Output $/1M | Context | Provider |
|-------|-----------|-------------|---------|----------|
| ChainScout Guard V1 | $25.00 | $120.00 | 32K | AntSeed |
| Token Take Agent | $1.00 | $4.00 | 32K | AntSeed |

---

## 5. Authentication

### Option 1: Wallet (SIWE)
1. Connect wallet (MetaMask, WalletConnect, etc.)
2. Sign SIWE message
3. Get session token
4. Use session to create API keys

### Option 2: API Key (For API Usage)
1. After wallet connect, create API key
2. Use API key in `Authorization: Bearer <key>` header
3. Key format: `oma_sk_xxxxxxxxxxxx`

### Option 3: Account Number (Mullvad-style)
For non-crypto users:
1. Create account number (Dashboard)
2. Login with account number
3. Same as wallet flow

---

## 6. x402 Payments

x402 is a protocol for per-request crypto payments without pre-funding.

### Flow

```
1. Agent requests quote
   POST /v1/x402/quote
   { model, inputTokens, fromToken, fromChain }

2. OMA returns quote with total cost
   { quoteId, fromAmount, totalCostUsd, expiresIn }

3. Agent creates deposit
   POST /v1/x402/deposit
   { quoteId }

4. OMA returns deposit address
   { orderId, depositAddress, expiresAt }

5. Agent sends tokens to deposit address

6. Agent polls for settlement
   GET /v1/x402/deposit/:orderId/status

7. Once settled, agent calls inference
   POST /v1/x402/proxy/chat/completions
   X-Houdini-Order-Id: <orderId>
```

### x402 Headers (for direct proxy)

```http
POST /v1/x402/proxy/chat/completions
X-Houdini-Order-Id: order_xxx
PAYMENT-SIGNATURE: {"orderId":"order_xxx","amount":5000000,"networkId":"base"}
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
  "messages": [{"role": "user", "content": "Hello"}]
}
```

### Supported Chains for x402

- Base (primary)
- Solana
- Ethereum
- Arbitrum
- Optimism
- Polygon
- Avalanche
- BSC
- And 20+ via HoudiniSwap

---

## 7. Testing Guide

### Health Check
```bash
curl http://localhost:3001/health
```

### Test Inference
```bash
# Get an API key from dashboard first
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Say hi in one word"}]
  }'
```

### Test Streaming
```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Count to 3"}],
    "stream": true
  }'
```

### Test Balance
```bash
curl http://localhost:3001/v1/balance \
  -H "Authorization: Bearer oma_sk_your_key"
```

### Test List Models
```bash
curl http://localhost:3001/v1/models
```

### Run Tests
```bash
# Server tests
cd server && npm test

# App tests
cd app && npm run test
```

---

## 8. Example Code

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_your_key",
    base_url="http://localhost:3001/v1"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

### JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:3001/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer oma_sk_your_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### cURL

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "What is 2+2?"}]
  }'
```

### OpenAI SDK Migration

```python
# BEFORE (OpenAI)
from openai import OpenAI
client = OpenAI(api_key="sk-...", base_url="https://api.openai.com/v1")

# AFTER (OMA)
from openai import OpenAI
client = OpenAI(api_key="oma_sk_xxx", base_url="http://localhost:3001/v1")
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request - invalid parameters |
| 401 | Unauthorized - invalid API key |
| 402 | Payment required - insufficient credits |
| 404 | Not found - model doesn't exist |
| 429 | Rate limit exceeded |
| 500 | Server error |
| 503 | Service unavailable - all providers down |

---

*Permissionless inference. Pay with crypto. No account required.*