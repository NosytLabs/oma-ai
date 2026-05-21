# OMA Phase 2 Plan

**Phase:** 2 (Post-MVP)  
**Status:** Mostly Complete  
**Target:** Q2 2026 (MVP achieved)

---

## Overview

Phase 2 adds staking, cross-chain coin deposits, and x402-native payments to OMA. This enables:
- OMA token holders to stake for discounted inference
- Users to deposit USDC/SOL directly without HoudiniSwap
- Autonomous agents to pay per-request via x402

---

## Features

### 1. OMA Token Staking

**Purpose:** Reward OMA holders with discounted API access

**Mechanics:**
```
User stakes OMA tokens ──▶ Receives xOMA (veOMA-like)
                            │
                            ├── 1% discount per 100 OMA staked
                            ├── Staking duration bonus (up to 2x)
                            └── Governance voting rights
```

**Contracts:**
| Contract | File | Purpose |
|----------|------|---------|
| `OMA.sol` | contracts/OMA.sol | ERC20 token |
| `xOMA.sol` | contracts/xOMA.sol | Staked token (veOMA) |
| `OMADeposit.sol` | contracts/OMADeposit.sol | Deposit vault |

**API Endpoints:**
- `POST /v1/stake` - Stake OMA, receive xOMA
- `POST /v1/unstake` - Unstake OMA (withdraw)
- `GET /v1/stake/info` - Staking APR, user's position

**Discount Tiers:**
| OMA Staked | Discount |
|------------|----------|
| 100+ | 1% |
| 1,000+ | 5% |
| 10,000+ | 15% |
| 100,000+ | 30% |

---

### 2. Coin Deposits (USDC, SOL)

**Purpose:** Direct deposit without cross-chain swaps

#### USDC Deposit (Base)

```
User sends USDC to OMA treasury
        │
        ▼
Backend monitors Base USDC transfers
        │
        ▼
On deposit: Credit user's account 1:1
        │
        ▼
User can call inference
```

**Implementation:**
- `contracts/OMADeposit.sol` accepts USDC transfers
- Backend monitors `Transfer` events
- Credits issued on confirmed transfer

#### Solana x402 & Solana USDC Payments

```
User/Agent requests completions
        │
        ▼
Server replies with 402 Payment Required
        │
        ▼
User sends Solana USDC to OMA payee wallet
        │
        ▼
Server verifies SPL transaction on Solana RPC
        │
        ▼
Server settles payment & streams response
```

**API Endpoints:**
- `POST /x402/verify` - Verify Solana payment signature
- `POST /x402/settle` - Settle verified payment
- `POST /v1/x402/quote` - Get cross-chain swap quote
- `POST /v1/x402/deposit` - Create cross-chain swap deposit
- `GET /v1/x402/deposit/:orderId/status` - Check swap status

---

### 3. CCTP Integration (Circle Cross-Chain Transfer)

**Purpose:** Native USDC bridging from any CCTP-supported chain

**Supported Chains:**
- Ethereum
- Avalanche
- Optimism
- Arbitrum
- Polygon
- Base

**Flow:**
```
User (any CCTP chain) ──▶ CCTP attestation ──▶ USDC on Base
                                                  │
                                                  ▼
                                           Credit user's account
```

**Implementation:**
- Use Circle's CCTP SDK
- Verify attestations on-chain
- Issue credits on USDC receipt

**API Endpoints:**
- `POST /v1/deposit/cctp` - Get CCTP deposit instructions
- `GET /v1/deposit/cctp/:attestation` - Verify attestation

---

### 4. HoudiniSwap Integration

**Purpose:** Deposit from 20+ chains beyond CCTP

**Supported Chains:**
- BTC, ETH, SOL, TRX, BNB
- XMR, ADA, DOT, AVAX, MATIC
- And 10+ more

**Flow:**
```
User selects chain + token in frontend
        │
        ▼
Backend calls HoudiniSwap API for quote
        │
        ▼
User sends to HoudiniSwap deposit address
        │
        ▼
HoudiniSwap swaps to USDC on Base
        │
        ▼
OMA webhook receives settlement
        │
        ▼
Credits issued
```

**API Endpoints:**
- `POST /v1/x402/quote` - Get cross-chain quote
- `POST /v1/x402/deposit` - Create HoudiniSwap order
- `GET /v1/x402/deposit/:orderId/status` - Check status

**Webhook:**
- Endpoint: `POST /v1/deposit/houdini/webhook`
- Verify: HMAC-SHA256 signature
- Idempotent: Duplicate webhooks handled

---

### 5. x402 Native Payments

**Purpose:** Agent-native payments without pre-funded accounts

**Flow:**
```
Agent requests quote
        │
        ▼
OMA returns deposit address + expected amount
        │
        ▼
Agent sends tokens to address
        │
        ▼
OMA verifies (webhook or polling)
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

**Receipt Format:**
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
- `POST /v1/x402/verify` - Verify x402 payment
- `POST /v1/x402/settle` - Settle payment
- `POST /v1/x402/proxy/chat/completions` - Direct inference with receipt

---

## Implementation Order

### Step 1: USDC Direct Deposit
- [x] Deploy `OMADeposit.sol`
- [x] USDC transfer monitoring via Base RPC
- [x] Credit on confirmed transfer

### Step 2: Solana x402 & Solana USDC Streaming
- [x] Solana SPL USDC transfer monitoring via RPC
- [x] x402 facilitator verification endpoint (`/x402/verify`) supporting Solana signatures
- [x] Cross-chain x402 swap routing via HoudiniSwap (Solana to Base USDC)
- [x] Pay-as-you-go stream settlements (`/x402/settle`)

### Step 3: OMA Staking (Pending)
- [ ] Deploy `xOMA.sol` on Base
- [ ] Add staking/unstaking endpoints
- [ ] Calculate discount tiers
- [ ] Apply discount to inference pricing

### Step 4: CCTP Integration (Pending)
- [ ] Integrate Circle CCTP SDK
- [ ] Add attestation verification
- [ ] Credit on USDC receipt

### Step 5: HoudiniSwap Integration
- [x] Integrate HoudiniSwap API (partner)
- [x] Quote/deposit endpoints
- [x] Webhook signature verification
- [x] Credit on settlement

### Step 6: x402 Native Payments
- [x] Receipt generation (HMAC-SHA256)
- [x] Receipt verification
- [x] Proxy inference with receipt (x402 direct)
- [ ] WebSocket notifications for real-time settlement

---

## Environment Variables

```env
# Existing
DATABASE_URL=postgresql://...
VENICE_API_KEY=sk-...

# New Phase 2
OMA_TOKEN_ADDRESS=0x...           # OMA token on Base
XOMA_TOKEN_ADDRESS=0x...        # xOMA token on Base
USDC_TOKEN_ADDRESS=0x...         # USDC on Base
CIRCLE_API_KEY=...               # CCTP attestation
HOUDINI_API_KEY=...              # HoudiniSwap
HOUDINI_WEBHOOK_SECRET=...      # Webhook verification
```

---

## Testing

### Unit Tests
```bash
cd server
npm test
```

### Integration Tests
```bash
# Test deposit flow
npm run test:deposit

# Test x402 flow
npm run test:x402

# Test crosschain flow
npm run test:crosschain
```

### Test Scenarios
1. Deposit USDC directly to treasury
2. Deposit SOL to Solana wallet
3. Stake OMA, verify xOMA balance
4. Cross-chain deposit via HoudiniSwap
5. x402 receipt-based inference
6. Discount applied for stakers

---

## Risk Mitigation

### Settlement Risk
- Use credit-proxy pattern: provisional credits, reconcile on settlement
- Circuit breaker for slow settlements
- Timeout after 1 hour: refund or dispute

### Front-Running
- Quote prices expire in 60 seconds
- Per-order deposit addresses (no reuse)
- Slippage allowance in quotes

### Smart Contract Risk
- Audit `OMA.sol`, `xOMA.sol`, `OMADeposit.sol`
- Time-lock on admin functions
- Multi-sig for treasury operations

---

## Dependencies

| Service | Purpose | Cost |
|---------|---------|------|
| Circle CCTP | USDC bridging | Free (attestations) |
| HoudiniSwap | Cross-chain swaps | ~1% fee |
| Solana RPC | SOL deposits | Free (public) |
| Base RPC | USDC monitoring | Free (public) |

---

*Phase 2 transforms OMA from a simple AI gateway to a full-featured Web3 AI platform with staking, cross-chain deposits, and agent-native payments.*