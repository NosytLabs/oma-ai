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
				"Account identity via Better Auth: passwordless email magic link OR EIP-4361 wallet (SIWE) sign-in. No password stored. Email is required for the email-OTP path; the SIWE path auto-derives {address}@oma-ai.com when no email is supplied.",
			fields: [
				"email (optional — required for magic-link + OTP, derived for SIWE-only)",
				"wallet_address (lowercased EVM address; populated when SIWE is used)",
				"user_id (Better Auth UUID, primary key)",
				"suspended (boolean + reason; set by operators for policy violations)",
				"role (default 'user'; 'admin' for operators)",
			],
			retention:
				"Until the user requests deletion via DELETE /account. The user row + linked creditBalances + sessions are removed in a single transaction.",
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
				"Credits never expire while the account is active; they are removed on account deletion.",
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
			"OMA-AI budget-tier upstreams — serve MiniMax M2.7 and DeepSeek V4 Flash; prompts forwarded for completion only, not retained",
		],
		payments: [
			"Circle (USDC) on Base — credit purchases and x402 settlement",
		],
	},
	retention_policies: {
		idempotency_keys: "24 hours (Redis TTL)",
		rate_limit_buckets: "60 seconds sliding window (Redis)",
		pending_x402_orders: "configurable; expires automatically",
		circuit_breaker_state: "5 minutes (Redis TTL)",
	},
	user_rights: {
		export: "GET /v1/export/account — full account data export",
		delete: "DELETE /account — account and all data deletion",
		api_key_revoke: "DELETE /v1/keys/:id",
	},
	compliance: {
		gdpr: "Right to access, portability, and erasure honored via /v1/export/account and DELETE /account.",
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
