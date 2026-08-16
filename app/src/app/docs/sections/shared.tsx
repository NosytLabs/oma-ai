"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { useRevealInView } from "@/lib/use-reveal-in-view";
import { MODEL_COUNT, MODELS } from "@/lib/models-data";
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
	method: "GET" | "POST";
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
];

// Per-model overrides — mirrors MODEL_LIMITS in
// server/src/middleware/rate-limit/utils.ts exactly.
export const MODEL_RATE_OVERRIDES: ModelRateOverride[] = [
	{ model: "llama-3.3-70b", rpm: 60, tpm: 120000 },
	{ model: "gemini-3-flash-preview", rpm: 60, tpm: 120000 },
	{ model: "kimi-k3", rpm: 60, tpm: 120000 },
	// Still defined on the server; not always in the curated public catalog.
	{ model: "llama-3.2-3b", rpm: 120, tpm: 240000 },
];

export const MODEL_PRICING_ROWS: ModelPricing[] = MODELS.map((m) => ({
	id: m.id,
	name: m.name,
	input: m.inputPricePer1M,
	output: m.outputPricePer1M,
	ctx: m.contextLength,
}));

export const ENDPOINTS: EndpointInfo[] = [
	{
		method: "POST",
		path: "/v1/chat/completions",
		anchor: "ep-chat",
		title: "Chat Completions",
		desc: "OpenAI-compatible multi-turn chat. The endpoint you will hit 95% of the time. Supports SSE streaming.",
		auth: "Bearer token (API key) or PAYMENT-SIGNATURE (x402)",
		body: {
			model:
				'string (required). Any model id from /v1/models, e.g. "llama-3.3-70b"',
			messages:
				"array of { role, content }. role is system, user, assistant, or tool",
			temperature: "number 0 to 2 (optional, default from upstream)",
			max_tokens: "integer. Cap on completion length",
			stream: "boolean. Server-Sent Events when true (text/event-stream)",
			tools: "array of tool definitions (optional)",
			response_format: 'object (optional), e.g. { type: "json_object" }',
		},
		response: `{
	"id": "chatcmpl-9f3k2a",
	"object": "chat.completion",
	"created": 1717194000,
	"model": "llama-3.3-70b",
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
		desc: "Anthropic-compatible Messages API for Claude Code and the Anthropic SDK. Same catalog and billing as chat completions. Auth: Bearer oma_sk_… or x-api-key.",
		auth: "Bearer token (API key) or x-api-key",
		body: {
			model: 'string (required). OMA catalog id, e.g. "kimi-k3"',
			messages: "array of { role: user|assistant, content }",
			max_tokens: "integer (required by Anthropic clients)",
			system: "string or content blocks (optional)",
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
		desc: "Returns every model currently routable (chat completions). No auth required. Cached for 1h.",
		auth: "None",
		response: `{
	"object": "list",
	"data": [
	{
	"id": "llama-3.3-70b",
	"object": "model",
	"created": 1717194000,
	"owned_by": "oma",
	"permission": [],
	"root": "llama-3.3-70b",
	"parent": null,
	"pricing": { "prompt": "0.00000150", "completion": "0.00000550" },
	"category": "chat",
	"context_length": 8192
	},
	{
	"id": "deepseek-v4-flash-0731-openbroker",
	"object": "model",
	"created": 1717194000,
	"owned_by": "gonka",
	"pricing": { "prompt": "0.00000000", "completion": "0.00000000" },
	"category": "budget",
	"context_length": 262144
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
		response: `{			"id": "llama-3.3-70b",
	"object": "model",
	"created": 1717194000,
	"owned_by": "venice",
	"display_name": "Llama 3.3 70B",
	"provider": "venice",
	"category": "mid",
	"context_length": 128000,
	"supports_streaming": true,
	"supports_tools": true,
	"pricing": { "prompt": "1.50", "completion": "5.50" }
}`,
	},
	{
		method: "GET",
		path: "/api/auth/get-session",
		anchor: "ep-session",
		title: "Session Lookup",
		desc: "Reads the current authenticated session. Used by middleware to gate protected routes and by client-side auth hooks.",
		auth: "Session cookie (set by magic-link or SIWE sign-in)",
		body: undefined,
		response: `{
	"user": { "id": "usr_…", "email": "…" },
	"session": { "expiresAt": "…" }
}`,
	},
	{
		method: "GET",
		path: "/api/auth/siwe/nonce · POST /api/auth/siwe/verify",
		anchor: "ep-siwe",
		title: "SIWE Nonce + Verify",
		desc: "Wallet sign-in via EIP-4361 on Base mainnet. Issue a nonce, sign the message with your wallet, then verify — the server sets the HttpOnly session cookie.",
		auth: "None (nonce is public); POST verifies the signed message via viem",
		body: {
			message: "string (required). The EIP-4361 message the wallet signed",
			signature: "string (required). Hex signature from the wallet",
			walletAddress: "string (required). Signer address",
			chainId: "number (required). 8453 for Base mainnet",
		},
		response: `{
	"user": { "id": "usr_…", "walletAddress": "0x…" }
}`,
	},
	{
		method: "POST",
		path: "/api/auth/sign-in/magic-link",
		anchor: "ep-magic-link",
		title: "Magic Link",
		desc: "Passwordless email sign-in. Sends a single-use link (5-minute expiry). Clicking it sets the HttpOnly session cookie.",
		auth: "None",
		body: { email: "string (required). Recipient email address" },
		response: `{ "status": 200 }`,
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
		desc: "Creates a Polar hosted-checkout session for Hobby ($10/1000cr), Builder ($50/5000cr), or Scale ($250/25000cr). Polar's webhook credits the user on order.paid.",
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
		title: "Daily Free-Tier Usage",
		desc: "How many free messages you have left today. 20/day for anonymous (IP-keyed Redis), 100/day for authenticated users.",
		auth: "Bearer token (API key) — anonymous allowed",
		body: undefined,
		response: `{
	"used": 12,
	"limit": 20,
	"remaining": 8,
	"resetMs": 12345678
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
		path: "/webhooks/polar",
		anchor: "ep-polar-webhook",
		title: "Polar Webhook (inbound)",
		desc: "Polar sends signed POSTs here on order events. We verify the HMAC signature, look up the user from checkout metadata, and credit/drain accordingly. Idempotent on webhook-id.",
		auth: "HMAC SHA-256 signature (Standard Webhooks)",
		body: undefined,
		response: `{ "ok": true, "duplicate": true } // 200 on success or duplicate`,
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
		desc: "Missing or invalid API key.",
	},
	{
		code: 402,
		type: "payment_error",
		desc: "Insufficient credits. Deposit more or use x402 pay-per-request.",
	},
	{
		code: 429,
		type: "rate_limit_error",
		desc: "Rate limit exceeded. Wait Retry-After seconds, then retry.",
	},
	{
		code: 500,
		type: "internal_error",
		desc: "Unexpected server error (also server_error). Contact support if persistent.",
	},
	{
		code: 503,
		type: "service_unavailable",
		desc: "All upstream providers down. Try again shortly.",
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
		title: "Add to Headers",
		desc: "Include your key in the Authorization header: Bearer oma_sk_...",
	},
	{
		n: "3",
		id: "qs-step-response",
		title: "Start Building",
		desc: "Use the OpenAI SDK with base_url=https://api.oma-ai.com/v1",
	},
];

/* ==================== HELPERS ==================== */

export function fmt(n: number): string {
	if (n <= 0) return "$0.00";
	// Round UP to the nearest $0.05 — standardized billing increments.
	const rounded = Math.ceil(n * 20) / 20;
	return `$${rounded.toFixed(2)}`;
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
			className={`absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border bg-surface/95 px-2.5 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider backdrop-blur-sm transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-accent/60 hover:text-accent active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
			{title && (
				<div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
					<span className="text-xs font-medium text-text-muted font-mono">
						{title}
					</span>
				</div>
			)}
			<CopyButton text={code} id={id} />
			<div
				aria-label={`${title ?? "Code example"} — ${id}`}
				role="region"
				tabIndex={0}
				className="max-w-full min-w-0 overflow-x-auto p-4 text-sm leading-relaxed"
			>
				<pre id={id} tabIndex={0} className="m-0 max-w-full leading-relaxed">
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
			<div className="flex max-w-full overflow-x-auto border-b border-border/50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
			<div className="relative min-w-0 max-w-full">
				<CopyButton text={tabs[active].code} id={id} />
				<div
					role="region"
					aria-label={`${tabs[active].label} — ${id}`}
					tabIndex={0}
					className="max-w-full min-w-0 overflow-x-auto p-4 text-sm leading-relaxed"
				>
					<pre id={id} tabIndex={0} className="m-0 max-w-full leading-relaxed">
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