"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { useRevealInView } from "@/lib/use-reveal-in-view";
import { MODEL_COUNT, MODELS, formatPricePerMillion } from "@/lib/models-data";
import { SyntaxHighlighter } from "../_components/SyntaxHighlighter";

export { MODEL_COUNT, MODELS };


/* ==================== TYPES ==================== */

export type Tab = { label: string; lang: string; code: string };

export type RateLimitRow = {
	name: string;
	value: string;
	desc: string;
};

export type ModelRateOverride = {
	model: string;
	rpm: number;
	tpm: number;
};

export type ModelPricing = {
	id: string;
	name: string;
	input: number;
	output: number;
	ctx: string;
};

export type EndpointInfo = {
	method: "GET" | "POST" | "DELETE";
	path: string;
	/** Stable heading anchor used by the docs sidebar/search (nav-data.ts). */
	anchor: string;
	title: string;
	desc: string;
	auth: string;
	body?: Record<string, string>;
	params?: { name: string; type: string; desc: string }[];
	response: string;
};

export type ErrorInfo = {
	code: number;
	type: string;
	desc: string;
};

/* ==================== DATA ==================== */

// Single-tier limits — there are no per-plan tiers. Values mirror the
// server's token-bucket middleware (server/src/middleware/rate-limit/).
export const RATE_LIMIT_ROWS: RateLimitRow[] = [
	{
		name: "Burst",
		value: "60 requests",
		desc: "Token bucket capacity — the most requests you can fire at once.",
	},
	{
		name: "Refill",
		value: "20 req/s",
		desc: "How fast the bucket refills after a burst.",
	},
	{
		name: "Sustained",
		value: "60 RPM",
		desc: "Sliding-window requests-per-minute ceiling.",
	},
	{
		name: "Token budget (listed models)",
		value: "120,000 TPM",
		desc: "For the models listed below: estimated input plus requested maximum output, per model, account and key. Separate from actual billed tokens.",
	},
	{
		name: "Emergency allowance",
		value: "5 RPM",
		desc: "During limiter outages: per account and instance (per IP for guests), shared across that account's keys. Further requests return 503.",
	},
];

// Per-model overrides — mirrors MODEL_LIMITS in
// server/src/middleware/rate-limit/utils.ts exactly.
export const MODEL_RATE_OVERRIDES: ModelRateOverride[] = [
			{ model: "llama-3.3-70b", rpm: 60, tpm: 120000 },
	{ model: "deepseek-v4-flash-0731-openbroker", rpm: 60, tpm: 120000 },
	{ model: "kimi-k3", rpm: 60, tpm: 120000 },
];

export const MODEL_PRICING_ROWS: ModelPricing[] = MODELS.map((m) => ({
	id: m.id,
	name: m.name,
	input: m.inputPricePer1M,
	output: m.outputPricePer1M,
	ctx: m.contextLength,
}));

export const ENDPOINTS: EndpointInfo[] = [
	{ method: "GET", path: "/user", anchor: "ep-user", title: "Current Account",
		desc: "Returns the signed-in profile, linked wallet, and admin status.", auth: "Session cookie",
		response: `{ "id": "user_…", "email": "you@example.com", "name": "You", "evmAddress": null, "isAdmin": false }` },
	{ method: "GET", path: "/sessions", anchor: "ep-sessions", title: "Active Sessions",
		desc: "Lists active sessions with device details and isCurrent.", auth: "Session cookie",
		response: `{ "sessions": [{ "id": "session_…", "isCurrent": true, "createdAt": "2026-10-10T00:00:00Z", "expiresAt": "2026-10-17T00:00:00Z" }] }` },
	{ method: "DELETE", path: "/sessions/:id", anchor: "ep-session-revoke", title: "Revoke Remote Session",
		desc: "Revokes an owned remote session. Use sign-out for the current session.", auth: "Session cookie",
		response: `{ "success": true, "id": "session_…" }` },
	{ method: "DELETE", path: "/sessions", anchor: "ep-sessions-revoke", title: "Revoke Other Sessions",
		desc: "Revokes all other active sessions and keeps the current one.", auth: "Session cookie",
		response: `{ "success": true, "revokedCount": 2 }` },
	{ method: "DELETE", path: "/v1/history", anchor: "ep-history-clear", title: "Clear Usage History",
		desc: "Deletes usage and previous audit logs, then records the clearing event. Preserves identity, sessions, keys, and balances.", auth: "Session cookie",
		response: `{ "success": true, "deleted": { "usageRecords": 4, "auditLogs": 2 } }` },
	{ method: "DELETE", path: "/account", anchor: "ep-account-delete", title: "Delete Account",
		desc: "Permanently deletes identity, sessions, keys, and usage, and forfeits remaining credits. Payment and security audit records remain with the account ID detached. Requires sign-in within the last 24 hours; HTTP 400 session_not_fresh means sign in again.", auth: "Fresh session cookie; API keys are not accepted",
		response: `{ "success": true }` },
	{
		method: "POST",
		path: "/v1/chat/completions",
		anchor: "ep-chat",
		title: "Chat Completions",
		desc: "OpenAI-compatible multi-turn chat with SSE streaming. Key model restrictions apply to fallback routes too. Use an Idempotency-Key (up to 512 UTF-8 bytes) for retries. Concurrent duplicates return 409 request_in_progress with Retry-After; completed keys return 409 already_processed. Keep your original response; completion bodies are not retained for replay.",
		auth: "Bearer token (API key); requests spend prepaid credits",
		body: {
			model:
				'string (required). An available model ID from /v1/models, e.g. "minimax-m2-7"',
			messages:
				"array of { role, content }. role is system, user, assistant, or tool",
			temperature: "number 0 to 2 (optional, default from upstream)",
			max_tokens: "positive integer (optional). Must not exceed the model's max_output_tokens",
			stream: "boolean. Server-Sent Events when true (text/event-stream)",
			tools: "array of function-tool definitions (optional). Your application executes tools and sends their results back; OMA does not run them.",
			tool_choice: "auto, none, required, or a named function (optional; support varies by model)",
		},
		response: `{
	"id": "chatcmpl-9f3k2a",
	"object": "chat.completion",
	"created": 1717194000,
	"model": "minimax-m2-7",
	"choices": [
	{
	"index": 0,
	"message": { "role": "assistant", "content": "Hello. How can I help today?" },
	"finish_reason": "stop"
	}
	],
	"usage": { "prompt_tokens": 18, "completion_tokens": 12, "total_tokens": 30 }
}`,
	},
	{
		method: "POST",
		path: "/v1/messages",
		anchor: "ep-messages",
		title: "Anthropic Messages",
		desc: "Anthropic request format for text and function tools, including tool-result continuations and SSE. Same catalog and prepaid billing as chat completions. Image/document blocks, extended thinking, prompt caching and beta features are not supported. Auth: Bearer oma_sk_… or x-api-key.",
		auth: "Bearer token (API key) or x-api-key",
		body: {
			model: 'string (required). OMA catalog id, e.g. "kimi-k3"',
			messages: "array of { role: user|assistant, content }. Text, assistant tool_use and user tool_result blocks are supported",
			max_tokens: "integer (required by Anthropic clients)",
			system: "string or text blocks (optional)",
			tools: "array of { name, description?, input_schema } (optional). Tool quality depends on the selected model",
			tool_choice: "{ type: auto|any|none } or { type: tool, name } (optional)",
			stream: "boolean. SSE when true",
			temperature: "number (optional)",
		},
		response: `{
	"id": "msg_…",
	"type": "message",
	"role": "assistant",
	"content": [{ "type": "text", "text": "Hello." }],
	"model": "kimi-k3",
	"stop_reason": "end_turn",
	"usage": { "input_tokens": 12, "output_tokens": 8 }
}`,
	},
	{
		method: "GET",
		path: "/v1/search",
		anchor: "ep-search",
		title: "Web Search",
		desc: "DuckDuckGo-backed search for playground WEB mode. No API key. Auth optional (anonymous free-chat works). Empty results if DDG is unreachable so chat still proceeds.",
		auth: "Optional — Bearer key or session cookie",
		params: [{ name: "query", type: "string", desc: "Search query (1–500 chars, required)" }],
		body: undefined,
		response: `{
	"query": "open model access",
	"provider": "duckduckgo",
	"results": [
	{ "title": "…", "url": "https://…", "snippet": "…", "site_name": "…" }
	]
}`,
	},
	{
		method: "GET",
		path: "/v1/models",
		anchor: "ep-models",
		title: "List Models",
		desc: "Returns the curated catalog, including currently unavailable models. Check available, context_length, and max_output_tokens. Prices are USD per million tokens. pricing.extended applies when input tokens exceed its context_token_threshold. No auth required.",
		auth: "None",
		response: `{
	"object": "list",
	"data": [
	{
	"id": "llama-3.3-70b",
	"object": "model",
	"created": 1717194000,
	"owned_by": "venice",
	"permission": [],
	"root": "llama-3.3-70b",
	"parent": null,
		"pricing": { "prompt": 1.05, "completion": 4.20 },
		"category": "mid",
		"context_length": 128000
	},
{
"id": "deepseek-v4-flash-0731-openbroker",
"object": "model",
"created": 1717194000,
"owned_by": "oma-ai",
"pricing": { "prompt": 0.02, "completion": 0.02 },
"category": "budget",
"context_length": 400000
}
	]
}`,
	},
	{
		method: "GET",
		path: "/v1/models/:model",
		anchor: "ep-model",
		title: "Get Model",
		desc: "Returns pricing, capabilities, and provider metadata for a single model. No auth required.",
		auth: "None",
		response: `{
	"id": "llama-3.3-70b",
	"object": "model",
	"created": 1717194000,
	"owned_by": "venice",
	"display_name": "Llama 3.3 70B",
	"provider": "venice",
	"category": "mid",
	"context_length": 128000,
		"supports_streaming": true,
		"supports_tools": true,
		"pricing": { "prompt": 1.05, "completion": 4.20 },
		"max_output_tokens": 4096
}`,
	},
	{
		method: "GET",
		path: "/v1/balance",
		anchor: "ep-balance",
		title: "Credit Balance",
		desc: "Returns available credits, total deposited, and total used in cents. 1 credit = $0.01 = 1 cent.",
		auth: "Bearer token (API key)",
		body: undefined,
		response: `{
	"balanceCents": "1234.50",
	"totalDepositedCents": "10000.00",
	"totalUsedCents": "8765.50"
}`,
	},
	{
		method: "GET",
		path: "/v1/deposit/usdc",
		anchor: "ep-deposit-usdc",
		title: "USDC Deposit Instructions",
		desc: "Returns the treasury USDC address on Base and min/max bounds. Send USDC from your connected wallet directly to the treasury; credits post automatically once the transfer confirms and the sender matches your recorded wallet address.",
		auth: "Bearer token (API key)",
		body: undefined,
		response: `{
	"depositAddress": "0x8335…",
	"network": "base",
	"chainId": 8453,
	"usdcContract": "0x833589…",
	"minDepositCents": 100,
	"maxDepositCents": 1000000,
	"creditsPerCent": 1
}`,
	},
	{
		method: "POST",
		path: "/v1/checkout",
		anchor: "ep-checkout",
		title: "Polar Checkout",
		desc: "Creates a Polar hosted-checkout session for Hobby ($10/1000cr), Builder ($50/5000cr), or Scale ($250/25000cr). Available when card checkout is enabled; otherwise returns 503. The account is credited automatically once the payment is confirmed.",
		auth: "Bearer token (API key)",
		body: {
			plan: 'string (required). "hobby" | "builder" | "scale"',
			successUrl: "string (optional). Redirect target after payment",
		},
		response: `{ "url": "https://buy.polar.sh/…" }`,
	},
	{
		method: "GET",
		path: "/v1/usage/today",
		anchor: "ep-usage-today",
		title: "Daily Free-Chat Quota",
		desc: "Free-chat attempts admitted today: 20/day per guest IP or 100/day per signed-in account. Includes attempts that later fail upstream. Reads do not consume quota; the allowance resets at midnight UTC. Paid API-key inference uses credits instead.",
		auth: "Optional session cookie or API key; guests allowed",
		body: undefined,
		response: `{
	"used": 12,
	"limit": 20,
	"remaining": 8,
	"resetMs": 12345678,
	"policy": "shared-redis"
}`,
	},
	{
		method: "GET",
		path: "/v1/usage",
		anchor: "ep-usage",
		title: "Usage History",
		desc: "Paginated usage records for your dashboard. Every chat request becomes a row with model, tokens, costCents, and status.",
		auth: "Bearer token (API key)",
		body: undefined,
		params: [
			{ name: "since", type: "string", desc: "ISO timestamp; records at or after" },
			{ name: "until", type: "string", desc: "ISO timestamp; records at or before" },
			{ name: "limit", type: "number", desc: "1–200, default 50" },
			{ name: "cursor", type: "string", desc: "Opaque pagination cursor" },
		],
		response: `{
	"object": "list",
	"data": [{ "id": "…", "model": "…", "totalCents": "…" }],
	"next_cursor": "2026-08-03T…|…",
	"totals": { "requests": 42, "totalCents": "12.34" }
}`,
	},
	{
		method: "POST",
		path: "/v1/deposit/usdc/challenge",
		anchor: "ep-deposit-challenge",
		title: "Deposit Ownership Challenge",
		desc: "Issue a short-lived challenge bound to your account and sending wallet before broadcasting. After the transfer, sign the deposit authorization message including this token, recipient, transaction hash and declared amount. A retry needs a fresh challenge and signature for the same transfer.",
		auth: "Session cookie or bearer token (API key)",
		body: { fromAddress: "string (required). Sending wallet 0x address" },
		response: `{ "token": "…", "nonce": "…", "expiresAt": 1791676800 }`,
	},
	{
		method: "POST",
		path: "/v1/deposit/usdc",
		anchor: "ep-deposit-submit",
		title: "Record USDC Deposit",
		desc: "Register a Base USDC transfer with its account-bound challenge and wallet ownership signature. The on-chain watcher checks the actual sender, recipient and amount before issuing credits. Retry registration for the same transaction if proof signing or submission fails; do not send another transfer.",
		auth: "Session cookie or bearer token (API key)",
		body: {
			amountUsd: "number (required). USD amount, up to $10,000",
			txHash: "string (required). 0x-prefixed 64-char transaction hash",
			network: "string (optional). \"base\" (default)",
			fromAddress: "string (required). Sender wallet 0x address; must match the on-chain sender",
			challengeToken: "string (required). Unexpired token from POST /v1/deposit/usdc/challenge",
			signature: "string (required). EIP-191 signature over the canonical deposit message, including txHash and amountUsd",
		},
		response: `{
	"depositId": "dep_…",
	"status": "pending",
	"amountCents": 1000,
	"txHash": "0x…",
	"network": "base",
	"message": "Deposit recorded. Watcher will credit your balance after on-chain confirmation."
}`,
	},
	{
		method: "GET",
		path: "/v1/deposit/status",
		anchor: "ep-deposit-status",
		title: "Deposit History",
		desc: "Lists your recent deposits with status (pending / completed). Poll after POST /v1/deposit/usdc to confirm credits were issued.",
		auth: "Bearer token (API key)",
		body: undefined,
		response: `{
	"deposits": [
		{
			"id": "dep_…",
			"type": "usdc_direct",
			"status": "completed",
			"amountUsd": "10.00000000",
			"creditsIssued": "1000",
			"txHash": "0x…",
			"depositAddress": "0x…",
			"createdAt": "2026-08-01T00:00:00.000Z",
			"completedAt": "2026-08-01T00:00:05.000Z"
		}
	]
}`,
	},
	{
		method: "GET",
		path: "/v1/credits/balance",
		anchor: "ep-credits-balance",
		title: "Credit Balance Details",
		desc: "Returns your aggregate balance (authoritative) plus any credit batches. activeBatches is currently always empty: per-batch records are not yet written, so use balanceCents.",
		auth: "Bearer token (API key)",
		body: undefined,
		response: `{
	"activeBatches": [],
	"balanceCents": "7650"
}`,
	},
	{
		method: "GET",
		path: "/v1/credits/transactions",
		anchor: "ep-credits-transactions",
		title: "Credit Transactions",
		desc: "Combined deposit and usage history, newest first. Each row is either type \"deposit\" or \"usage\".",
		auth: "Bearer token (API key)",
		body: undefined,
		params: [
			{ name: "limit", type: "number", desc: "1–200, default 50" },
		],
		response: `{
	"transactions": [
		{
			"id": "dep_…",
			"type": "deposit",
			"amountCents": 1000,
			"creditsIssued": "1000",
			"status": "completed",
			"createdAt": "2026-08-01T00:00:00.000Z",
			"txHash": "0x…"
		}
	]
}`,
	},
	{
		method: "GET",
		path: "/v1/keys",
		anchor: "ep-keys-list",
		title: "List API Keys",
		desc: "Lists your API key metadata, including expiry, model restrictions and IP restrictions. Expired keys can remain listed until revoked; they cannot authenticate. Raw key values are never returned.",
		auth: "Better Auth session cookie",
		body: undefined,
		response: `{
	"keys": [
		{
			"id": "key_…",
			"name": "default",
			"prefix": "oma_sk_…",
			"createdAt": "2026-08-01T00:00:00.000Z",
			"lastUsedAt": null,
			"expiresAt": "2026-10-30T00:00:00.000Z",
			"allowedModels": ["minimax-m2-7"],
			"ipAllowlist": ["192.0.2.0/24"]
		}
	]
}`,
	},
	{
		method: "POST",
		path: "/v1/keys",
		anchor: "ep-keys-create",
		title: "Create API Key",
		desc: "Mints a new API key. Store the returned secret immediately; only its hash is kept. Model restrictions apply to fallback routes too. Keys expire after 90 days by default.",
		auth: "Better Auth session cookie",
		body: { name: "string (optional). Key label, 1–64 characters, default \"default\"", expiresInDays: "integer (optional). 1–365 days, default 90", allowedModels: "string[] (optional). 1–30 OMA model IDs; omit to allow all models", ipAllowlist: "string[] (optional). 1–20 IPv4/IPv6 addresses or CIDR ranges. Use your server’s public outbound IP; omit for unrestricted access. Revoke and replace a key to change restrictions." },
		response: `{
	"id": "key_…",
	"name": "default",
	"prefix": "oma_sk_…",
	"createdAt": "2026-08-01T00:00:00.000Z",
	"expiresAt": "2026-10-30T00:00:00.000Z",
	"allowedModels": null,
	"ipAllowlist": null,
	"key": "oma_sk_…"
}`,
	},
	{
		method: "DELETE",
		path: "/v1/keys/:id",
		anchor: "ep-keys-revoke",
		title: "Revoke API Key",
		desc: "Revokes an API key by id, immediately invalidating it. The key stops working on all future requests.",
		auth: "Better Auth session cookie",
		body: undefined,
		response: `{ "success": true, "id": "key_…" }`,
	},
	{
		method: "GET",
		path: "/x402/info",
		anchor: "ep-x402-info",
		title: "x402 Funding Information",
		desc: "Returns the current x402 treasury, Base network, USDC asset, and signing-domain information. This public discovery call does not move funds. Use payTo as the signed recipient; the direct-deposit address may differ. Choose the funding amount before signing.",
		auth: "None",
		body: undefined,
		response: `{
	"x402Version": 2,
	"scheme": "exact",
	"network": "eip155:8453",
	"asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	"decimals": 6,
	"payTo": "<configured treasury address>",
	"maxTimeoutSeconds": 300,
	"extra": { "name": "USD Coin", "version": "2" }
}`,
	},
	{
		method: "POST",
		path: "/x402/verify",
		anchor: "ep-x402-verify",
		title: "x402 Payment Verify",
		desc: "Validates the signed EIP-3009 authorization, broadcasts the USDC transfer, and waits for on-chain confirmation. This moves funds; it is not a dry run. Send a base64 v2 envelope in PAYMENT-SIGNATURE (legacy raw JSON also accepted). Follow with /x402/settle to credit the payer account.",
		auth: "PAYMENT-SIGNATURE header (x402)",
		body: undefined,
		response: `{
	"valid": true,
	"txHash": "0x…",
	"amount": "1",
	"networkId": "base"
}`,
	},
	{
		method: "POST",
		path: "/x402/settle",
		anchor: "ep-x402-settle",
		title: "x402 Payment Settle",
		desc: "Credits a confirmed USDC transfer to the SIWE session whose linked wallet is the payer. API keys are not accepted here. Amount and payer come from verified payment evidence; recovery can read the confirmed USDC Transfer log after a restart. Retries with the same hash are idempotent, including fractional credits.",
		auth: "SIWE session cookie for the USDC payer wallet",
		body: {
			txHash: "string (required). Confirmed transaction hash returned by verification",
			networkId: 'string (required). "base" or "eip155:8453"',
		},
		response: `{ "settled": true, "receipt": "<signed receipt>", "creditedCents": 100 }`,
	},
];

export const ERROR_CODES: ErrorInfo[] = [
	{
		code: 400,
		type: "invalid_request_error",
		desc: "Malformed request body or invalid parameters. Schema failures return validation_error.",
	},
	{
		code: 401,
		type: "authentication_error",
		desc: "Missing, invalid, expired or revoked API key, or no valid session on a session-only endpoint. Invalid explicit credentials cannot become guest access.",
	},
	{
		code: 402,
		type: "payment_error",
		desc: "Insufficient credits. Deposit more USDC or settle via x402, then retry.",
	},
	{
		code: 403,
		type: "forbidden",
		desc: "Authenticated but not allowed. E.g. a resource/endpoint you lack permission for, or feature_disabled.",
	},
	{
		code: 404,
		type: "not_found",
		desc: "Route, model, key, or resource does not exist.",
	},
	{
		code: 409,
		type: "conflict",
		desc: "Request conflicts with current state. Concurrent Idempotency-Key reuse returns request_in_progress: wait Retry-After, then retry the same key. Completed keys return already_processed without another charge: use your saved response. Retry keys are shared by both inference APIs and all keys on your account. Settlement owned by another account is also rejected.",
	},
	{
		code: 422,
		type: "validation_error",
		desc: "Request is well-formed but semantically invalid; also returned as invalid_request_error for schema failures.",
	},
	{
		code: 429,
		type: "rate_limit_error",
		desc: "Rate limit exceeded. Wait Retry-After seconds, then retry. Specific codes: rate_limit_exceeded, daily_limit_exceeded.",
	},
	{
		code: 500,
		type: "internal_error",
		desc: "Unexpected server error (also server_error). Contact support if persistent.",
	},
	{
		code: 502,
		type: "provider_error",
		desc: "Upstream provider failed, including an invalid operator provider credential. Contact support for provider authentication failures; replacing your OMA key will not repair them.",
	},
	{
		code: 503,
		type: "service_unavailable",
		desc: "A required service is temporarily unavailable, a model is paused, or maintenance is active. Account-status verification failures return auth_state_unavailable. New funding returns funding_paused or funding_status_unavailable without starting a transfer or checkout. Honor Retry-After when present.",
	},
];

export const QUICK_START_STEPS = [
	{
		n: "1",
		id: "qs-step-key",
		title: "Get API Key",
		desc: "Create an account and generate your API key from the dashboard.",
	},
	{
		n: "2",
		id: "qs-step-request",
		title: "Fund Your Balance",
		desc: "Add prepaid credits using USDC on Base or card checkout when available.",
	},
	{
		n: "3",
		id: "qs-step-response",
		title: "Start Building",
		desc: "Send your key in the Authorization header and select an available model from the catalog.",
	},
];

/* ==================== HELPERS ==================== */

export function fmt(n: number): string {
	return formatPricePerMillion(n);
}

function CopyButton({ text, id }: { text: string; id: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			onClick={() => {
				void copyToClipboard(text).then((ok) => {
					if (!ok) return;
					setCopied(true);
					setTimeout(() => setCopied(false), 2000);
				});
			}}
			className={`shrink-0 inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] border bg-surface/95 px-2.5 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider backdrop-blur-sm transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-accent/60 hover:text-accent active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
				copied
					? "border-success/60 text-success"
					: "border-border text-text-secondary"
			}`}
			aria-label={copied ? "Copied" : "Copy code"}
			aria-controls={id}
		>
			{copied ? (
				<>
					<Check className="h-3.5 w-3.5" />
					<span>Copied</span>
				</>
			) : (
				<>
					<Copy className="h-3.5 w-3.5" />
					<span>Copy</span>
				</>
			)}
		</button>
	);
}

export function CodeBlock({
	code,
	title,
	lang,
}: {
	code: string;
	title?: string;
	lang?: string;
}) {
	const id = useId();
	return (
		<div className="group relative max-w-full min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)]">
			<div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2">
				<span className="min-w-0 break-words text-xs font-medium text-text-muted font-mono">
					{title ?? "Code example"}
				</span>
				<CopyButton text={code} id={id} />
			</div>
			<div
				aria-label={`${title ?? "Code example"} — ${id}`}
				role="region"
				tabIndex={0}
				className="max-w-full min-w-0 overflow-x-auto p-4 text-sm leading-relaxed"
			>
				<pre id={id} className="m-0 max-w-full leading-relaxed">
					<SyntaxHighlighter code={code} lang={lang ?? "text"} />
				</pre>
			</div>
		</div>
	);
}

export function TabbedCode({ tabs }: { tabs: Tab[] }) {
	const [active, setActive] = useState(0);
	const id = useId();
	return (
		<div className="max-w-full min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)]">
			<div className="flex items-center gap-2 border-b border-border/50 pr-3">
				<div className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{tabs.map((t, i) => (
						<button
							type="button"
							key={t.label}
							onClick={() => setActive(i)}
							className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-[color,border-color,background-color,transform] duration-200 ease-out border-b-2 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void ${
								i === active
									? "text-accent border-accent"
									: "text-text-muted border-transparent hover:text-text-secondary"
							}`}
						>
							{t.label}
						</button>
					))}
				</div>
				<CopyButton key={active} text={tabs[active].code} id={id} />
			</div>
			<div className="relative min-w-0 max-w-full">
				<div
					role="region"
					aria-label={`${tabs[active].label} — ${id}`}
					tabIndex={0}
					className="max-w-full min-w-0 overflow-x-auto p-4 text-sm leading-relaxed"
				>
					<pre id={id} className="m-0 max-w-full leading-relaxed">
						<SyntaxHighlighter
							code={tabs[active].code}
							lang={tabs[active].lang}
						/>
					</pre>
				</div>
			</div>
		</div>
	);
}

export function SectionHeading({
	id,
	icon,
	title,
	subtitle,
}: {
	id: string;
	icon: ReactNode;
	title: string;
	subtitle: string;
}) {
	return (
		<div id={id} className="mb-6 flex items-start gap-4 scroll-mt-24">
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-accent/10 text-accent border border-accent/20">
				{icon}
			</div>
			<div>
				<h2 className="text-xl font-bold text-text font-display">{title}</h2>
				<p className="mt-1 text-sm text-text-muted">{subtitle}</p>
			</div>
		</div>
	);
}

export function AnimatedSection({
	children,
	delay = 0,
}: {
	children: ReactNode;
	delay?: number;
}) {
	const { ref, show } = useRevealInView<HTMLDivElement>({ amount: 0.05, once: true });

	return (
		<div
			ref={ref}
			className={`transition-[opacity,transform] duration-200 ease-out ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
			style={{ transitionDelay: `${delay}ms` }}
		>
			{children}
		</div>
	);
}
