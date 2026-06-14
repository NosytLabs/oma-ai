import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

const BODY = `# OMA AI Gateway

> Permissionless AI inference gateway. Pay with crypto, use 19+ models via OpenAI-compatible API. x402 protocol settlement in USDC on Base. No accounts required.

## Getting Started
- [API Documentation](https://oma-ai.com/docs) - Complete API reference
- [Playground](https://oma-ai.com/playground) - Interactive API testing
- [Pricing](https://oma-ai.com/pricing) - Model pricing and tiers
- [Model Catalog](https://oma-ai.com/models) - 19+ AI models catalog
- [Deposits](https://oma-ai.com/deposit) - Add credits via crypto (USDC, HoudiniSwap, CCTP, LiFi)
- [Dashboard](https://oma-ai.com/dashboard) - Usage and API keys

## API Reference
- [Authentication](https://oma-ai.com/docs#authentication) - SIWE, API keys, x402
- [Chat Completions](https://oma-ai.com/docs#chat-completions) - OpenAI-compatible inference
- [Web Search](https://oma-ai.com/docs#web-search) - Real-time web search with streaming
- [Web Fetch](https://oma-ai.com/docs#web-fetch) - Web page scraping
- [Video Generation](https://oma-ai.com/docs#video-generation) - AI video creation
- [x402 Payments](https://oma-ai.com/docs#x402-payments) - Per-request crypto payments
- [Teams API](https://oma-ai.com/docs#teams-api) - Multi-wallet team management
- [SSO/SAML](https://oma-ai.com/docs#sso-saml-api) - Enterprise single sign-on
- [Credits](https://oma-ai.com/docs#credits--balance) - Balance, transactions, auto-reload
- [Admin API](https://oma-ai.com/docs#admin-api) - User management and analytics
- [Privacy Manifest](https://oma-ai.com/api/v1/privacy) - JSON: what is and isn't stored

## Deposits (Cross-Chain)
OMA supports multiple deposit methods:
- **USDC Direct** - Base and Solana
- **HoudiniSwap** - Cross-chain swaps from 20+ chains
- **CCTP** - Circle's Cross-Chain Transfer Protocol
- **LiFi** - Multi-chain bridging
- **Onramp** - Fiat to credits conversion

## x402 Payment Flow
1. Request quote: \`POST /v1/x402/quote\`
2. Create deposit: \`POST /v1/x402/deposit\`
3. Send tokens to deposit address
4. Poll status: \`GET /v1/x402/deposit/:orderId/status\`
5. Use proxy: \`POST /v1/x402/proxy/chat/completions\`

## Inference Sourcing
OMA is a multi-provider AI gateway. The provider mix is chosen per-model for best price/quality. Operator-internal procurement is described for transparency.

### Primary Provider: Venice AI
- **Role**: Primary inference for most models.
- **Pricing**: Charged per-token at Venice's published rates.
- **Markup**: OMA adds a default 25% markup (configurable via OMA_MARKUP_PCT) on top of Venice's cost. Staking discounts apply on top.
- **Sourcing**: OMA leases a small pool of Venice API keys from CheapTokens.ai and rotates through them to stay under per-key RPS limits.

### Procurement: CheapTokens.ai
- **Role**: Operator-internal procurement of Venice API credits at a discount (typically 40-60% off).
- **Mechanism**: USDC payment on Base, then CheapTokens issues a short-lived Venice API key (default 24h).
- **Volume**: OMA tops up the pool every 15 minutes when below the 3-key floor and only when the upstream discount is >= 40%.
- **Circuit-breaker**: After 3 consecutive refresh failures, the buyer is paused for 60s to avoid burning USDC on doomed requests.
- **User impact**: None directly. Users only see Venice-served responses; CheapTokens is invisible at the request hot path.

### Procurement: Surplus Intelligence
- **Role**: Fallback procurement when CheapTokens is sold out or its discount drops below the floor.
- **Mechanism**: x402 protocol — the request returns HTTP 402 with a payment envelope; OMA signs an EIP-712 authorization and retries with \`PAYMENT-SIGNATURE\`.
- **x402 schemes** (per surplusintelligence.ai/llms.txt, 2026-06-12):
  - \`upto\` — uses Permit2 \`PermitWitnessTransferFrom\` typed data. EIP-712 domain \`{ name: "Permit2", chainId: 8453, verifyingContract: 0x000000000022D473030F116dDEE9F6B43aC78BA3 }\`.
  - \`exact\` — uses EIP-3009 \`TransferWithAuthorization\` typed data. EIP-712 domain \`{ name: "USD Coin", version: "2", chainId: 8453, verifyingContract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 }\` (USDC on Base).
  - Settlement proxy / EIP-712 verifyingContract: \`0x0770d2124C0a581C28Cfc47a659817145e6Cc137\` on Base (chain id 8453). The treasury/payTo address is \`0x8581784D3E598cCa3482375CFF2409Ac9DD8c402\`.
- **Replay protection**: Each signature includes a 32-byte random nonce plus a \`validAfter\`/\`validBefore\` window of ~5 minutes.
- **Minimum Discount Routing**: Operators can set a discount floor via the \`SURPLUS_MIN_DISCOUNT_PCT\` env var (0-90). When > 0, OMA forwards an \`X-Surplus-Min-Discount-Pct\` header so Surplus routes to offers meeting the floor. Configured at \`GET /admin/surplus/config\`.
- **User impact**: None directly. Operator-internal only.

### Minimum Discount Routing (public, buyer-side guardrail)
- **What it is**: A guardrail that prevents OMA from buying any Surplus Intelligence offer whose discount is below a configured floor. Announced by Surplus on 2026-06-12.
- **Operator scope**: Set in \`/admin/fees\` under "Surplus Min Discount Routing". Default 50%, range 0–95%. Effective within 30 seconds. In-flight x402 orders finish at the old floor.
- **End-user scope**: Agents can pass \`procurement: { min_discount_pct: 50 }\` on any \`/v1/chat/completions\` call. OMA returns HTTP 422 with code \`discount_floor_violation\` (and the best-offer percent) if the floor is not met. The agent decides whether to back off, retry, or accept a more expensive direct call.
- **Per-key default**: Set a default in the dashboard under Settings → Procurement. The per-key default cannot be set below the operator floor.
- **Public endpoint**: \`GET /api/v1/surplus/min-discount\` returns the current operator floor and the allowed range. \`POST\` (admin auth) sets a new floor.
- **Failure mode**: When no offer clears the floor, the operator aborts that cycle and waits for the next poll. End-user calls get a structured 422 — no silent retry, no surprise bill, no fallback to a more expensive vendor.
- **Details**: [Surplus Min Discount Routing](https://oma-ai.com/compare/surplus-min-discount-routing)

### Additional Providers
- **OpenRouter** - Multi-vendor catalog; used for models not available on Venice.
- **AntSeed** - Open-source model community; used for Llama, Mixtral, Qwen, DeepSeek, etc.
- **Together** - Fast open-source inference.
- **DeepInfra** - Cost-optimized open-source inference.
- **LiteLLM** - EU-based proxy for OpenAI-compatible models.

### Markup Model
- OMA charges a default **25% markup** (configurable via the \`OMA_MARKUP_PCT\` env var) on top of the upstream provider's per-token cost.
- Staking discounts reduce the final price; team admins can set team-level overrides.
- Markup is the platform's revenue and is recorded separately from the upstream cost in \`usage_records\`.

## SDKs
- Python: \`pip install openai\` with base_url="https://api.oma-ai.com/v1"
- JavaScript: Use OpenAI SDK or fetch directly

## Error Codes
| Code | Meaning |
|------|---------|
| 400 | Bad request |
| 401 | Unauthorized |
| 402 | Payment required |
| 404 | Not found |
| 429 | Rate limit exceeded |
| 500 | Server error |
| 502 | External service error |
`

export function GET() {
  return new NextResponse(BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  })
}
