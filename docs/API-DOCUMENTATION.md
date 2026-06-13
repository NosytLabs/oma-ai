# OMA AI Gateway - Complete API Documentation

**Version:** 2.1.0 | **Status:** Production Ready

---

## Table of Contents

1. [Overview](#1-overview)
2. [Setup Requirements](#2-setup-requirements)
3. [API Endpoints](#3-api-endpoints)
4. [Authentication](#4-authentication)
5. [Rate Limiting](#5-rate-limiting)
6. [x402 Payments](#6-x402-payments)
7. [Error Handling](#7-error-handling)
8. [Testing Guide](#8-testing-guide)
9. [Example Code](#9-example-code)
10. [Model Pricing](#10-model-pricing)
11. [Inference Providers](#11-inference-providers)

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
- Rate limiting per API key (60 RPM, 120K TPM default)
- Streaming support
- WebSocket support for real-time inference

---

## 2. Setup Requirements

### Required Services

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Venice AI** | Primary AI provider | https://api.venice.ai |
| **PostgreSQL** | User/credit storage | https://neon.tech (free tier) |
| **WalletConnect** | Wallet connection (optional dev) | https://cloud.walletconnect.com |
| **Redis** | Rate limiting and caching | https://redis.io (optional) |

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
  "version": "2.1.0",
  "service": "oma-ai",
  "uptime": 86400,
  "correlationId": "req-xxx",
  "checks": {
    "redis": { "status": "ok", "latency": 2 },
    "database": { "status": "ok", "latency": 15 },
    "venice": { "status": "ok", "latency": 120 }
  }
}
```

---

### Inference (OpenAI-Compatible)

#### Chat Completions

```http
POST /v1/chat/completions
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
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
  "model": "deepseek-v4-flash",
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
  "model": "deepseek-v4-flash",
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

#### Legacy Text Completions (Deprecated)

```http
POST /v1/completions
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
  "prompt": "The capital of France is",
  "max_tokens": 50,
  "temperature": 0.7
}
```

> **Note:** This endpoint is deprecated. Use `/v1/chat/completions` instead.

#### List Models

```http
GET /v1/models
```

**Response:**

```json
{
  "object": "list",
  "data": [
    {
      "id": "deepseek-v4-flash",
      "object": "model",
      "created": 1700000000,
      "owned_by": "oma",
      "pricing": {
        "prompt": "0.05",
        "completion": "0.19"
      }
    }
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
Authorization: Bearer <api_key>
```

---

### WebSocket (Real-time Inference)

Connect to WebSocket for streaming inference with real-time responses.

```http
ws://localhost:3001/v1/chat/completions/ws
Authorization: Bearer <api_key>
```

**Connection Flow:**

1. Connect with `Authorization: Bearer <api_key>` header or query parameter
2. Wait for `{ "type": "connected", "sessionId": "..." }` confirmation
3. Send chat request messages

**Send (Chat Request):**

```json
{
  "model": "deepseek-v4-flash",
  "messages": [{"role": "user", "content": "Hello!"}],
  "stream": true
}
```

**Receive (Processing):**

```json
{
  "type": "processing",
  "id": "req_xxx"
}
```

**Receive (Provider Selected):**

```json
{
  "type": "provider",
  "provider": "venice"
}
```

**Receive (Stream Chunk):**

```json
{
  "type": "chunk",
  "id": "req_xxx",
  "delta": "Hello",
  "index": 0,
  "finish_reason": null
}
```

**Receive (Done):**

```json
{
  "type": "done",
  "id": "req_xxx"
}
```

**Receive (Final):**

```json
{
  "id": "req_xxx",
  "object": "chat.completion",
  "created": 1747852800,
  "model": "deepseek-v4-flash",
  "choices": [{
    "index": 0,
    "finish_reason": "stop",
    "delta": {},
    "usage": {"prompt_tokens": 20, "completion_tokens": 15, "total_tokens": 35}
  }]
}
```

**Insufficient Credits (Payment Request):**

```json
{
  "type": "pay_req",
  "x402Version": "1",
  "scheme": "evm",
  "networkId": "base",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "0.01",
  "payee": "0x...",
  "maxAmountRequired": "0.01",
  "validBefore": 1747856400,
  "validAfter": 1747852800,
  "payment-URL": "https://pay.oma-ai.com/x402/deposit?network=base&asset=USDC&return_to=..."
}
```

**WebSocket Error:**

```json
{
  "error": {
    "message": "Model 'invalid-model' not found",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

**Constraints:**

- Max message content size: 100KB
- Max messages per request: 100
- Max total request size: 1MB
- Connection timeout: 10 seconds (must authenticate)

---

### Authentication

#### Option 1: Wallet (SIWE)

1. Connect wallet (MetaMask, WalletConnect, etc.)
2. Sign SIWE message
3. Get session token
4. Use session to create API keys

#### Option 2: API Key (For API Usage)

1. After wallet connect, create API key
2. Use API key in `Authorization: Bearer <key>` header
3. Key format: `oma_sk_xxxxxxxxxxxx`

#### Option 3: Account Number (Mullvad-style)

For non-crypto users:

1. Create account number (Dashboard)
2. Login with account number
3. Same as wallet flow

#### Get SIWE Nonce

```http
POST /auth/nonce
Content-Type: application/json

{
  "address": "0x..."
}
```

**Response:**

```json
{
  "nonce": "abc123xyz..."
}
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
  "user": {
    "id": "user_xxx",
    "address": "0x...",
    "solanaAddress": null,
    "accountNumber": null,
    "createdAt": "2026-05-22T..."
  }
}
```

#### Solana Authentication

```http
POST /auth/solana/challenge
Content-Type: application/json

{
  "address": "SolanaAddress..."
}
```

**Response:**

```json
{
  "message": "Sign this message to authenticate with OMA..."
}
```

```http
POST /auth/solana/verify
Content-Type: application/json

{
  "address": "SolanaAddress...",
  "message": "Sign this message to authenticate with OMA...",
  "signature": "base64Signature..."
}
```

**Response:**

```json
{
  "token": "eyJhbG..."
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
  "address": "0x...",
  "balanceCents": 5000,
  "totalDeposited": 10000,
  "totalUsed": 5000,
  "sessionLimit": 10000,
  "sessionUsed": 500,
  "promoBalanceCents": 0
}
```

#### Create Account Number

```http
POST /auth/account/create
```

**Response:**

```json
{
  "accountNumber": "OMA-XXXX-XXXX-XXXX"
}
```

#### Login with Account Number

```http
POST /auth/account/login
Content-Type: application/json

{
  "accountNumber": "OMA-XXXX-XXXX-XXXX"
}
```

**Response:**

```json
{
  "token": "eyJhbG...",
  "address": "0x...",
  "hasApiKey": true
}
```

#### Get Current User

```http
GET /user
Authorization: Bearer <session_token>
```

**Response:**

```json
{
  "id": "user_xxx",
  "address": "0x...",
  "solanaAddress": "SolanaAddress...",
  "accountNumber": "OMA-XXXX-XXXX-XXXX",
  "createdAt": "2026-05-22T..."
}
```

#### Logout

```http
POST /auth/logout
Authorization: Bearer <session_token>
```

**Response:**

```json
{
  "success": true
}
```

---

### API Keys

#### List Keys

```http
GET /keys
Authorization: Bearer <session_token>
```

**Response:**

```json
{
  "keys": [
    {
      "id": "key_xxx",
      "name": "Production",
      "prefix": "oma_sk_xxxx",
      "createdAt": "2026-05-22T...",
      "lastUsedAt": "2026-05-22T..."
    }
  ]
}
```

#### Create Key

```http
POST /keys
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "name": "Production"
}
```

**Response:**

```json
{
  "id": "key_xxx",
  "name": "Production",
  "key": "oma_sk_xxxxxxxxxxxx",
  "prefix": "oma_sk_xxxx",
  "createdAt": "2026-05-22T...",
  "lastUsedAt": null
}
```

> **Important:** The full API key is only shown once at creation. Store it securely.

#### Delete Key

```http
DELETE /keys/:id
Authorization: Bearer <session_token>
```

**Response:**

```json
{
  "success": true
}
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
  "balanceCents": "5000"
}
```

#### Get Full Balance Details

```http
GET /v1/credits/balance
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "balanceCents": "5000",
  "totalDepositedCents": "10000",
  "totalUsedCents": "5000",
  "lastActivityAt": "2026-05-22T...",
  "activeBatches": [
    {
      "id": "batch_xxx",
      "amountCents": "5000",
      "remainingCents": "3000",
      "expiresAt": "2026-06-22T...",
      "paymentMethod": "usdc"
    }
  ]
}
```

#### Get Transactions

```http
GET /v1/credits/transactions?limit=50
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "transactions": [
    {
      "id": "dep_xxx",
      "type": "deposit",
      "amountCents": 10000,
      "creditsIssued": 10000,
      "status": "completed",
      "createdAt": "2026-05-22T...",
      "txHash": "0x..."
    },
    {
      "id": "use_xxx",
      "type": "usage",
      "model": "deepseek-v4-flash",
      "amountCents": 50,
      "status": "completed",
      "createdAt": "2026-05-22T..."
    }
  ]
}
```

#### Get Usage by Model

```http
GET /v1/credits/usage
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "usageByModel": [
    {
      "model": "deepseek-v4-flash",
      "inputTokens": 15000,
      "outputTokens": 5000,
      "totalCents": 175,
      "requestCount": 100
    }
  ],
  "totalUsageCents": 175
}
```

#### Get Price Estimate

```http
GET /v1/credits/price-estimate?model=deepseek-v4-flash&inputTokens=1000&outputTokens=500
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "model": "deepseek-v4-flash",
  "inputTokens": 1000,
  "outputTokens": 500,
  "estimatedCredits": 145,
  "pricePerMillionInput": 0,
  "pricePerMillionOutput": 0
}
```

#### Refund Usage

```http
POST /v1/credits/refund/:usageId
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "success": true,
  "creditsRefunded": 50
}
```

#### Purchase Credits

```http
POST /v1/credits/purchase
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "amountCents": 5000,
  "paymentMethod": "usdc",
  "autoReload": false
}
```

**Response:**

```json
{
  "success": true,
  "depositId": "dep_xxx",
  "status": "pending",
  "amountCents": 5000,
  "paymentMethod": "usdc",
  "autoReloadEnabled": false,
  "message": "Deposit created. Credits will be issued after payment confirmation."
}
```

#### Auto-Reload Settings

**Get Settings:**

```http
GET /v1/credits/auto-reload
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "enabled": true,
  "thresholdCents": 1000,
  "reloadAmountCents": 5000,
  "spendLimitCents": 50000,
  "paymentMethod": "usdc"
}
```

**Update Settings:**

```http
POST /v1/credits/auto-reload
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "enabled": true,
  "thresholdCents": 1000,
  "reloadAmountCents": 5000,
  "spendLimitCents": 50000,
  "paymentMethod": "usdc"
}
```

---

### Budget Alerts

#### Create/Update Budget Alert

```http
POST /v1/credits/budget-alerts
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "budgetLimitCents": 10000,
  "alertThresholds": ["50", "75", "90", "100"],
  "emailEnabled": true,
  "webhookEnabled": false,
  "webhookUrl": null
}
```

**Response:**

```json
{
  "success": true,
  "budgetLimitCents": 10000,
  "alertThresholds": [50, 75, 90, 100],
  "emailEnabled": true,
  "webhookEnabled": false,
  "webhookUrl": null
}
```

#### Get Budget Alert

```http
GET /v1/credits/budget-alerts
Authorization: Bearer <api_key>
```

#### Delete Budget Alert

```http
DELETE /v1/credits/budget-alerts
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "success": true
}
```

#### Get Budget Alert History

```http
GET /v1/credits/budget-alerts/history?limit=50
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "history": [
    {
      "alertType": "threshold_reached",
      "thresholdPercent": 75,
      "spentCents": 7500,
      "budgetLimitCents": 10000,
      "createdAt": "2026-05-22T..."
    }
  ]
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
  "amount": "1000000",
  "txHash": "0x..."
}
```

> **Note:** Amount is in the smallest unit (6 decimals for USDC).

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

#### OMA Token Deposit

```http
POST /v1/deposit/oma
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "amount": "1000000",
  "txHash": "0x..."
}
```

#### HoudiniSwap (Cross-Chain)

```http
POST /v1/deposit/houdini
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "fromCoin": "ETH",
  "amount": "1000000000000000000",
  "quoteId": "quote_xxx",
  "swapType": "SWAP"
}
```

**Response:**

```json
{
  "depositAddress": "0x...",
  "depositId": "houdini_xxx",
  "orderId": "order_xxx"
}
```

#### Get Supported Houdini Tokens

```http
GET /v1/deposit/houdini/tokens?blockchain=BASE
Authorization: Bearer <api_key>
```

**Response:**

```json
[
  {
    "id": "eth",
    "symbol": "ETH",
    "name": "Ethereum",
    "decimals": 18,
    "address": "0x...",
    "blockchain": "ethereum",
    "logoUrl": "https://..."
  }
]
```

#### Get Supported Houdini Chains

```http
GET /v1/deposit/houdini/chains
Authorization: Bearer <api_key>
```

#### Houdini Quote

```http
POST /v1/deposit/houdini/quote
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "fromToken": "ETH",
  "toToken": "USDC",
  "amount": "1000000000000000000",
  "swapType": "SWAP"
}
```

**Response:**

```json
[
  {
    "quoteId": "quote_xxx",
    "fromToken": "ETH",
    "toToken": "USDC",
    "fromAmount": "1000000000000000000",
    "toAmount": "2500000",
    "rate": "0.0025",
    "estimatedTime": 300,
    "swapType": "SWAP",
    "slippage": 0.5
  }
]
```

#### Complete Houdini Exchange

```http
POST /v1/deposit/houdini/exchange
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "quoteId": "quote_xxx",
  "fromCoin": "ETH",
  "fromAmount": "1000000000000000000",
  "refundAddress": "0x..."
}
```

**Response:**

```json
{
  "depositId": "houdini_xxx",
  "depositAddress": "0x...",
  "orderId": "order_xxx",
  "fromAmount": "1000000000000000000",
  "toAmount": "2500000",
  "status": "pending",
  "expiresAt": "2026-05-22T..."
}
```

#### Get Deposit Status

```http
GET /v1/deposit/status/:id
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "id": "dep_xxx",
  "type": "usdc",
  "status": "completed",
  "amountUsd": "10.00",
  "creditsIssued": "1000",
  "txHash": "0x...",
  "createdAt": "2026-05-22T...",
  "settledAt": "2026-05-22T..."
}
```

#### Get Pending Deposits

```http
GET /v1/deposit/pending
Authorization: Bearer <api_key>
```

#### Retry Failed Deposit

```http
POST /v1/deposit/:id/retry
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "success": true,
  "message": "Deposit retry initiated"
}
```

#### Get Deposit Notifications

```http
GET /v1/notifications
Authorization: Bearer <api_key>
```

---

### Jupiter (Solana Swap)

#### Get Jupiter Quote

```http
POST /v1/deposit/jupiter/quote
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "inputMint": "SOL",
  "outputMint": "USDC",
  "amount": "1000000000"
}
```

#### Complete Jupiter Deposit

```http
POST /v1/deposit/jupiter/complete
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "quoteId": "quote_xxx",
  "userPublicKey": "SolanaPublicKey..."
}
```

#### Execute Jupiter Swap Transaction

```http
POST /v1/deposit/jupiter/swap-tx
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "quoteId": "quote_xxx",
  "userPublicKey": "SolanaPublicKey..."
}
```

#### Direct SOL Deposit

```http
POST /v1/deposit/jupiter/direct-sol
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "amount": "1000000000"
}
```

#### List Jupiter Tokens

```http
GET /v1/deposit/jupiter/tokens
Authorization: Bearer <api_key>
```

#### Get Jupiter Token Price

```http
GET /v1/deposit/jupiter/price?mint=<token_mint>
Authorization: Bearer <api_key>
```

---

### Analytics

#### Get Usage Analytics

```http
GET /v1/analytics
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "totalRequests": 1523,
  "totalTokens": 2500000,
  "totalSpendCents": 1250,
  "requestsByModel": {
    "deepseek-v4-flash": 1000,
    "claude-opus-4-7": 523
  },
  "requestsOverTime": [
    {"date": "2026-05-22", "requests": 100}
  ]
}
```

#### Get Usage History

```http
GET /v1/usage
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "usage": [
    {
      "id": "use_xxx",
      "model": "deepseek-v4-flash",
      "promptTokens": 1500,
      "completionTokens": 250,
      "costCents": "0.45",
      "createdAt": "2026-05-22T..."
    }
  ]
}
```

---

### Webhooks

#### List Webhooks

```http
GET /v1/webhooks
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "subscriptions": [
    {
      "id": "wh_xxx",
      "url": "https://example.com/webhook",
      "event": "deposit.completed",
      "events": ["deposit.completed", "deposit.failed"],
      "active": true,
      "lastNotificationAt": "2026-05-22T...",
      "lastNotificationStatus": "200",
      "notificationCount": 10,
      "createdAt": "2026-05-22T..."
    }
  ]
}
```

#### Create Webhook

```http
POST /v1/webhooks
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "url": "https://example.com/webhook",
  "events": ["deposit.completed", "budget_alert.threshold_reached"],
  "secret": "webhook_secret_xxx"
}
```

**Response:**

```json
{
  "id": "wh_xxx",
  "success": true
}
```

#### Delete Webhook

```http
DELETE /v1/webhooks/:subscriptionId
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "success": true
}
```

**Webhook Events:**

| Event | Description |
|-------|-------------|
| `deposit.completed` | Deposit successfully settled |
| `deposit.failed` | Deposit failed or expired |
| `budget_alert.threshold_reached` | Budget threshold reached |
| `subscription.renewed` | Subscription renewed |
| `subscription.cancelled` | Subscription cancelled |

---

### Deposits Recovery

#### List Recoveries

```http
GET /v1/recoveries
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "recoveries": [
    {
      "id": "rec_xxx",
      "originalTxHash": "0x...",
      "recoveryTxHash": "0x...",
      "amountUsd": "10.00",
      "status": "completed",
      "rejectionReason": null,
      "createdAt": "2026-05-22T...",
      "completedAt": "2026-05-22T..."
    }
  ]
}
```

#### Initiate Recovery

```http
POST /v1/recoveries
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "wrongNetworkTxHash": "0x...",
  "recoveryTxHash": "0x..."
}
```

**Response:**

```json
{
  "success": true,
  "recoveryId": "rec_xxx",
  "creditsRecovered": 1000
}
```

#### Scan for Lost Deposits

```http
GET /v1/recoveries/scan?address=0x...
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "deposits": [
    {
      "txHash": "0x...",
      "amount": "10.00",
      "fromAddress": "0x...",
      "toAddress": "0x...",
      "blockNumber": "12345678",
      "timestamp": "2026-05-22T..."
    }
  ]
}
```

---

### Subscriptions

#### List Plans

```http
GET /v1/plans
```

**Response:**

```json
{
  "plans": [
    {
      "id": "plan_xxx",
      "name": "Pro",
      "priceCents": 2900,
      "requestsPerMonth": 10000,
      "features": ["priority_support", "advanced_models"]
    }
  ]
}
```

#### Subscribe to Plan

```http
POST /v1/subscriptions
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "planId": "plan_xxx",
  "paymentMethod": "usdc_base"
}
```

#### Get Current Subscription

```http
GET /v1/subscriptions/me
Authorization: Bearer <api_key>
```

#### Cancel Subscription

```http
DELETE /v1/subscriptions/me
Authorization: Bearer <api_key>
```

---

### Teams

#### Get Team

```http
GET /teams/:teamId
Authorization: Bearer <api_key>
```

#### List Team Members

```http
GET /teams/:teamId/members
Authorization: Bearer <api_key>
```

#### Add Team Member

```http
POST /teams/:teamId/members
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "address": "0x..."
}
```

---

### SSO

#### Create SSO Connection

```http
POST /sso/connections
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "teamId": "team_xxx",
  "provider": "okta",
  "domain": "example.com",
  "metadata": "..."
}
```

#### List SSO Connections

```http
GET /sso/connections/:teamId
Authorization: Bearer <api_key>
```

#### Delete SSO Connection

```http
DELETE /sso/connections/:connectionId
Authorization: Bearer <api_key>
```

#### SAML ACS (Assertion Consumer Service)

```http
POST /sso/saml/acs
Content-Type: application/x-www-form-urlencoded

SAMLResponse=<base64-encoded-saml-response>
```

#### SAML Metadata

```http
GET /sso/saml/metadata/:connectionId
```

---

### Onramp

#### Get Onramp Quote

```http
POST /v1/onramp/quote
Content-Type: application/json

{
  "fromToken": "USD",
  "toToken": "USDC",
  "fromAmount": "100"
}
```

**Response:**

```json
{
  "quoteId": "quote_xxx",
  "fromToken": "USD",
  "toToken": "USDC",
  "fromAmount": "100",
  "toAmount": "98.50",
  "rate": "0.985",
  "expiresIn": 300
}
```

#### Create Onramp Session

```http
POST /v1/onramp/session
Content-Type: application/json

{
  "quoteId": "quote_xxx",
  "address": "0x..."
}
```

---

### Queue

#### Get Queue Status

```http
GET /v1/queue/:jobId
Authorization: Bearer <api_key>
```

**Response:**

```json
{
  "jobId": "job_xxx",
  "status": "processing",
  "progress": 50,
  "estimatedCompletion": "2026-05-22T..."
}
```

#### List Pending Jobs

```http
GET /v1/queue
Authorization: Bearer <api_key>
```

---

### Staking

> **Note:** Staking endpoints are planned for a future release.

#### Get Stake Info (Planned)

```http
GET /v1/stake/info
Authorization: Bearer <api_key>
```

**Planned Response:**

```json
{
  "stakedAmount": "1000000000",
  "unstakedAmount": "500000000",
  "rewardsPerSecond": "1000",
  "totalStaked": "100000000000"
}
```

#### Stake/Unstake Tokens (Planned)

```http
POST /v1/stake
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "amount": "1000000000",
  "type": "stake"
}
```

**Note:** Use `type: "stake"` to stake tokens, `type: "unstake"` to initiate unstaking. Unstaked tokens require a 7-day cooldown before withdrawal.

#### Withdraw Unstaked Tokens (Planned)

```http
POST /v1/stake/withdraw
Authorization: Bearer <api_key>
```

---

### Admin API

> **Note:** Admin endpoints require admin privileges.

#### Get Stats

```http
GET /admin/stats
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "totalUsers": 1500,
  "totalApiKeys": 2000,
  "totalCreditsPurchased": 50000,
  "totalUsageThisMonth": 25000,
  "revenue": 45000,
  "activeUsersLast24h": 350,
  "providerCosts": {
    "venice": 30000,
    "openrouter": 15000
  }
}
```

#### List Users

```http
GET /admin/users?page=1&limit=50
Authorization: Bearer <admin_token>
```

#### Get User Detail

```http
GET /admin/users/:id
Authorization: Bearer <admin_token>
```

#### Get Usage Statistics

```http
GET /admin/usage?period=30d
Authorization: Bearer <admin_token>
```

#### Get Revenue Statistics

```http
GET /admin/revenue?period=30d
Authorization: Bearer <admin_token>
```

#### List API Keys

```http
GET /admin/keys?page=1&limit=100
Authorization: Bearer <admin_token>
```

---

## 4. Authentication

### Authentication Methods

OMA supports multiple authentication methods:

1. **SIWE (Sign-In With Ethereum)** - Web3 wallet authentication
2. **Solana** - Solana wallet authentication
3. **API Keys** - For programmatic access
4. **Account Numbers** - Mullvad-style anonymous accounts

### Session vs API Key

| Type | Usage | Lifespan |
|------|-------|----------|
| Session Token | Dashboard, account management | Persistent (until logout) |
| API Key | Direct API access | Persistent (until revoked) |

### Authentication Flow

```
1. User signs message with wallet
       ↓
2. Server validates signature
       ↓
3. Server issues session token or API key
       ↓
4. Use token/key for subsequent requests
```

---

## 5. Rate Limiting

### Default Limits

| Tier | RPM (Requests/Min) | TPM (Tokens/Min) |
|------|-------------------|------------------|
| Default | 60 | 120,000 |

### Rate Limit Headers

All API responses include rate limit information:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1747852900
X-RateLimit-Policy: token-bucket
X-RateLimit-Scope: session
```

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

**Response Headers:**

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1747852900
Retry-After: 30
```

### Rate Limit by Scope

**Session Scope:**

```
Session rate limit exceeded. Please try again later.
```

**Model Scope:**

```
Rate limit exceeded for model 'claude-opus-4-7'. Please try again later.
```

### Request Size Limits

| Limit | Value |
|-------|-------|
| Max request body | 10 MB |
| Max message content | 100 KB |
| Max messages per request | 100 |
| Max total message size | 1 MB |

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
   { quoteId, refundAddress? }

4. OMA returns deposit address
   { orderId, depositAddress, expiresAt }

5. Agent sends tokens to deposit address

6. Agent polls for settlement
   GET /v1/x402/deposit/:orderId/status

7. Once settled, agent calls inference with x402 headers
   POST /v1/x402/proxy/chat/completions
   X-Houdini-Order-Id: <orderId>
```

### Get Quote

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

### Create x402 Deposit

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

### Check x402 Deposit Status

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

**Status Values:**

| Status | Description |
|--------|-------------|
| `pending` | Order created, awaiting deposit |
| `deposit_received` | Tokens received at deposit address |
| `swapping` | Bridge/swap in progress |
| `settling` | Converting to USDC |
| `completed` | Credits issued to user |
| `expired` | Order expired |
| `failed` | Order failed |
| `refunded` | Refunded to user |

### x402 Proxy (Direct)

```http
POST /v1/x402/proxy/chat/completions
X-Houdini-Order-Id: order_xxx
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
  "messages": [{"role": "user", "content": "Hello"}]
}
```

### x402 Headers

For direct proxy requests:

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
- 20+ via HoudiniSwap

---

## 7. Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Human-readable error message",
    "type": "error_type",
    "code": "error_code"
  }
}
```

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid parameters or malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 402 | Payment Required | Insufficient credits or payment required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate operation or conflict |
| 413 | Payload Too Large | Request exceeds size limits |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Provider error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Types

| Type | Description |
|------|-------------|
| `invalid_request_error` | Malformed request or invalid parameters |
| `authentication_error` | Authentication failed |
| `expired_api_key` | API key has expired |
| `insufficient_quota` | Not enough credits |
| `rate_limit_error` | Rate limit exceeded |
| `rate_limit_exceeded` | Rate limit exceeded |
| `rate_limit_unavailable` | Rate limiting service unavailable |
| `spend_limit_exceeded` | Daily spend limit exceeded |
| `not_found` | Resource not found |
| `duplicate_refund` | Already refunded |
| `model_not_found` | Model doesn't exist |
| `timeout_error` | Connection timeout |
| `inference_error` | Inference provider error |
| `server_error` | Internal server error |
| `service_unavailable` | Service temporarily unavailable |

### Common Errors

**Insufficient Credits:**

```json
{
  "error": {
    "message": "Insufficient credits",
    "type": "insufficient_quota"
  }
}
```

**Invalid API Key:**

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error"
  }
}
```

**Expired API Key:**

```json
{
  "error": {
    "message": "API key expired",
    "type": "expired_api_key"
  }
}
```

**Rate Limit Exceeded:**

```json
{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

**Model Not Found:**

```json
{
  "error": {
    "message": "Model 'invalid-model' not found",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

**Request Too Large:**

```json
{
  "error": {
    "message": "Request body too large",
    "type": "invalid_request_error"
  }
}
```

**Message Content Too Long:**

```json
{
  "error": {
    "message": "Message content exceeds maximum length",
    "type": "invalid_request_error"
  }
}
```

### Provider Errors

When an inference provider fails, the error is propagated with a 502 status:

```json
{
  "error": {
    "message": "Inference provider error",
    "type": "inference_error"
  }
}
```

### x402 Errors

**Invalid Order ID:**

```json
{
  "error": {
    "message": "Invalid or expired x402 order",
    "type": "invalid_request_error"
  }
}
```

**Order Not Settled:**

```json
{
  "error": {
    "message": "Payment not yet settled",
    "type": "insufficient_quota"
  }
}
```

---

## 8. Testing Guide

### Health Check

```bash
curl http://localhost:3001/health
```

### Test Inference

```bash
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
cd server && npm test
cd app && npm run test
```

---

## 9. Example Code

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_your_key",
    base_url="http://localhost:3001/v1"
)

response = client.chat.completions.create(
    model="deepseek-v4-flash",
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

### JavaScript (WebSocket)

```javascript
const ws = new WebSocket('ws://localhost:3001/v1/chat/completions/ws', {
  headers: { 'Authorization': 'Bearer oma_sk_your_key' }
});

ws.on('open', () => {
  ws.send(JSON.stringify({
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'Count to 3' }],
    stream: true
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'chunk') {
    console.log(msg.delta);
  } else if (msg.type === 'done') {
    console.log('Stream complete');
    ws.close();
  }
});
```

### cURL

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
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

## 10. Model Pricing

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

## 11. Inference Providers

OMA routes to multiple AI providers with automatic failover. The system uses circuit breakers to route around failures.

### Available Providers

| Provider | Features | Models |
|----------|----------|--------|
| **Venice AI** | Primary provider, most models | 50+ models |
| **AntSeed** | Budget models, fast | DeepSeek, Qwen, Llama |
| **LiteLLM** | Unified API, 100+ models | OpenAI-compatible |
| **Together AI** | Open source models | Llama, Mistral, Qwen |
| **OpenRouter** | Model aggregation | 100+ models |
| **DeepInfra** | Fast inference | Llama, Mistral |
| **CheapTokens** | Budget provider | Token generation |
| **TinyFish** | Web search integration | Search-enhanced |

### Provider Failover Priority

1. Venice AI (primary)
2. AntSeed (backup)
3. LiteLLM (tertiary)
4. Together AI → OpenRouter → DeepInfra → CheapTokens (further backups)

### Circuit Breaker Configuration

| Provider | Error Rate Threshold | Recovery Time |
|----------|---------------------|---------------|
| Venice | 50% | 30s |
| AntSeed | 50% | 30s |
| LiteLLM | 60% | 60s |

When a provider's error rate exceeds the threshold, the circuit breaker opens and requests are routed to the next available provider.

---

*Permissionless inference. Pay with crypto. No account required.*
