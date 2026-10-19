/**
	* GET /openapi.json — minimal OpenAPI 3.1 spec for the public API.
	*
	* Hand-maintained (no zod-to-openapi codegen yet). The spec covers the
	* routes an SDK consumer needs to call: model catalog, chat completions,
	* balance, deposit, and the usage / keys lifecycle. Marked `infoOnly`
	* to remind callers this is documentation, not enforcement.
	*/
import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { config } from "../config.js";

export const openapiRoutes = new Hono<OmaEnv>();

const inferenceResponseHeaders = {
	"X-OMA-Request-ID": { schema: { type: "string" }, description: "Inference attempt ID; recorded usage uses this ID. Copy it to trace the request in dashboard usage or support." },
	"X-Request-ID": { schema: { type: "string" }, description: "HTTP trace ID. This can differ from the inference and upstream response-body IDs." },
};

function isInternalApiHost(url: string): boolean {
	try {
		const { hostname } = new URL(url);
		// Neon Function compute endpoints look like
		// <branch>-<fn>.compute.<region>.aws.neon.tech. They are the internal
		// origin the Vercel proxy forwards to, not the public API.
		return (
			hostname.endsWith(".neon.tech") ||
			hostname.endsWith(".compute.aws.neon.tech") ||
			hostname.includes(".compute.")
		);
	} catch {
		return false;
	}
}

export function getOpenApiServers(
	publicApiUrl: string,
	localPort: number,
	appUrl?: string,
) {
	const localApiUrl = `http://localhost:${localPort}`;
	const isLocalPublicUrl = (() => {
		try {
			const hostname = new URL(publicApiUrl).hostname;
			return hostname === "localhost" || hostname === "127.0.0.1";
		} catch {
			return false;
		}
	})();
	if (isLocalPublicUrl) {
		return [{ url: localApiUrl, description: "Local development" }];
	}
	// Only advertise resolvable, public HTTPS hosts in production. Shipping
	// `http://localhost:3001` in a public OpenAPI document points SDK
	// generators at the consumer's own machine, and a public URL that does not
	// resolve (e.g. an api. subdomain with no DNS record) makes every
	// generated client fail on first request.
	//
	// PUBLIC_API_URL is set to the Neon function hostname in production, so
	// when that happens advertise the canonical same-origin proxy the docs
	// actually use instead. An explicitly public PUBLIC_API_URL still wins.
	if (appUrl && isInternalApiHost(publicApiUrl)) {
		const origin = appUrl.replace(/\/+$/, "");
		if (origin) {
			return [{ url: `${origin}/api`, description: "Production" }];
		}
	}
	return [{ url: publicApiUrl, description: "Production" }];
}

const publicServers = getOpenApiServers(config.PUBLIC_API_URL, config.PORT, config.PUBLIC_APP_URL);
// The website exposes funding at the origin root, outside its /api SDK base.
const fundingServers = publicServers.map(({ url, description }) => ({ url: new URL(url).origin, description }));

const spec = {
	openapi: "3.1.0",
	info: {
		title: "OMA-AI Inference Gateway",
		version: "2.1.0",
		description:
			"OpenAI-compatible inference gateway. Routes to Venice (premium) and OMA-AI / Gonka.AI (decentralized). USDC on Base for credit top-ups; x402 verify/settle for agent USDC funding.",
	},
	servers: publicServers,
	components: {
		securitySchemes: {
			BearerAuth: { type: "http", scheme: "bearer" },
			SessionCookie: {
				type: "apiKey", in: "cookie",
				name: ["development", "test"].includes(config.NODE_ENV) ? "oma.session_token" : "__Secure-oma.session_token",
				description: "Better Auth session from magic-link or wallet sign-in. x402 settlement additionally requires the session wallet to own the payment.",
			},
		},
		schemas: {
			Model: {
				type: "object",
				required: ["id", "object", "created", "owned_by", "pricing"],
				properties: {
					id: { type: "string" },
					object: { type: "string", enum: ["model"] },
					created: { type: "integer" },
					owned_by: { type: "string" },
					context_length: { type: "integer" },
					max_output_tokens: { type: "integer", description: "Maximum response token budget, distinct from the context window" },
					supports_streaming: { type: "boolean" },
					supports_tools: { type: "boolean" },
					capabilities: {
						type: "array",
						items: { type: "string" },
						description: "Capabilities from the active model catalog, such as chat, reasoning, coding, tools, and vision.",
					},
					pricing: {
						type: "object",
						required: ["prompt", "completion"],
						properties: {
							prompt: { type: "number", description: "USD per 1M input tokens" },
							completion: { type: "number", description: "USD per 1M output tokens" },
							extended: { type: "object", properties: {
								context_token_threshold: { type: "integer", description: "Higher rates apply when input tokens exceed this threshold" },
								prompt: { type: "number", description: "USD per 1M input tokens" },
								completion: { type: "number", description: "USD per 1M output tokens" },
							} },
						},
					},
				},
			},
			ChatMessage: {
				type: "object",
				required: ["role", "content"],
				properties: {
					role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
					content: { type: ["string", "array", "null"] },
					name: { type: "string" },
					tool_call_id: { type: "string" },
					tool_calls: { type: "array" },
				},
			},
			ChatCompletionRequest: {
				type: "object",
				required: ["model", "messages"],
				properties: {
					model: {
						type: "string",
						description: "Primary OMA catalog model id",
					},
					models: {
						type: "array",
						maxItems: 8,
						items: { type: "string" },
						description:
							"OpenRouter-style fallback chain tried after `model` fails (before server peer map). Response `model` + x-actual-model reflect the peer that served.",
					},
					messages: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } },
					max_tokens: { type: "integer" },
					stream: { type: "boolean" },
					temperature: { type: "number" },
					top_p: { type: "number" },
					tools: { type: "array" },
					tool_choice: { type: ["string", "object"] },
				},
			},
			Balance: {
				type: "object",
				required: ["userId", "balanceCents", "totalDepositedCents", "totalUsedCents"],
				properties: {
					userId: { type: "string" },
					balanceCents: { type: "string" },
					totalDepositedCents: { type: "string" },
					totalUsedCents: { type: "string" },
				},
			},
			Usage: {
				type: "object",
				required: ["prompt_tokens", "completion_tokens", "total_tokens"],
				properties: {
					prompt_tokens: { type: "integer" },
					completion_tokens: { type: "integer" },
					total_tokens: { type: "integer" },
				},
			},
		},
	},
	security: [{ BearerAuth: [] }],
	paths: {
		"/user": { get: {
			summary: "Current account and admin status", security: [{ SessionCookie: [] }],
			responses: { "200": { description: "Current account profile" }, "401": { description: "Sign in required" } },
		} },
		"/sessions": {
			get: { summary: "List active sessions", security: [{ SessionCookie: [] }],
				responses: { "200": { description: "Sessions with isCurrent, expiry, and device details" }, "401": { description: "Sign in required" } } },
			delete: { summary: "Revoke all other sessions, retaining the current session", security: [{ SessionCookie: [] }],
				responses: { "200": { description: "success and revokedCount" }, "401": { description: "Sign in required" } } },
		},
		"/sessions/{id}": { delete: {
			summary: "Revoke an owned remote session", security: [{ SessionCookie: [] }],
			parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			responses: { "200": { description: "Session revoked" }, "400": { description: "Use sign-out for the current session" }, "401": { description: "Sign in required" }, "404": { description: "Session not found or not owned" } },
		} },
		"/account": { delete: {
			summary: "Permanently delete the current account", security: [{ SessionCookie: [] }],
			description: "Requires a session created within the last 24 hours. Deletes identity, sessions, API keys, and usage; forfeits remaining credits. Payment and security audit records are retained with the account ID detached. Clears session and installed API-key cookies.",
			responses: { "200": { description: "Account deleted and cookies cleared" }, "400": { description: "session_not_fresh: sign in again; session must be younger than 24 hours" }, "401": { description: "Sign in required" } },
		} },
		"/v1/history": { delete: {
			summary: "Clear usage history and previous audit logs", security: [{ SessionCookie: [] }],
			description: "Preserves identity, API keys, sessions, and balances. Records a new HISTORY_CLEARED audit event.",
			responses: { "200": { description: "success and deleted usageRecords/auditLogs counts" }, "401": { description: "Sign in required" } },
		} },
		"/v1/models": {
			get: {
				summary: "List the model catalog",
				responses: {
					"200": {
						description: "OpenAI-compatible model list",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										object: { type: "string", enum: ["list"] },
										data: { type: "array", items: { $ref: "#/components/schemas/Model" } },
									},
								},
							},
						},
					},
				},
			},
		},
		"/v1/chat/completions": {
			post: {
				summary: "OpenAI-compatible chat completion (streaming + tool calls)",
				description: "API key model restrictions apply to primary and fallback routes. max_tokens cannot exceed the model's published max_output_tokens. Idempotency-Key prevents concurrent upstream calls across both API formats; completed keys return 409 without another call or charge. Completion bodies are not retained for replay.",
				parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", minLength: 1, maxLength: 512 }, description: "Account-scoped retry key, at most 512 UTF-8 bytes. Use a new key for a new request; retain your original response." }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ChatCompletionRequest" },
						},
					},
				},
				responses: {
					"200": {
						description: "Completion (or SSE stream when stream=true)",
						headers: inferenceResponseHeaders,
						content: {
							"application/json": {
								schema: { type: "object" },
							},
							"text/event-stream": {
								schema: { type: "string" },
							},
						},
					},
					"401": { description: "Missing or invalid API key" },
					"402": { description: "Insufficient credit balance" },
					"403": { description: "Model outside API key scope" },
					"409": { description: "request_in_progress (Retry-After: 5) or already_processed (use your saved response)" },
					"429": { description: "Rate limited" },
					"502": { description: "Upstream provider error" },
				},
			},
		},
		"/v1/messages": {
			post: {
				summary: "Anthropic-compatible Messages API (Claude Code, Anthropic SDKs)",
				description:
					"Accepts Anthropic Messages request shape; routes through the same OMA catalog and billing as chat completions. Auth: Bearer oma_sk_… or x-api-key. Idempotency-Key is shared with chat completions on the same account, including requests made with another key.",
				parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", minLength: 1, maxLength: 512 }, description: "Account-scoped retry key, at most 512 UTF-8 bytes. Completed responses are not retained for replay." }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["model", "messages", "max_tokens"],
								properties: {
									model: { type: "string", description: "OMA catalog model id" },
									messages: {
										type: "array",
										items: {
											type: "object",
											properties: {
												role: { type: "string", enum: ["user", "assistant"] },
												content: { type: ["string", "array"] },
											},
										},
									},
									system: { type: ["string", "array"] },
									max_tokens: { type: "integer" },
									temperature: { type: "number" },
									top_p: { type: "number" },
									stream: { type: "boolean" },
									tools: { type: "array" },
									tool_choice: { type: ["string", "object"] },
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Anthropic-shaped message (or SSE when stream=true)", headers: inferenceResponseHeaders },
					"401": { description: "Missing or invalid API key" },
					"402": { description: "Insufficient credit balance" },
					"404": { description: "Unknown model id" },
					"409": { description: "request_in_progress (Retry-After: 5) or already_processed (use your saved response)" },
					"502": { description: "Upstream provider error" },
				},
			},
		},
		"/v1/balance": {
			get: {
				summary: "Current credit balance (cents)",
				responses: {
					"200": {
						description: "Balance",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Balance" },
							},
						},
					},
				},
			},
		},
		"/v1/usage": {
			get: {
				summary: "Paginated per-request usage history (model, provider, API key, token counts, cents)",
				description: "Private account history. Treat next_cursor as opaque and pass it unchanged. Totals cover every record matching the filters, independent of the cursor. totalCents is the original charge; billedCents is zero after a refund, with refundedAt preserving its timestamp. Monetary values are decimal-string cents.",
				parameters: [
					{ in: "query", name: "model", schema: { type: "string" } },
					{ in: "query", name: "provider", schema: { type: "string", enum: ["venice", "oma-ai"] } },
					{ in: "query", name: "api_key_id", schema: { type: "string", format: "uuid" } },
					{ in: "query", name: "since", schema: { type: "string", format: "date-time" } },
					{ in: "query", name: "until", schema: { type: "string", format: "date-time" } },
					{ in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 500, default: 50 } },
					{ in: "query", name: "cursor", schema: { type: "string" } },
				],
				responses: {
					"200": { description: "{object, data, next_cursor, totals: {requests, input_tokens, output_tokens, cost_cents}}. cost_cents excludes refunded charges." },
					"400": { description: "Invalid filters or cursor" },
					"401": { description: "Authentication required" },
				},
			},
		},
		"/v1/usage/summary": {
			get: {
				summary: "Complete account statistics, model/provider breakdowns and chart buckets",
				description: "Full-range aggregates, independent of request pagination. range is a rolling window; last24h always covers the preceding 24 hours. Billed cents exclude refunded charges, errors and cancellations are counted separately. Timeline includes zero buckets in the requested IANA timezone; all uses monthly buckets. Response contains range, timezone, bucket, from (null for all), to, lifetimeRequests, totals, last24h, models, providers and timeline. Each totals object includes requests, errors, aborted, free_requests, active_models, input_tokens, output_tokens, billed_cents (decimal string) and avg_latency_ms. Use from/to as since/until when loading the matching request history.",
				parameters: [
					{ in: "query", name: "range", schema: { type: "string", enum: ["24h", "7d", "30d", "all"], default: "7d" } },
					{ in: "query", name: "timezone", schema: { type: "string", default: "UTC" }, description: "IANA timezone, e.g. America/Moncton" },
				],
				responses: { "200": { description: "Private, uncached usage summary" }, "400": { description: "Invalid range or timezone" }, "401": { description: "Authentication required" } },
			},
		},
		"/v1/keys": {
			get: {
				summary: "List active API keys",
				security: [{ SessionCookie: [] }],
				description: "Lists key metadata including expiresAt, allowedModels and ipAllowlist. Expired keys can remain listed until revoked; they cannot authenticate. Never returns a raw key.",
				responses: { "200": { description: "Keys" } },
			},
			post: {
				summary: "Mint a new API key (returned once)",
				security: [{ SessionCookie: [] }],
				description: "Requires a Better Auth session, not an API bearer key. Raw key is returned once. Restrictions apply to both primary models and fallback routes. Default expiry is 90 days.",
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
					name: { type: "string", minLength: 1, maxLength: 64, default: "default" },
					expiresInDays: { type: "integer", minimum: 1, maximum: 365, default: 90 },
					allowedModels: { type: "array", minItems: 1, maxItems: 30, items: { type: "string" }, description: "OMA catalog IDs. Omit to allow all models." },
					ipAllowlist: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", maxLength: 64 }, description: "IPv4/IPv6 addresses or CIDR ranges. Only matching callers can use the key. Include your server's public outbound IP. Omit for unrestricted access." },
				} } } } },
				responses: { "200": { description: "New key, expiresAt, allowedModels and ipAllowlist" }, "400": { description: "Invalid JSON, name, expiry, model ID or IP restriction" }, "401": { description: "Session required" } },
			},
		},
		"/v1/keys/{id}": {
			delete: {
				summary: "Revoke an API key",
				security: [{ SessionCookie: [] }],
				parameters: [
					{ in: "path", name: "id", required: true, schema: { type: "string" } },
				],
				responses: { "200": { description: "Revoked" }, "404": { description: "Not found" } },
			},
		},
		"/v1/deposit/usdc": {
			get: {
				summary: "USDC deposit instructions (treasury address, network, bounds)",
				responses: { "200": { description: "Instructions" } },
			},
			post: {
				summary: "Submit a USDC tx hash for credit",
				responses: { "200": { description: "Pending" } },
			},
		},
		"/v1/deposit/usdc/challenge": {
			post: {
				summary: "Request a deposit challenge (returns a one-shot challenge token + nonce to sign with the funding wallet)",
				description: "Required first step of the USDC deposit flow. Server issues a one-shot, short-lived challenge bound to the calling account. The caller then signs the EIP-191 personal message with the funding wallet and POSTs the resulting challengeToken + signature to /v1/deposit/usdc. Without this step, the deposit submission returns 400 challenge_required.",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": {
						schema: {
							type: "object",
							required: ["fromAddress"],
							properties: {
								fromAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "EVM address that will fund the deposit (used for ownership proof and daily-rail accounting)" },
								amountCents: { type: "integer", minimum: 100, maximum: 1000000, description: "Optional preview amount in USD cents" },
							},
						},
					} },
				},
				responses: {
					"200": {
						description: "Challenge issued",
						content: { "application/json": {
							schema: {
								type: "object",
								required: ["challengeToken", "challengeMessage", "issuedAt", "expiresAt", "fromAddress", "treasuryAddress", "network", "assetAddress", "decimals", "minCents", "maxCents"],
								properties: {
									challengeToken: { type: "string", description: "Opaque one-shot token; pass back to /v1/deposit/usdc with the signature" },
									challengeMessage: { type: "string", description: "EIP-191 personal message the funding wallet must sign" },
									issuedAt: { type: "string", format: "date-time" },
									expiresAt: { type: "string", format: "date-time" },
									fromAddress: { type: "string" },
									treasuryAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
									network: { type: "string", enum: ["base"] },
									assetAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "Canonical USDC contract on the configured network" },
									decimals: { type: "integer", enum: [6] },
									minCents: { type: "integer" },
									maxCents: { type: "integer" },
								},
							},
						} },
					},
					"400": { description: "fromAddress missing or malformed" },
					"401": { description: "Authentication required" },
					"429": { description: "Challenge rate-limited" },
					"503": { description: "Deposit rail not configured (USDC_DEPOSIT_ADDRESS and TREASURY_BASE_ADDRESS both unset)" },
				},
			},
		},
		"/v1/deposit/status": {
			get: {
				summary: "Status of a pending or recent USDC deposit by request id",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }],
				parameters: [
					{ in: "query", name: "requestId", required: true, schema: { type: "string" } },
				],
				responses: {
					"200": { description: "Deposit status" },
					"404": { description: "No deposit with that request id" },
				},
			},
		},
		"/v1/usage/today": {
			get: {
				summary: "Today's free-chat quota (guest IP or signed-in account)",
				description: "Optional session or API-key authentication. Counts admitted free-chat attempts, including upstream failures; this read does not consume quota. Resets at midnight UTC. Paid API-key inference uses prepaid credits instead. Redis outages use bounded, process-local counters retaining observed usage; these are not durable across restarts.",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, {}],
				responses: { "200": {
					description: "Private, non-cacheable quota snapshot",
					content: { "application/json": { schema: {
						type: "object",
						required: ["used", "limit", "remaining", "resetMs", "policy"],
						properties: {
							used: { type: "integer", minimum: 0 },
							limit: { type: "integer", enum: [20, 100] },
							remaining: { type: "integer", minimum: 0 },
							resetMs: { type: "integer", minimum: 0, description: "Milliseconds until midnight UTC" },
							policy: { type: "string", enum: ["shared-redis", "degraded-memory"] },
						},
					} } },
				} },
			},
		},
		"/v1/search": {
			get: {
				summary: "Web search (chat playground grounding)",
				description:
					"Optional auth. DuckDuckGo HTML + Instant Answer (no API key). Returns { query, results, provider: \"duckduckgo\" }; empty results on total failure.",
				parameters: [
					{
						in: "query",
						name: "query",
						required: true,
						schema: { type: "string", minLength: 1, maxLength: 500 },
					},
				],
				security: [],
				responses: {
					"200": {
						description: "Search results (may be empty)",
					},
				},
			},
		},
		"/x402/info": {
			servers: fundingServers,
			get: {
				summary: "Discover the current x402 funding recipient and signing information",
				description: "Read payTo, network, and asset before signing; the direct-deposit address may differ. Choose the funding amount yourself. This request does not move funds.",
				security: [],
				responses: {
					"200": { description: "Current funding configuration", content: { "application/json": { schema: {
						type: "object",
						required: ["x402Version", "scheme", "network", "asset", "decimals", "payTo", "maxTimeoutSeconds", "extra"],
						properties: {
							x402Version: { type: "integer", enum: [2] },
							scheme: { type: "string", enum: ["exact"] },
							network: { type: "string", enum: ["eip155:8453"] },
							asset: { type: "string", description: "USDC contract on Base" },
							decimals: { type: "integer", enum: [6] },
							payTo: { type: "string", description: "Configured x402 treasury address" },
							maxTimeoutSeconds: { type: "integer" },
							extra: { type: "object", properties: { name: { type: "string" }, version: { type: "string" } } },
						},
					} } } },
					"503": { description: "Funding recipient is not configured" },
				},
			},
		},
		"/x402/verify": {
			servers: fundingServers,
			post: {
				summary: "Verify and broadcast an EIP-3009 USDC transfer",
				description: "Moves the authorized USDC to the pinned treasury and waits for on-chain confirmation; this is not a dry run. The facilitator pays gas. Save the returned txHash, then call /x402/settle with the payer wallet's SIWE session to credit the account. Rate-limited at 10/min/IP. Returns 503 funding_paused or funding_status_unavailable before moving funds when new crypto funding is unavailable. Existing transfers can still be credited through /x402/settle during a funding pause.",
				security: [],
				parameters: [{
					in: "header", name: "PAYMENT-SIGNATURE", required: true,
					schema: { type: "string" },
					description: "Base64-encoded x402 v2 envelope containing accepted requirements and the signed EIP-3009 authorization.",
				}],
				responses: {
					"200": { description: "Confirmed payment: valid, txHash, amount (decimal USDC), and networkId" },
					"400": { description: "Missing or malformed payment envelope, unsupported chain/asset, or incorrect recipient" },
					"422": { description: "Verification or transfer did not succeed; inspect transaction status before authorizing another payment" },
					"429": { description: "Verification rate limit exceeded" },
					"500": { description: "Funding service failure" },
				},
			},
		},
		"/x402/settle": {
			servers: fundingServers,
			post: {
				summary: "Credit a confirmed USDC payment to the authenticated payer",
				description: "Does not initiate another transfer. Requires a SIWE session for the payment sender; an API key is not accepted. Uses the confirmed amount, never a caller-supplied amount. Retries for the same account and transaction credit once; confirmed payments can be recovered after a server restart.",
				security: [{ SessionCookie: [] }],
				requestBody: { required: true, content: { "application/json": { schema: {
					type: "object", required: ["txHash", "networkId"],
					properties: {
						txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
						networkId: { type: "string", enum: ["base", "eip155:8453"] },
					},
				} } } },
				responses: {
					"200": { description: "Signed settlement receipt and creditedCents" },
					"400": { description: "Malformed request or no confirmed payment evidence" },
					"401": { description: "No valid session" },
					"403": { description: "Session wallet does not own the payment, or account is suspended" },
					"409": { description: "Non-retryable payment_already_credited or payment_reconciliation_required conflict; contact support when reconciliation is required" },
					"422": { description: "Settlement rejected" },
					"500": { description: "Credit application failed; retry settlement with the same transaction hash" },
				},
			},
		},
		"/health": {
			get: {
				summary: "Liveness probe",
				security: [],
				responses: { "200": { description: "OK" } },
			},
		},
	},
};

/** This module contains customer endpoints only; operator contracts live in docs/PLATFORM.md. */
export function getPublicOpenApiSpec() {
	return spec;
}

openapiRoutes.get("/openapi.json", (c) => c.json(getPublicOpenApiSpec()));
openapiRoutes.get("/openapi", (c) => c.json(getPublicOpenApiSpec()));
// Common alternate paths used by SDK generators / agent tooling
openapiRoutes.get("/v1/openapi.json", (c) => c.json(getPublicOpenApiSpec()));
openapiRoutes.get("/v1/openapi", (c) => c.json(getPublicOpenApiSpec()));
