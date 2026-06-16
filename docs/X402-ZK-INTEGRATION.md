> **⚠️ VISION DOCUMENT: These features are not yet implemented.**  
> This document describes the intended future architecture for ZK-based x402 payments.  
> Currently, x402 uses basic EVM signature verification.  
> ZK proof verification, Lemma SDK, and Groth16 are not yet integrated.

# x402 + ZK Integration Guide

**OMA's Agent-Native Payment Protocol with Zero-Knowledge Verification**

---

## Table of Contents

1. [Overview](#1-overview)
2. [x402 Protocol Stack](#2-x402-protocol-stack)
3. [ZK Proof Implementations](#3-zk-proof-implementations)
4. [Privacy Features](#4-privacy-features)
5. [MPC Operators and Groth16 Proofs](#5-mpc-operators-and-groth16-proofs)
6. [TAO Subnets Integration](#6-tao-subnets-integration)
7. [API Integration Examples](#7-api-integration-examples)
8. [Configuration](#8-configuration)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

OMA implements a **5-layer x402 protocol stack** that enables AI agents to transact autonomously while preserving privacy through zero-knowledge proofs:

```
┌─────────────────────────────────────────────────────────────┐
│                    x402 Protocol Stack                      │
├─────────────────────────────────────────────────────────────┤
│  Identity  │ Payments  │ Compute  │ Intelligence  │ Coordination │
│    DID     │   x402    │ AI Inf.  │   TAO/RoBERTa │ Agents/Economy│
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **500K+ AI agent wallets** on x402 protocol
- **ZK-verified payments** with selective disclosure
- **Privacy-preserving agentic economy**
- **Cross-chain settlement** on Base L2 and multiple networks

---

## 2. x402 Protocol Stack

### Layer 1: Identity

Agent DID (Decentralized Identifier) binding with role attributes:

```
Agent Identity Flow:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Create DID     │───▶│  Prove Role     │───▶│  Enforce Policy │
│ (Lemmasdk)      │    │ (Groth16 ZK)    │    │ (On-chain)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Supported Identity Providers:**
- Self.xyz for identity verification
- Worldcoin for biometric verification
- zkPassport for government ID verification
- Custom DID methods via Lemma SDK

### Layer 2: Payments

x402 + ZK payment flows:

```
Payment Flow Options:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Credit-Based │    │ x402 Direct  │    │ Cross-Chain  │
│ (pre-fund)   │    │ (per-req)    │    │ (quote+pay)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Layer 3: Compute

AI inference routing with ZK-verified compute attribution:

- Venice AI (primary)
- AntSeed (backup)
- LiteLLM (unified API)
- Trust402-verified compute certificates

### Layer 4: Intelligence

Bittensor subnet integration for TAO token economy:

- Subnet 1 (Tao.ai) for language models
- Subnet 34 (Chutes.ai) for fast inference
- TAO reward distribution based on usage

### Layer 5: Coordination

Agent-to-agent coordination protocols:

- Multi-agent workflow orchestration
- ZK-verified agent reputation
- Decentralized credit scoring

---

## 3. ZK Proof Implementations

### zkX402

Variable payments with ZK metadata verification:

```
zkX402 Flow:
1. Client requests quote with ZK eligibility proof
2. Server returns cost-adjusted quote (verified parties get discounts)
3. Client pays USDC on Base
4. Server generates ZK receipt for audit trail
5. Client calls inference with ZK receipt header
```

**ZK Metadata Attributes:**
```typescript
interface ZkX402Metadata {
  // Payment attributes
  amount: bigint;          // Verified payment amount
  recipient: string;       // Verified recipient address
  timestamp: number;       // Verified time window
  
  // Identity attributes (selectively disclosed)
  role?: string;           // "premium_user", "verified_agent", etc.
  discount?: number;       // Eligibility-based discount (0-50%)
  
  // Content attributes (optional)
  author?: string;         // Content originator (DID)
  contentHash?: string;    // SHA-256 hash of request payload
}
```

### Trust402

Agent identity, role, and budget enforcement via ZK proofs:

```
Trust402 Flow:
1. Agent generates role proof: Lemma SDK `agent-identity-v1`
2. Proof includes: role, spendLimit, identity (DID)
3. Server verifies ZK proof before processing
4. Budget constraints enforced cryptographically
5. Payment processed with proof-before-payment pattern
```

**Trust402 Proof Structure:**
```typescript
interface Trust402Proof {
  proof: string;           // Groth16 proof (BN254 curve)
  publicInputs: {
    role: string;          // Role hash (e.g., "premium_user")
    spendLimit: bigint;    // Maximum spend allowed
    identity: string;      // DID commitment
    timestamp: number;     // Valid timestamp range
  };
  signature?: string;      // ECDSA signature (optional for additional security)
}
```

### Lemma × x402

Content integrity and attribution via Poseidon Merkle commitments:

```
Lemma Flow:
1. Content hashed with Poseidon (Merkle-friendly hash)
2. Commitment root stored in Merkle tree
3. ZK proof generated for content attributes
4. Payment settlement via CDP facilitator
5. BBS+ selective disclosure for privacy
```

**Lemma Attributes:**
```typescript
interface LemmaAttributes {
  author: string;          // DID of content creator
  date: string;            // ISO timestamp
  integrity: string;       // SHA-256 of content hash
  signature?: string;        // Optional additional signature
}
```

---

## 4. Privacy Features

### Selective Disclosure

Reveal only necessary attributes while preserving privacy:

```
Privacy Levels:
┌─────────────────────────────────────────────────────────────┐
│ Full Anonymity      │  Selective Disclosure  │  Full Reveal │
├─────────────────────┼────────────────────────┼──────────────┤
│ No identity reveal  │ Only amount/recipient    │ Full details │
│ Payment only        │ Budget verification      │              │
│ ZK proof required   │ ZK proof + attributes  │              │
└─────────────────────────────────────────────────────────────┘
```

### Zero-Knowledge Verification

```
ZK Verification Process:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Generate Proof │───▶│  Verify Proof   │───▶│  Process Payment │
│ (Client)        │    │ (Server)        │    │ (Facilitator)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
  Circom circuit        Verify proof on     Payment settles with
  Groth16 proving       BN254 curve         ZK-verified receipt
```

### Privacy-Preserving Agent Economy

Agents can transact while maintaining:

- **Anonymous identity** - No wallet linkage required
- **Budget privacy** - Prove spend limits without revealing total balance
- **Content privacy** - Prove content validity without revealing content
- **Timing privacy** - Request batching to obscure individual requests

---

## 5. MPC Operators and Groth16 Proofs

### Multi-Party Computation (MPC)

Scalable ZK proof generation through distributed operators:

```
MPC Operator Network:
┌─────────────────────────────────────────────────────────────┐
│  Operator 1  │  Operator 2  │  Operator 3  │  Operator N     │
│  (AWS)       │  (GCP)       │  (Azure)     │  (Edge Nodes)   │
├───────────────┼──────────────┼──────────────┼─────────────────┤
│ Contribute    │ Contribute   │ Contribute   │ Generate Proof  │
│ to witness    │ to witness   │ to witness   │ Share network   │
└─────────────────────────────────────────────────────────────┘
```

### Groth16 Proof System

Efficient zk-SNARK verification for agent authentication:

```
Groth16 Properties:
- Proof size: ~192 bytes
- Verification time: ~10ms
- Trusted setup: Universal (Plonk-friendly)
- Curve: BN254 (Ethereum compatible)
```

**Proof Generation Flow:**
```typescript
// 1. Define circuit constraints
template ZkPayment() {
  signal input amount;
  signal input recipient;
  signal input spendLimit;
  signal input timestamp;
  
  signal output isValid;
  
  // Constraint: amount <= spendLimit
  signal check = spendLimit - amount;
  check ==> isValid;
}

// 2. Generate witness
// 3. Create proof (MPC operators)
// 4. Verify on-chain / server
```

### Verification Endpoints

```
POST /v1/x402/verify
{
  "proof": "0x...",           // Groth16 proof bytes
  "publicInputs": {
    "amount": "1000000",
    "recipient": "0x...",
    "spendLimit": "10000000",
    "timestamp": 1747852800
  },
  "scheme": "trust402"
}
```

---

## 6. TAO Subnets Integration

### Bittensor Subnet Support

Integration with TAO token economy for decentralized AI:

```
TAO Integration Flow:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  TAO Staking    │───▶│  Subnet Query   │───▶│  Attribution    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
  Stake TAO for      Query subnet for       ZK proof of
  service access       verified models        subnet usage
```

### Supported Subnets

| Subnet | Purpose | Integration |
|--------|---------|-------------|
| Subnet 1 | Language models | Text completion |
| Subnet 34 | Fast inference | Low-latency queries |
| Subnet 9 | Image generation | Stable diffusion models |
| Custom | Agent-specific | Role-based routing |

### TAO Reward Distribution

```
Rewards Flow:
1. Agent completes inference via x402
2. Usage recorded with ZK proof
3. Credits to TAO staking pool
4. Subnet miners rewarded in TAO
5. ZK receipt proves valid attribution
```

---

## 7. API Integration Examples

### Example 1: Basic x402 Payment

```typescript
// Get quote
const quote = await fetch('https://api.oma-ai.com/v1/x402/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    inputTokens: 1000,
    outputTokens: 500,
    sourceChain: 'base',
    sourceAsset: 'USDC'
  })
});

// Create deposit
const deposit = await fetch('https://api.oma-ai.com/v1/x402/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quoteId: quote.data.quoteId,
    refundAddress: '0x...'
  })
});
```

### Example 2: Trust402 with Role Verification

```typescript
import { generateTrust402Proof } from '@lemma/zk-sdk';

// Generate ZK proof for role verification
const proof = await generateTrust402Proof({
  role: 'verified_agent',
  spendLimit: 10000000, // 10 USDC in cents
  identity: agentDid,
  timestamp: Date.now()
});

// Include proof in payment
const verify = await fetch('https://api.oma-ai.com/v1/x402/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-ZK-Proof': proof.proof,
    'X-ZK-Scheme': 'trust402'
  },
  body: JSON.stringify({
    orderId: deposit.orderId,
    amount: 145,
    recipient: treasuryAddress
  })
});
```

### Example 3: zkX402 with Selective Disclosure

```typescript
import { generateZkX402Proof } from '@lemma/zk-sdk';

// Generate proof with selective disclosure
const proof = await generateZkX402Proof({
  amount: 145,
  recipient: treasuryAddress,
  attributes: {
    role: 'premium_user',     // Revealed (for discount)
    identity: agentDid,       // Revealed (for attribution)
    // Other attributes remain private
  }
});

// Make inference request with ZK receipt
const response = await fetch('https://api.oma-ai.com/v1/x402/proxy/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'X-ZK-Receipt': proof.receipt,
    'X-Payment-Signature': signature
  },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
```

### Example 4: Cross-Chain with ZK Proof

```typescript
// Get cross-chain quote
const quote = await fetch('https://api.oma-ai.com/v1/x402/quote', {
  method: 'POST',
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    inputTokens: 5000,
    outputTokens: 2000,
    sourceChain: 'ethereum',
    sourceAsset: 'ETH',
    zkProof: {
      type: 'lemma_x402',
      proof: generateCrossChainProof({
        budget: 100, // USD budget limit
        identity: agentDid
      })
    }
  })
});

// Complete transaction
const tx = await wallet.sendTransaction({
  to: quote.data.depositAddress,
  value: quote.data.fromAmount
});
```

---

## 8. Configuration

### Server Configuration (.env)

```env
# x402 Facilitator Configuration
FACILITATOR_MODE=live              # "mock" for development, "live" for production
FACILITATOR_PRIVATE_KEY=0x...    # EVM key for x402 settlement signing

# Surplus Provider (ZK-enabled x402 settlement)
SURPLUS_WALLET_PRIVATE_KEY=0x...
SURPLUS_SETTLEMENT_CONTRACT=0x0770d2124C0a581C28Cfc47a659817145e6Cc137
SURPLUS_PERMIT2_CONTRACT=0x000000000022D473030F116dDEE9F6B43aC78BA3
SURPLUS_USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
SURPLUS_VERIFIER_CONTRACT=0x...     # Legacy EIP-712 verifier
SURPLUS_DEFAULT_SCHEME=upto         # "upto" or "exact"

# ZK Proof Configuration
# ZK_PROOF_VERIFIER_URL=https://proof.oma-ai.com/verify
# ZK_PROOF_GENERATOR_TIMEOUT_MS=30000

# Base Chain Configuration
BASE_CHAIN_ID=8453                 # Base mainnet (84532 for Sepolia)
```

### ZK Proof Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SURPLUS_DEFAULT_SCHEME` | `upto` | Payment scheme (exact/shielded) |
| `SURPLUS_MIN_DISCOUNT_PCT` | `0` | Minimum discount for verified agents |
| `SURPLUS_CHAIN_ID` | `8453` | Chain for x402 settlement |

---

## 9. Troubleshooting

### Common Issues

**"Invalid ZK proof" error**
- Verify proof is generated with correct circuit parameters
- Check that public inputs match proof commitments
- Ensure proof is on BN254 curve

**"Proof verification timeout"**
- ZK proof generation can take 5-30 seconds
- Set `FACILITATOR_MODE=mock` for faster dev iteration
- Consider MPC operator timeouts

**"Cross-chain settlement delayed"**
- CEX routes: 15-45 minutes for compliance
- DEX routes: 30 seconds - 2 minutes
- Bridge routes: 5-30 minutes

**Rate limiting with x402**
- x402 requests may have different rate limits
- ZK verification adds ~10ms overhead per request
- Consider caching verified proofs for same-user requests

### Debug Mode

```bash
# Enable detailed logging
DEBUG_ZK_PROOFS=true
DEBUG_X402_FLOW=true

# Test with mock facilitator
FACILITATOR_MODE=mock npm run dev
```

---

## See Also

- [API Documentation](API-DOCUMENTATION.md#6-x402-payments) - Complete API reference
- [Developer Guide](DEVELOPER-GUIDE.md) - Integration walkthrough
- [OMA Architecture](OMA-X402-CROSSCHAIN-ARCHITECTURE.md) - System architecture