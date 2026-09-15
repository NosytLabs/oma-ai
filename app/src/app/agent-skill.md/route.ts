/**
 * /agent-skill.md — autonomous setup instructions for AI agents.
 *
 * Referenced by /.well-known/agent-card.json (discovery.discovery.agentSkill)
 * and /llms.txt (Agent resources section). Plain Markdown so any agent
 * framework (Claude Code, Hermes, OpenCode, LangChain, Vercel AI SDK) can
 * read it directly without a JSON parser.
 *
 * Returns the canonical "how to use OMA" recipe:
 *   1. Discover models via /v1/models
 *   2. Authenticate (free: magic-link, paid: SIWE + USDC, programmatic: API key)
 *   3. Call /v1/chat/completions (OpenAI-compatible) or /v1/messages (Anthropic-compatible)
 *   4. Pay per request via x402 (no account needed) — sign EIP-3009 transferWithAuthorization on Base
 *
 * URLs are resolved from env at request time so staging/preview
 * deployments advertise the right host instead of leaking prod URLs.
 */
import { DEFAULT_API_URL } from "@/lib/config";

export const dynamic = "force-static";
export const revalidate = 3600;

function resolveSiteUrl(): string {
	return (
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://oma-ai.com"
	);
}

export function GET(): Response {
	const siteUrl = resolveSiteUrl();
	const apiUrl =
		DEFAULT_API_URL?.replace(/\/+$/, "") || "https://api.oma-ai.com";

	const BODY = `# OMA AI — Agent Skill

> Drop-in OpenAI-compatible AI gateway with USDC micropayments on Base. Free tier, no signup needed. 21 curated chat models. Use this skill to add OMA to your agent's toolbelt.

## What is OMA?

OMA-AI is a single OpenAI-compatible API endpoint that routes requests across curated AI model providers (Venice, OpenBroker/Gonka.AI). It handles:

- **OpenAI-compatible API** — drop-in replacement for any OpenAI SDK.
- **Anthropic-compatible API** — same models via \`/v1/messages\` for Anthropic SDK users.
- **Three auth modes**:
  1. **Magic-link email** — humans, free tier, no payment needed.
  2. **SIWE (Sign-In with Ethereum)** — wallet-bound sessions, pay with USDC.
  3. **API key** — machine-to-machine, \`oma_sk_...\` format, credit-billed.
- **x402 settlement** — agents sign an EIP-3009 \`transferWithAuthorization\` envelope, verify + settle to credit a balance, then spend with an API key. Facilitator pays gas.

## Quick start

### 1. Discover models

\`\`\`bash
curl ${apiUrl}/v1/models
\`\`\`

Returns the live catalog with IDs, capabilities, and pricing.

### 2. Make an unauthenticated request (free tier, models marked "free" only)

\`\`\`bash
curl -X POST ${apiUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Say hi in one short sentence."}],
    "max_tokens": 64
  }'
\`\`\`

### 3. Make an authenticated request with an API key

\`\`\`bash
curl -X POST ${apiUrl}/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "kimi-k2-6",
    "messages": [{"role": "user", "content": "Summarize the last 24h of AI news."}],
    "stream": true
  }'
\`\`\`

### 4. Pay per request with x402 (no account)

\`\`\`bash
# Step 1: Gateway replies 402 with PAYMENT-REQUIRED challenge
RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST ${apiUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "kimi-k2-6", "messages": [{"role": "user", "content": "Hi"}]}')

# Step 2: Sign the payment envelope (EIP-3009 transferWithAuthorization on Base)
# ... your agent's signing logic ...

# Step 3: Retry with PAYMENT-SIGNATURE header
curl -X POST ${apiUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "PAYMENT-SIGNATURE: <signed envelope>" \\
  -d '{"model": "kimi-k2-6", "messages": [{"role": "user", "content": "Hi"}]}'
\`\`\`

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| \`POST ${apiUrl}/v1/chat/completions\` | OpenAI-compatible chat |
| \`POST ${apiUrl}/v1/messages\` | Anthropic-compatible chat |
| \`GET  ${apiUrl}/v1/models\` | Live model catalog |
| \`POST ${apiUrl}/x402/verify\` | Verify a signed payment envelope |
| \`POST ${apiUrl}/x402/settle\` | Settle a verified payment on-chain |
| \`GET  ${siteUrl}/.well-known/agent-card.json\` | A2A Agent Card (machine-readable discovery) |
| \`GET  ${siteUrl}/llms.txt\` | llms.txt index for crawlers |
| \`GET  ${siteUrl}/docs\` | Full API reference |

## Auth

- **Free tier (no auth)**: 20 requests/day on free models via the website chat. No signup.
- **Magic-link**: \`POST ${siteUrl}/api/auth/sign-in/magic-link\` with your email → check inbox → click link → session cookie issued.
- **SIWE (wallet)**: \`POST ${siteUrl}/api/auth/sign-in/siwe\` with a signed EIP-4361 message → session cookie issued.
- **API key**: Sign in once, then create an API key from the dashboard. Use \`Authorization: Bearer oma_sk_...\`.

## Rate limits

- Anonymous: 20 req/day on free models (website chat only)
- Authenticated (free tier): 100 req/day on free models
- API key: per-key bucket, see \`/docs#rate-limits\`

## Error codes

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid auth |
| 402 | Payment required (x402 challenge issued — sign + retry with PAYMENT-SIGNATURE) |
| 429 | Rate limit hit |
| 502 | All upstream providers failed (gateway fell through circuit breakers) |
| 503 | Maintenance window |

## Network details (x402)

- **Network**: Base mainnet (eip155:8453)
- **Asset**: USDC (\`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`)
- **Scheme**: EIP-3009 \`transferWithAuthorization\`
- **Gas**: paid by gateway (agent signs only)

## More info

- Full docs: ${siteUrl}/docs
- Pricing: ${siteUrl}/pricing
- Models: ${siteUrl}/models
- GitHub: https://github.com/NosytLabs
`;

	return new Response(BODY, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
}
