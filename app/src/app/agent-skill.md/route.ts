/** Concise discovery guide. Request schemas live in the shared public contract. */
export const dynamic = "force-static";
export const revalidate = 3600;

const BODY = `# OMA API setup

> Prepaid AI inference with Chat Completions and a text/function-tool Messages adapter. Free website chat is separate from paid API-key usage.

## Setup

1. Sign in at https://www.oma-ai.com/login using email or an installed browser wallet.
2. Create and save an API key at https://www.oma-ai.com/dashboard?tab=api-keys.
3. Fund the account through an available method at https://www.oma-ai.com/deposit.
4. Read https://www.oma-ai.com/api/v1/models and select an available model ID. Prices are USD per million input/output tokens.

Chat Completions SDK base URL: https://www.oma-ai.com/api/v1. Send Authorization: Bearer $OMA_API_KEY.
Messages clients that append /v1/messages use https://www.oma-ai.com/api as the base URL. That endpoint also accepts x-api-key.

## Contract

- [Endpoint schemas and response formats](https://www.oma-ai.com/api/v1/openapi.json)
- [Requests and examples](https://www.oma-ai.com/docs#quickstart)
- [Context and output limits](https://www.oma-ai.com/docs#models)
- [Rate limits](https://www.oma-ai.com/docs#rate-limits)
- [Service status](https://www.oma-ai.com/status)

The gateway does not implement the OpenAI Responses API. The Messages adapter rejects image/document blocks, extended thinking and prompt-cache fields. Your application executes tools and supplies their results.

Paid requests reserve the selected model's full configured input-context cost plus the requested output budget before inference. Eligible fallbacks can increase that maximum. Unused credits return after the request cost is confirmed. Interrupted requests can leave credits pending a cost review. Keep the request ID.

Use Idempotency-Key for inference retries, at most 512 UTF-8 bytes. In-progress duplicates return 409 request_in_progress; completed keys return 409 already_processed without replaying the response. Retain the original response and honor Retry-After.

## x402 funding

Read https://www.oma-ai.com/x402/info before signing. Funding uses /x402/* on the website origin, outside the SDK base URL.

POST /x402/verify broadcasts an authorized USDC transfer on Base mainnet. It is not a dry run. Obtain the wallet owner's approval for the exact recipient and amount. Save any returned transaction hash.

POST /x402/settle credits a confirmed transfer to the payer's SIWE session. It does not send another transfer. API keys do not authenticate settlement. For pending credits, retry settlement with the same hash and payer session. Inspect the confirmed receipt and authorization nonce before signing a replacement payment. A 409 reconciliation conflict requires support.

[Funding format and recovery](https://www.oma-ai.com/docs#x402)

Use only customer endpoints in the public contract. Keep API keys, session cookies, signatures and private keys out of logs and source control.
`;

export function GET(): Response {
	return new Response(BODY, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
}
