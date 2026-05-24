# OMA Cross-Chain x402 Architecture

## Overview

OMA acts as an **x402 facilitator** that bridges HoudiniSwap's 20+ supported chains into the x402 payment ecosystem. This enables AI inference access from any chain HoudiniSwap supports -- not just Base and Solana.

**Flow:** User (any chain) -> HoudiniSwap -> OMA Facilitator -> x402 Settlement -> AI Inference

## Competitive Landscape

| Project | Cross-Chain | Settlement | Privacy | Chains |
|---------|------------|------------|---------|--------|
| Router402 (ETHGlobal) | Li.Fi (DEX-only) | Base + Flashblocks | Low | EVM L2s |
| mitgajera/x402-ai | None (Solana-native) | Solana | Low | Solana |
| **OMA** | **HoudiniSwap (CEX+DEX)** | **Base + Solana** | **High** | **20+ incl BTC, Tron, XMR** |

### OMA Differentiation
- **Privacy**: HoudiniSwap CEX/DEX aggregation offers different privacy guarantees than Li.Fi pure DEX
- **Chain coverage**: BTC, Tron, XMR, other L1s not served by Li.Fi
- **Compliance**: HoudiniSwap compliance tooling for regulated users
- **Settlement flexibility**: Settles on Base OR Solana (dual-chain)

## Architecture

```
                    HoudiniSwap          OMA Facilitator
User (any chain) ------> Deposit Address -----> Verify & Settle
         |                    |                      |
         |                    v                      v
         |              Swap to USDC            Generate x402
         |              on Base/Solana           Receipt
         |                    |                      |
         |                    v                      v
         |              Webhook/Poll           Proxy to Inference
         |              confirmation           (Venice/AntSeed)
         |                                           |
         v                                           v
    Pay in BTC,     ----> Credits Issued ----> Stream Response
    ETH, SOL, XMR,        (PostgreSQL)        back to User
    TRX, BNB, etc
```

## Payment Flows

### Flow 1: Credit-Based (Existing, Enhanced)
User deposits via HoudiniSwap -> swap settles -> credits issued -> user calls inference with API key (Bearer token) -> credits deducted per token.

### Flow 2: x402 Direct (New)
User sends x402 PAYMENT-SIGNATURE header with HoudiniSwap order reference -> facilitator verifies deposit settled -> generates x402 receipt -> proxies inference request -> streams response.

This enables **agent-native payments** where autonomous agents pay per-request without pre-funded accounts.

### Flow 3: Cross-Chain Quote + Pay (New)
1. Agent requests quote: `POST /v1/x402/quote`
2. OMA returns: total cost in source token (inference fee + HoudiniSwap fee + facilitator margin)
3. Agent creates deposit: `POST /v1/x402/deposit` with quoteId
4. OMA returns: HoudiniSwap deposit address + orderId
5. Agent sends tokens to deposit address
6. Agent polls: `GET /v1/x402/deposit/:orderId/status`
7. On settlement: OMA issues credits or generates x402 receipt
8. Agent calls inference with receipt

## Key Design Decisions

### Settlement Token
- **Primary**: USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- **Secondary**: USDC on Solana (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)

### Price Quoting
Total cost = inference_estimate_usd + houdini_routing_fee + facilitator_margin
- Inference estimate: model pricing x tokens (existing getModelPricing)
- HoudiniSwap fee: from quote response (fee field)
- Facilitator margin: 1.5% (covers swap risk + settlement delay)

### Settlement Timing
- **DEX route**: ~30 seconds to 2 minutes
- **CEX route (private)**: 15-45 minutes
- **Bridge route**: 5-30 minutes

### Escrow Strategy
For x402 direct flow, the facilitator **does not forward the request** until HoudiniSwap settlement confirms. Two options:
1. **Wait-on-settle**: Block the request until deposit confirms (slow but safe)
2. **Credit-proxy**: Issue provisional credits, deduct on actual usage, reconcile on settlement

OMA uses **credit-proxy** (Flow 1) for the MVP. Flow 2 (x402 direct) uses wait-on-settle with 30-second polling.

### Receipt Verification
When a HoudiniSwap deposit settles:
1. Verify `Order.status === "FINISHED"`
2. Verify `Order.toAmount` >= expected
3. Verify `Order.addressTo` === OMA treasury
4. Generate HMAC-SHA256 receipt: `receipt = HMAC(orderId:toAmount:networkId:payee:timestamp)`
5. Store in settlement cache

## API Endpoints

For complete API endpoint documentation, see [API-DOCUMENTATION.md](API-DOCUMENTATION.md#6-x402-payments).

### Quick Reference

| Endpoint | Description |
|----------|-------------|
| `POST /v1/x402/quote` | Get payment quote for cross-chain |
| `POST /v1/x402/deposit` | Create x402 deposit |
| `GET /v1/x402/deposit/:orderId/status` | Check deposit status |
| `POST /x402/verify` | Verify payment receipt |
| `POST /x402/settle` | Settle payment |
| `POST /v1/x402/proxy/chat/completions` | Direct proxy with x402 headers |

## Security Considerations

### Deposit Verification
- Always verify HoudiniSwap order status via API (not user-claimed)
- Check `addressTo` matches OMA treasury
- Verify `toAmount` >= expected (not just > 0)
- HMAC receipt prevents tampering

### Webhook Security
- HMAC-SHA256 signature verification on all HoudiniSwap webhooks
- Timing-safe comparison (already implemented)
- Idempotency: duplicate webhook -> idempotent 200

### Race Conditions
- Database-level `FOR UPDATE` on deposit completion
- Settlement cache prevents double-crediting
- `preflightDeduction` is atomic

### Front-Running
- Quote prices include expiry (60 seconds)
- Deposit addresses are per-order (not reused)
- Facilitator margin covers slippage

## Implementation Phases

1. **Phase 1 (MVP)**: Quote -> Deposit -> Settlement -> Credits
2. **Phase 2**: x402 direct proxy with wait-on-settle
3. **Phase 3**: WebSocket subscriptions for real-time settlement notifications
4. **Phase 4**: AntSeed P2P payment channels for sub-second settlement
