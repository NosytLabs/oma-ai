import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * Privacy manifest endpoint.
 *
 * Returns a machine-readable description of what data OMA does and
 * does not store, plus retention policies. This is the canonical
 * answer to "what do you do with my data?" and is referenced by the
 * public privacy page and by automated GDPR/CCPA compliance tools.
 */
const PRIVACY_MANIFEST = {
	service: "OMA AI",
	version: "1.0.0",
	effective_at: "2026-06-12",
	contact: {
		privacy_email: "support@nosytlabs.com",
		security_email: "support@nosytlabs.com",
	},
	data_stored: {
		account: {
			description:
				"Wallet-based account identity. No email or password required.",
			fields: [
				"wallet_address",
				"nonce",
				"optional_email",
				"two_factor_secret (encrypted at rest)",
			],
			retention:
				"Until the user requests deletion; wallet address is the primary key.",
		},
		api_keys: {
			description:
				"SHA256-hashed API keys. The plaintext key is shown to the user once at creation and never stored.",
			fields: [
				"key_hash",
				"key_prefix",
				"name",
				"created_at",
				"last_used_at",
				"expires_at",
			],
			retention:
				"Until the user revokes the key or it expires (default 90 days).",
		},
		credits: {
			description:
				"Prepaid credit balance, deposit history, and consumption log.",
			fields: [
				"balance_cents",
				"total_deposited_cents",
				"total_used_cents",
				"credit_batches (with expiry)",
			],
			retention:
				"Credit batches expire after the configured CREDIT_EXPIRY_DAYS (default 365).",
		},
		usage_records: {
			description:
				"Per-request usage records: model, provider, tokens, cost, and timing.",
			fields: [
				"request_id",
				"model",
				"provider",
				"input_tokens",
				"output_tokens",
				"cost_cents",
				"markup_cents",
				"total_cents",
				"latency_ms",
				"created_at",
			],
			retention:
				"Aggregated after 90 days; raw rows retained 365 days for billing disputes.",
		},
		inference_content: {
			description: "Request and response content for /v1/chat/completions.",
			fields: [],
			retention:
				"NOT STORED. Prompts and completions are forwarded to the upstream provider and are not retained by OMA.",
		},
	},
	data_not_stored: [
		"Raw chat prompts or completions (forwarded to provider; not logged)",
		"OpenAI/Anthropic API keys (only OMA-issued keys are stored, hashed)",
		"Credit card numbers (onramp is handled by third-party providers)",
		"IP addresses beyond the request itself (no long-term IP log)",
	],
	third_party_processors: {
		inference: [
			"Venice AI — primary LLM provider; processes prompts/completions",
			"CheapTokens.ai — procurement layer for Venice credits (operator-internal)",
			"Surplus Intelligence — fallback procurement (x402 payment on Base)",
		],
		payments: [
			"Circle (USDC) on Base — credit purchases and x402 settlement",
			"LI.FI, CCTP — cross-chain deposit routing",
		],
	},
	retention_policies: {
		idempotency_keys: "24 hours (Redis TTL)",
		rate_limit_buckets: "60 seconds sliding window (Redis)",
		pending_x402_orders: "configurable; expires automatically",
		circuit_breaker_state: "5 minutes (Redis TTL)",
	},
	user_rights: {
		export: "GET /v1/account/export — full account data export",
		delete: "POST /v1/account/delete — account and all data deletion",
		api_key_revoke: "DELETE /v1/api-keys/:id",
	},
	compliance: {
		gdpr: "Right to access, portability, and erasure honored via /v1/account/* endpoints.",
		ccpa: "Opt-out of data sale not applicable — OMA does not sell user data.",
	},
};

export const GET = withRateLimit(
	async () => {
		return NextResponse.json(PRIVACY_MANIFEST, {
			headers: {
				"Cache-Control": "public, max-age=3600, must-revalidate",
			},
		});
	},
	{ limiter: generalLimiter, route: "/api/v1/privacy" },
);
