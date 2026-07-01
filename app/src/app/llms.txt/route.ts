// Production API base (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed.
import { NextResponse } from "next/server";

export const dynamic = "force-static";

const BODY = `# OMA AI Gateway

> Permissionless AI inference gateway. Pay with crypto, use the latest AI models via OpenAI-compatible API. x402 protocol settlement in USDC on Base. No accounts required.

## Getting Started
- [API Documentation](https://oma-ai.com/docs) - Complete API reference
- [Chat](https://oma-ai.com/chat) - Interactive API testing
- [Pricing](https://oma-ai.com/pricing) - Model pricing and tiers
- [Model Catalog](https://oma-ai.com/models) - AI models catalog
- [Deposits](https://oma-ai.com/deposit) - Add credits via crypto (USDC, HoudiniSwap, CCTP, LiFi)
- [Dashboard](https://oma-ai.com/dashboard) - Usage and API keys

## API Reference
- [Quick Start](https://oma-ai.com/docs#quickstart) - Your first request in 5 minutes
- [Authentication](https://oma-ai.com/docs#authentication) - SIWE, API keys, x402
- [Endpoints](https://oma-ai.com/docs#endpoints) - Chat, embeddings, image, video, search, fetch
- [Rate Limits](https://oma-ai.com/docs#rate-limits) - Per-key and per-model limits
- [Pricing](https://oma-ai.com/docs#pricing) - Per-token costs across all models
- [x402 Payments](https://oma-ai.com/docs#x402) - Per-request crypto payments on Base
- [SDKs](https://oma-ai.com/docs#sdks) - OpenAI, Vercel AI, LangChain, direct HTTP
- [Errors](https://oma-ai.com/docs#errors) - Status codes and retry patterns
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

## Brand Voice
- Permissionless, not entitled. No marketing fluff, no invented metrics.
- Code-forward. Show endpoints, prices, contract addresses in line.
- Honest about limitations. We say "self-hosted" is not a thing — OMA is a managed gateway.
- Privacy by default. Mullvad-style account numbers, no PII, no email, no phone.

## SDKs
- Python: \`pip install openai\` with base_url="https://api.oma-ai.com/v1"
- JavaScript: \`npm i openai\` with baseURL: 'https://api.oma-ai.com/v1'
- cURL: see /chat for one-click copy

## Error Codes
| Code | Meaning |
|------|---------|
| 400 | Bad request |
| 401 | Unauthorized |
| 402 | Payment required (x402) |
| 404 | Not found |
| 422 | Discount floor violation (Surplus) |
| 429 | Rate limit exceeded |
| 500 | Server error |
| 502 | External provider error |
`;

export function GET() {
	return new NextResponse(BODY, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600, must-revalidate",
		},
	});
}
