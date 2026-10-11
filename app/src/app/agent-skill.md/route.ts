/** Public agent setup guide. Keep URLs on the canonical public proxy. */
export const dynamic = "force-static";
export const revalidate = 3600;

const BODY = `# OMA AI — Agent Setup

> OpenAI-compatible inference with prepaid credits. Discover current model availability before making requests. Free chat is only on the OMA website for eligible Gonka/OpenBroker models. Programmatic API requests always require credits.

## Public endpoints

Use \`https://www.oma-ai.com/api/v1\` as the SDK base URL. The public website proxies the API; agents should not use internal backend hosts. x402 funding uses \`https://www.oma-ai.com/x402/*\`, outside \`/api/v1\`.

| Endpoint | Purpose |
|----------|---------|
| \`GET https://www.oma-ai.com/api/v1/models\` | Catalog, availability, and prices |
| \`POST https://www.oma-ai.com/api/v1/chat/completions\` | OpenAI-compatible inference |
| \`POST https://www.oma-ai.com/api/v1/messages\` | Anthropic-compatible inference |
| \`GET https://www.oma-ai.com/x402/info\` | Current x402 recipient, asset, network, and signing domain |
| \`POST https://www.oma-ai.com/x402/verify\` | Validate and broadcast a signed USDC transfer, then wait for confirmation |
| \`POST https://www.oma-ai.com/x402/settle\` | Credit the confirmed payment to the authenticated payer's account |

## 1. Sign in and create an API key

Use [sign in](https://www.oma-ai.com/login) with email or an EVM wallet, then create an \`oma_sk_...\` key in the [dashboard](https://www.oma-ai.com/dashboard?tab=api-keys). Send the key as \`Authorization: Bearer $OMA_API_KEY\` for programmatic inference.

Website sessions and API keys are separate credentials. x402 settlement requires a SIWE wallet session whose linked wallet is the USDC payer. An API key or email-only session cannot claim that payment.

## 2. Select an available chat model

The following shell examples require \`curl\` and \`jq\`. They select from the live catalog instead of relying on a hardcoded model ID.

\`\`\`bash
set -e
OMA_MODEL_ID=$(curl -fsS https://www.oma-ai.com/api/v1/models | \\
  jq -er '[.data[] | select(.available != false and (.modality // "chat") == "chat")][0].id // error("No available chat model")')
\`\`\`

Review the chosen model's prices and capabilities in the [catalog](https://www.oma-ai.com/models). Availability can change between discovery and a request.

## 3. Fund the prepaid balance and call the API

Use USDC on Base or card checkout when available at [Buy credits](https://www.oma-ai.com/deposit). All API-key inference uses prepaid credits, including models with a free allowance in browser chat.

\`\`\`bash
jq -n --arg model "$OMA_MODEL_ID" '{
  model: $model,
  messages: [{role: "user", content: "Say hi in one short sentence."}],
  max_tokens: 64
}' | curl --fail-with-body https://www.oma-ai.com/api/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data-binary @-
\`\`\`

Ordinary chat requests do not issue a mid-request x402 challenge. A 402 for insufficient credits means fund the balance, then retry with the API key; do not attach a payment signature to the inference request.

## 4. Optional x402 funding: transfer, credit, spend

OMA supports USDC on Base mainnet (\`eip155:8453\`), contract \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`. Read \`GET https://www.oma-ai.com/x402/info\` before signing and use its \`payTo\`, \`asset\`, \`network\`, \`maxTimeoutSeconds\`, and \`extra\`. The direct-deposit address can differ from the x402 recipient. Sign in with the same wallet that owns the USDC before starting the transfer.

Prepare an EIP-712 \`TransferWithAuthorization\` signature over the EIP-3009 authorization tuple. The USDC domain is \`name: "USD Coin"\`, \`version: "2"\`, \`chainId: 8453\`, and the USDC contract above as \`verifyingContract\`. The tuple has \`from\`, \`to\`, \`value\`, \`validAfter\`, \`validBefore\`, and a fresh 32-byte \`nonce\`. \`value\` is in atomic USDC units (6 decimals); times are Unix seconds. The payer signs, and the facilitator broadcasts and pays transaction gas.

Send a base64-encoded JSON v2 envelope in \`PAYMENT-SIGNATURE\`:

\`\`\`json
{
  "x402Version": 2,
  "accepted": {
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "1000000",
    "payTo": "<payTo from /x402/info>",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USD Coin", "version": "2" }
  },
  "payload": {
    "signature": "<0x-prefixed 65-byte signature>",
    "authorization": {
      "from": "<payer wallet address>",
      "to": "<same configured treasury address>",
      "value": "1000000",
      "validAfter": "<Unix seconds>",
      "validBefore": "<Unix seconds>",
      "nonce": "<0x-prefixed 32-byte random nonce>"
    }
  }
}
\`\`\`

This illustrative amount is 1 USDC. Replace all placeholders and choose the intended funding amount before signing. The accepted asset, recipient, and atomic amount must match the signed authorization. Legacy OMA raw-JSON \`PAYMENT-SIGNATURE\` envelopes and the older base64 \`X-PAYMENT\` header remain supported.

**Calling \`/x402/verify\` broadcasts the transfer and waits for confirmation. It is not a dry run.** Signing locally does not itself transfer funds. A successful verification returns top-level \`valid\`, \`txHash\`, \`amount\`, and \`networkId\`; it has not yet credited the OMA balance.

\`\`\`bash
# PAYMENT_SIGNATURE is the base64-encoded signed envelope above.
# OMA_SESSION_COOKIE is an existing SIWE session for the paying wallet.
set -e
curl --fail-with-body -X POST https://www.oma-ai.com/x402/verify \\
  -H "PAYMENT-SIGNATURE: $PAYMENT_SIGNATURE" \\
  -H "Content-Type: application/json" > verification.json
jq -e '.valid == true' verification.json > /dev/null

# Use the returned hash and network; do not supply an amount.
jq '{txHash, networkId}' verification.json | \\
  curl --fail-with-body https://www.oma-ai.com/x402/settle \\
    -H "Content-Type: application/json" \\
    --cookie "$OMA_SESSION_COOKIE" \\
    --data-binary @-
\`\`\`

A successful settlement returns \`settled: true\`, a signed receipt string, and \`creditedCents\`; the \`PAYMENT-RESPONSE\` header contains a base64 receipt summary. One credit is one US cent, and fractional credits are preserved. Spend from the balance with the API key from that account.

### Recovery and retries

Save the transaction hash as soon as it is returned. If verification reports a pending/unconfirmed transaction with a \`txHash\`, check its Base receipt before signing another payment. Once the transfer succeeds, retry \`/x402/settle\` with the same hash and the same payer's session. Crediting is idempotent and recovers from the confirmed USDC Transfer log after a server restart; it does not depend only on an in-memory verification cache. A different account cannot claim the payment.

If a transfer succeeded but credits are pending, retry settlement rather than making a second transfer. If no transaction hash was returned, reconcile the signed authorization's nonce and wallet activity before authorizing another payment. Keep private keys, session cookies, and signed envelopes out of logs and source control.

## Errors and limits

| Code | Action |
|------|--------|
| 400 | Check request format, network, asset, and payment fields |
| 401 | Provide the credential required by that endpoint |
| 402 | Inference balance is insufficient; fund credits and retry |
| 403 | Check authorization; x402 payer must match the session wallet |
| 409 | Payment was already credited to another account |
| 422 | Payment verification or settlement failed; inspect the response and any returned transaction hash |
| 429 | Wait for the indicated retry interval |
| 500 | For confirmed payments with pending credit, retry settlement with the same hash |
| 502 / 503 | Upstream or service unavailable; consult live status |

Browser guest chat and signed-in free chat have daily allowances. API-key limits are separate. Read [rate limits](https://www.oma-ai.com/docs#rate-limits) and live usage responses for current limits.

Use only the customer endpoints listed here or in the public OpenAPI schema. Website-only chat, operator/admin controls, and deployment recovery jobs are not an agent API. Do not copy website headers to bypass authentication or billing. Treat API keys, session cookies, and wallet signing as separate permissions; obtain the wallet owner's approval for the exact recipient and amount before authorizing a transfer.

## References

- [API and x402 docs](https://www.oma-ai.com/docs#x402)
- [Pricing](https://www.oma-ai.com/pricing)
- [Model catalog](https://www.oma-ai.com/models)
- [Agent discovery](https://www.oma-ai.com/.well-known/agent-card.json)
- [Machine-readable site index](https://www.oma-ai.com/llms.txt)
`;

export function GET(): Response {
	return new Response(BODY, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
}
