import originGuardPaths from "../middleware/origin-guard-paths.json" with { type: "json" };
/**
 * Public contract shared by the HTTP spec and the server-rendered reference.
 */
export interface OpenApiOptions {
 publicApiUrl: string;
 localPort: number;
 appUrl?: string;
 nodeEnv: string;
}

const inferenceResponseHeaders = {
	"X-OMA-Request-ID": { schema: { type: "string" }, description: "Inference attempt ID; recorded usage uses this ID. Copy it to trace the request in dashboard usage or support." },
	"X-Request-ID": { schema: { type: "string" }, description: "HTTP trace ID. This can differ from the inference and upstream response-body IDs." },
};

const publicBalanceProperties = {
	balanceCents: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]+)?$", description: "Nonnegative spendable credits in decimal-string cents. Refund shortfalls are reported separately as debtCents." },
	debtCents: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]+)?$", description: "Present only for a positive shortfall after a cash refund removes credits already spent or reserved. Exact decimal-string cents. Future top-ups first offset this shortfall before credits become spendable." },
};

function jsonSuccess<const T extends object>(description: string, schema: T) {
    return { description, content: { "application/json": { schema } } };
}

const keyMetadataSchema = {
    type: "object", required: ["id", "name", "prefix", "createdAt", "expiresAt", "allowedModels", "ipAllowlist"],
    properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, prefix: { type: "string" }, createdAt: { type: "string", format: "date-time" }, lastUsedAt: { type: ["string", "null"], format: "date-time" }, expiresAt: { type: ["string", "null"], format: "date-time" }, allowedModels: { type: ["array", "null"], items: { type: "string" } }, ipAllowlist: { type: ["array", "null"], items: { type: "string" } } },
};
const healthSchema = { type: "object", required: ["status", "service", "timestamp"], properties: { status: { type: "string", enum: ["ok"] }, service: { type: "string", enum: ["oma-ai"] }, timestamp: { type: "string", format: "date-time" } } };
const readinessSchema = { type: "object", required: ["status", "service", "uptimeSec", "checks"], properties: { status: { type: "string", enum: ["ready", "not_ready"] }, service: { type: "string" }, uptimeSec: { type: "integer", minimum: 0 }, checks: { type: "object", required: ["database", "redis"], additionalProperties: { type: "object", required: ["ok", "status"], properties: { ok: { type: "boolean" }, status: { type: "string" }, latencyMs: { type: "number" }, error: { type: "string" } } } } } };

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

export function buildPublicOpenApiSpec(options: OpenApiOptions) {
const publicServers = getOpenApiServers(options.publicApiUrl, options.localPort, options.appUrl);
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
			ApiKeyHeader: { type: "apiKey", in: "header", name: "x-api-key", description: "OMA API key, accepted by Anthropic-compatible clients and the other bearer-auth routes." },
			SessionCookie: {
				type: "apiKey", in: "cookie",
				name: ["development", "test"].includes(options.nodeEnv) ? "oma.session_token" : "__Secure-oma.session_token",
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
					created: { type: "integer", enum: [0], description: "0 means the provider creation timestamp is not supplied. It is not the time of this request." },
					owned_by: { type: "string" },
					privacy: { type: "string", enum: ["private", "anonymized", "unverified"], description: "Provider route privacy, verified from its catalog when available." },
					architecture: { type: "object", required: ["input_modalities", "output_modalities"], properties: { input_modalities: { type: "array", items: { type: "string" } }, output_modalities: { type: "array", items: { type: "string" } } } },
					metadata_verification: { type: "object", required: ["status", "source_url", "verified_at", "note"], properties: { status: { type: "string", enum: ["verified", "unverified"] }, source_url: { type: "string", format: "uri" }, verified_at: { type: "string", format: "date" }, note: { type: "string" } }, description: "Unverified provider limits are OMA configuration, not confirmed upstream context/output guarantees. Retail prices are set by OMA." },
					available: { type: "boolean", description: "Enabled by configured credentials, policy and pause flags; does not prove a successful live inference request." },
					unavailable_reason: { type: "string" },
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
						items: { type: "string", minLength: 1 },
						description:
							"OpenRouter-style fallback chain tried after `model` fails (before server peer map). Response `model` + x-actual-model reflect the peer that served.",
					},
					messages: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/ChatMessage" } },
					max_tokens: { type: "integer", minimum: 1, description: "Positive completion budget; must fit the selected model’s max_output_tokens. If omitted, defaults to the smaller of 4096 and the model output ceiling." },
					stream: { type: "boolean", default: false },
					temperature: { type: "number", minimum: 0, maximum: 2 },
					top_p: { type: "number", minimum: 0, maximum: 1 },
					tools: { type: "array" },
					tool_choice: {},
				},
			},
            AnthropicTextBlock: { type: "object", required: ["type", "text"], properties: { type: { type: "string", enum: ["text"] }, text: { type: "string" } } },
            AnthropicToolUseBlock: { type: "object", required: ["type", "id", "name", "input"], properties: { type: { type: "string", enum: ["tool_use"] }, id: { type: "string", minLength: 1 }, name: { type: "string", minLength: 1 }, input: { type: "object", additionalProperties: true } } },
            AnthropicToolResultBlock: { type: "object", required: ["type", "tool_use_id", "content"], properties: { type: { type: "string", enum: ["tool_result"] }, tool_use_id: { type: "string", minLength: 1 }, content: { oneOf: [{ type: "string" }, { type: "array", items: { $ref: "#/components/schemas/AnthropicTextBlock" } }] }, is_error: { type: "boolean" } } },
			Balance: {
				type: "object",
				required: ["userId", "balanceCents", "totalDepositedCents", "totalUsedCents"],
				properties: {
					userId: { type: "string" },
					...publicBalanceProperties,
					totalDepositedCents: { type: "string" },
					totalUsedCents: { type: "string" },
					reservedCents: { type: "string", description: "Active inference credit holds, in decimal-string cents." },
					reconciliationCents: { type: "string", description: "Uncertain inference holds awaiting reconciliation, separately from active reservations." },
					lastActivityAt: { type: ["string", "null"], format: "date-time" },
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
	security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
	paths: {
		"/user": { get: {
			summary: "Current account profile", security: [{ SessionCookie: [] }],
			responses: { "200": jsonSuccess("Current account profile", { type: "object", required: ["id", "email", "name", "evmAddress", "isAnonymous", "role", "createdAt"], properties: { id: { type: "string" }, email: { type: "string" }, name: { type: "string" }, evmAddress: { type: ["string", "null"] }, isAnonymous: { type: "boolean" }, role: { type: ["string", "null"] }, createdAt: { type: "string", format: "date-time" } } }), "401": { description: "Sign in required" } },
		} },
		"/sessions": {
			get: { summary: "List active sessions", security: [{ SessionCookie: [] }],
				responses: { "200": jsonSuccess("Active sessions", { type: "object", required: ["sessions"], properties: { sessions: { type: "array", items: { type: "object", required: ["id", "createdAt", "expiresAt", "userAgent", "ipAddress", "isCurrent"], properties: { id: { type: "string" }, createdAt: { type: "string", format: "date-time" }, expiresAt: { type: "string", format: "date-time" }, userAgent: { type: ["string", "null"] }, ipAddress: { type: ["string", "null"] }, isCurrent: { type: "boolean" } } } } } }), "401": { description: "Sign in required" } } },
			delete: { summary: "Revoke all other sessions, retaining the current session", security: [{ SessionCookie: [] }],
				responses: { "200": jsonSuccess("Other sessions revoked", { type: "object", required: ["success", "revokedCount"], properties: { success: { type: "boolean", enum: [true] }, revokedCount: { type: "integer", minimum: 0 } } }), "401": { description: "Sign in required" } } },
		},
		"/sessions/{id}": { delete: {
			summary: "Revoke an owned remote session", security: [{ SessionCookie: [] }],
			parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[A-Za-z0-9_-]{8,64}$" } }],
			responses: { "200": jsonSuccess("Session revoked", { type: "object", required: ["success", "id"], properties: { success: { type: "boolean", enum: [true] }, id: { type: "string" } } }), "400": { description: "Use sign-out for the current session" }, "401": { description: "Sign in required" }, "404": { description: "Session not found or not owned" } },
		} },
		"/account": { delete: {
			summary: "Permanently delete the current account", security: [{ SessionCookie: [] }],
			description: "Requires a session created within the last 24 hours. Deletes identity, sessions, API keys, usage and operational deposit/balance rows; forfeits remaining credits. Detached inference financial receipts and security audit records remain for reconciliation. Clears session and installed API-key cookies.",
			responses: { "200": jsonSuccess("Account deleted and cookies cleared", { type: "object", required: ["success"], properties: { success: { type: "boolean", enum: [true] } } }), "400": { description: "session_not_fresh: sign in again; session must be younger than 24 hours" }, "401": { description: "Sign in required" } },
		} },
		"/v1/history": { delete: {
			summary: "Clear usage history and previous audit logs", security: [{ SessionCookie: [] }],
			description: "Preserves identity, API keys, sessions, and balances. Records a new HISTORY_CLEARED audit event.",
			responses: { "200": jsonSuccess("History cleared", { type: "object", required: ["success", "deleted"], properties: { success: { type: "boolean", enum: [true] }, deleted: { type: "object", required: ["usageRecords", "auditLogs"], properties: { usageRecords: { type: "integer", minimum: 0 }, auditLogs: { type: "integer", minimum: 0 } } } } }), "401": { description: "Sign in required" } },
		} },
		"/v1/models": {
			get: {
				summary: "List the model catalog",
				security: [],
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
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
				description: "Only the documented request fields are forwarded. Unknown fields, including reasoning_effort, response_format, stop and max_completion_tokens, are currently ignored. API key model restrictions apply to primary and fallback routes. max_tokens cannot exceed the model's configured max_output_tokens. Idempotency-Key prevents concurrent upstream calls across both API formats; completed keys return 409 without another call or charge. Completion bodies are not retained for replay.",
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
					"400": { description: "Invalid request body, output budget or idempotency key" },
                    "404": { description: "Unknown model ID" },
                    "503": { description: "Model unavailable or emergency rate budget exhausted" },
					"401": { description: "Missing or invalid API key" },
					"402": { description: "Insufficient credit balance" },
					"403": { description: "Model outside API key scope" },
					"409": { description: "request_in_progress (Retry-After: 5) or already_processed (use your saved response)" },
					"429": { description: "Rate limited" },
					"502": { description: "Upstream provider error" },
				},
			},
		},
        "/v1/messages": { post: {
            summary: "Anthropic-compatible Messages API",
            security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
            description: "Unknown request fields are ignored and not forwarded. Text and tool-use Anthropic Messages requests, translated to the same OMA provider routing and credit ledger. Image/document content blocks are not supported. max_tokens is required and must fit the selected model. Idempotency-Key is account-scoped and shared with chat completions; completed responses are not retained for replay.",
            parameters: [{ name: "Idempotency-Key", in: "header", schema: { type: "string", minLength: 1, maxLength: 512 }, description: "At most 512 UTF-8 bytes. Use a new value for each new request." }],
            requestBody: { required: true, content: { "application/json": { schema: {
                type: "object", required: ["model", "messages", "max_tokens"],
                properties: {
                    model: { type: "string", description: "OMA catalog model ID" },
                    messages: { type: "array", minItems: 1, items: { oneOf: [
                        { type: "object", required: ["role", "content"], properties: { role: { type: "string", enum: ["user"] }, content: { oneOf: [{ type: "string" }, { type: "array", minItems: 1, items: { oneOf: [{ $ref: "#/components/schemas/AnthropicTextBlock" }, { $ref: "#/components/schemas/AnthropicToolResultBlock" }] } }] } } },
                        { type: "object", required: ["role", "content"], properties: { role: { type: "string", enum: ["assistant"] }, content: { oneOf: [{ type: "string" }, { type: "array", minItems: 1, items: { oneOf: [{ $ref: "#/components/schemas/AnthropicTextBlock" }, { $ref: "#/components/schemas/AnthropicToolUseBlock" }] } }] } } },
                    ] } },
                    system: { oneOf: [{ type: "string" }, { type: "array", items: { $ref: "#/components/schemas/AnthropicTextBlock" } }] },
                    max_tokens: { type: "integer", minimum: 1 }, temperature: { type: "number", minimum: 0, maximum: 1 }, top_p: { type: "number", minimum: 0, maximum: 1 }, stream: { type: "boolean", default: false },
                    tools: { type: "array", items: { type: "object", required: ["name", "input_schema"], properties: { name: { type: "string", minLength: 1 }, description: { type: "string" }, input_schema: { type: "object", additionalProperties: true } } } },
                    tool_choice: { oneOf: [ { type: "object", required: ["type"], properties: { type: { type: "string", enum: ["auto", "any", "none"] } } }, { type: "object", required: ["type", "name"], properties: { type: { type: "string", enum: ["tool"] }, name: { type: "string", minLength: 1 } } } ] },
                },
            } } } },
            responses: { "200": { description: "Anthropic message, or Anthropic event stream when stream=true", headers: inferenceResponseHeaders, content: { "application/json": { schema: { type: "object", required: ["id", "type", "role", "model", "content", "stop_reason", "stop_sequence", "usage"], properties: { id: { type: "string" }, type: { type: "string", enum: ["message"] }, role: { type: "string", enum: ["assistant"] }, model: { type: "string" }, content: { type: "array", items: { oneOf: [{ $ref: "#/components/schemas/AnthropicTextBlock" }, { $ref: "#/components/schemas/AnthropicToolUseBlock" }] } }, stop_reason: { type: "string" }, stop_sequence: { type: "null" }, usage: { type: "object", required: ["input_tokens", "output_tokens"], properties: { input_tokens: { type: "integer", minimum: 0 }, output_tokens: { type: "integer", minimum: 0 } } } } } }, "text/event-stream": { schema: { type: "string" } } } },
                "400": { description: "Invalid body or model output budget" }, "401": { description: "Missing or invalid credentials" }, "402": { description: "Insufficient credits" }, "403": { description: "Model outside API key scope or account suspended" }, "404": { description: "Unknown model ID" }, "409": { description: "request_in_progress (Retry-After: 5) or already_processed" }, "429": { description: "Rate limited" }, "502": { description: "Upstream provider failure" }, "503": { description: "Model unavailable or emergency rate budget exhausted" } },
        } },
		"/v1/balance": {
			get: {
				summary: "Current credit balance (cents)",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
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
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
				description: "Private account history. Treat next_cursor as opaque and pass it unchanged. Totals cover every record matching the filters, independent of the cursor. totalCents is the original charge; billedCents is zero after a refund, with refundedAt preserving its timestamp. Monetary values are decimal-string cents.",
				parameters: [
					{ in: "query", name: "model", schema: { type: "string", maxLength: 150 } },
					{ in: "query", name: "provider", schema: { type: "string", enum: ["venice", "oma-ai"] } },
					{ in: "query", name: "api_key_id", schema: { type: "string", format: "uuid" } },
					{ in: "query", name: "since", schema: { type: "string", format: "date-time" } },
					{ in: "query", name: "until", schema: { type: "string", format: "date-time" } },
					{ in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 500, default: 50 } },
					{ in: "query", name: "cursor", schema: { type: "string", maxLength: 512 } },
				],
				responses: {
					"200": jsonSuccess("Owner-scoped usage records and full filtered totals", { type: "object", required: ["object", "data", "next_cursor", "totals"], properties: { object: { type: "string", enum: ["list"] }, data: { type: "array", maxItems: 500, items: { type: "object", required: ["id", "requestId", "model", "provider", "inputTokens", "outputTokens", "costCents", "markupCents", "totalCents", "billedCents", "refundedAt", "status", "createdAt"], properties: { id: { type: "string", format: "uuid" }, requestId: { type: ["string", "null"] }, apiKeyId: { type: ["string", "null"] }, model: { type: "string" }, provider: { type: "string" }, inputTokens: { type: "integer" }, outputTokens: { type: "integer" }, costCents: { type: "string" }, markupCents: { type: "string" }, totalCents: { type: "string" }, billedCents: { type: "string" }, refundedAt: { type: ["string", "null"], format: "date-time" }, status: { type: "string" }, createdAt: { type: "string", format: "date-time" } } } }, next_cursor: { type: ["string", "null"] }, totals: { type: "object", required: ["requests", "input_tokens", "output_tokens", "cost_cents"], properties: { requests: { type: "integer" }, input_tokens: { type: "integer" }, output_tokens: { type: "integer" }, cost_cents: { type: "string" } } } } }),
					"400": { description: "Invalid filters or cursor" },
					"401": { description: "Authentication required" },
				},
			},
		},
		"/v1/usage/summary": {
			get: {
				summary: "Complete account statistics, model/provider breakdowns and chart buckets",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
				description: "Full-range aggregates, independent of request pagination. range is a rolling window; last24h always covers the preceding 24 hours. Billed cents exclude refunded charges, errors and cancellations are counted separately. Timeline includes zero buckets in the requested IANA timezone; all uses monthly buckets. Response contains range, timezone, bucket, from (null for all), to, lifetimeRequests, totals, last24h, models, providers and timeline. Each totals object includes requests, errors, aborted, free_requests, active_models, input_tokens, output_tokens, billed_cents (decimal string) and avg_latency_ms. Use from/to as since/until when loading the matching request history.",
				parameters: [
					{ in: "query", name: "range", schema: { type: "string", enum: ["24h", "7d", "30d", "all"], default: "7d" } },
					{ in: "query", name: "timezone", schema: { type: "string", maxLength: 100, default: "UTC" }, description: "IANA timezone, e.g. America/Moncton" },
				],
				responses: { "200": jsonSuccess("Private usage summary", { type: "object", required: ["range", "timezone", "bucket", "from", "to", "totals", "last24h", "lifetimeRequests", "models", "providers", "timeline"], properties: { range: { type: "string", enum: ["24h", "7d", "30d", "all"] }, timezone: { type: "string" }, bucket: { type: "string", enum: ["month", "day"] }, from: { type: ["string", "null"], format: "date-time" }, to: { type: "string", format: "date-time" }, totals: { type: "object" }, last24h: { type: "object" }, lifetimeRequests: { type: "integer" }, models: { type: "array", items: { type: "object" } }, providers: { type: "array", items: { type: "object" } }, timeline: { type: "array", items: { type: "object" } } } }), "400": { description: "Invalid range or timezone" }, "401": { description: "Authentication required" } },
			},
		},
		"/v1/keys": {
			get: {
				summary: "List active API keys",
				security: [{ SessionCookie: [] }],
				description: "Lists key metadata including expiresAt, allowedModels and ipAllowlist. Expired keys can remain listed until revoked; they cannot authenticate. Never returns a raw key.",
				responses: { "200": jsonSuccess("API key metadata", { type: "object", required: ["keys"], properties: { keys: { type: "array", items: keyMetadataSchema } } }), "401": { description: "Session required" } },
			},
			post: {
				summary: "Mint a new API key (returned once)",
				security: [{ SessionCookie: [] }],
				description: "Requires a Better Auth session, not an API bearer key. Raw key is returned once. Restrictions apply to both primary models and fallback routes. Default expiry is 90 days.",
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
					name: { type: "string", minLength: 1, maxLength: 64, default: "default" },
					expiresInDays: { type: "integer", minimum: 1, maximum: 365, default: 90 },
					allowedModels: { type: "array", minItems: 1, maxItems: 30, items: { type: "string", minLength: 1 }, description: "OMA catalog IDs. Omit to allow all models." },
					ipAllowlist: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", minLength: 1, maxLength: 64 }, description: "IPv4/IPv6 addresses or CIDR ranges. Only matching callers can use the key. Include your server's public outbound IP. Omit for unrestricted access." },
				} } } } },
				responses: { "200": jsonSuccess("New API key, returned once", { allOf: [keyMetadataSchema, { type: "object", required: ["key"], properties: { key: { type: "string" } } }] }), "400": { description: "Invalid JSON, name, expiry, model ID or IP restriction" }, "401": { description: "Session required" } },
			},
		},
		"/v1/keys/{id}": {
			delete: {
				summary: "Revoke an API key",
				security: [{ SessionCookie: [] }],
				parameters: [
					{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
				],
				responses: { "200": jsonSuccess("API key revoked", { type: "object", required: ["success", "id"], properties: { success: { type: "boolean", enum: [true] }, id: { type: "string", format: "uuid" } } }), "400": { description: "Invalid UUID key ID" }, "401": { description: "Session required" }, "404": { description: "Not found" } },
			},
		},
		"/v1/deposit/usdc": {
            get: {
                summary: "USDC deposit instructions", security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
                responses: { "200": { description: "Current destination and configured amount bounds", content: { "application/json": { schema: {
                    type: "object", required: ["depositAddress", "network", "chainId", "usdcContract", "minDepositCents", "maxDepositCents", "creditsPerCent"],
                    properties: { depositAddress: { type: "string" }, network: { type: "string" }, chainId: { type: "integer", enum: [8453] }, usdcContract: { type: "string" }, minDepositCents: { type: "integer" }, maxDepositCents: { type: "integer" }, creditsPerCent: { type: "integer", enum: [1] } },
                } } } }, "401": { description: "Authentication required" }, "503": { description: "Crypto funding unavailable or paused" } },
            },
            post: {
                summary: "Record a signed USDC deposit for confirmation", security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
                description: "First obtain a challenge, then sign the canonical deposit authorization message binding the sending wallet, deposit address, challengeToken, transaction hash and amountUsd. Returns pending without crediting; the watcher verifies the transfer. Amount must also fit the current minDepositCents/maxDepositCents instructions. No transfer is initiated by this endpoint.",
                requestBody: { required: true, content: { "application/json": { schema: {
                    type: "object", required: ["amountUsd", "txHash", "fromAddress", "challengeToken", "signature"],
                    properties: {
                        amountUsd: { type: "number", exclusiveMinimum: 0, maximum: 10000, description: "USD amount, not cents. Current configured deposit bounds also apply." },
                        txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" }, network: { type: "string", enum: ["base"], default: "base" },
                        fromAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }, challengeToken: { type: "string", minLength: 20 }, signature: { type: "string", minLength: 2 },
                    },
                } } } },
                responses: { "200": { description: "Pending deposit, or the current status of an already recorded transaction", content: { "application/json": { schema: {
                    type: "object", required: ["depositId", "status", "amountCents", "txHash", "message"], properties: { depositId: { type: "string", format: "uuid" }, status: { type: "string" }, amountCents: { type: "number" }, txHash: { type: "string" }, network: { type: "string" }, message: { type: "string" } },
                } } } }, "400": { description: "Invalid body or amount outside configured bounds" }, "401": { description: "Authentication required" }, "403": { description: "Invalid challenge or wallet ownership signature" }, "500": { description: "Deposit could not be recorded" }, "429": { description: "Deposit submission rate limit exceeded" }, "503": { description: "Crypto funding unavailable or paused" } },
            },
        },
		"/v1/deposit/usdc/challenge": { post: {
            summary: "Request a short-lived deposit ownership challenge", security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
            description: "The returned token is bound to the authenticated account and funding wallet and expires after five minutes. Pass token as challengeToken in the signed deposit submission. The signature must bind the transaction and amount in addition to this challenge.",
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["fromAddress"], properties: { fromAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } } } } } },
            responses: { "200": { description: "Challenge issued", content: { "application/json": { schema: { type: "object", required: ["token", "nonce", "expiresAt"], properties: { token: { type: "string" }, nonce: { type: "string" }, expiresAt: { type: "integer", description: "Expiry as Unix epoch milliseconds" } } } } } }, "400": { description: "Missing or malformed fromAddress" }, "401": { description: "Authentication required" }, "429": { description: "Challenge rate limit exceeded" }, "503": { description: "Crypto funding unavailable or paused" } },
        } },
		"/v1/deposit/status": { get: {
            summary: "List the authenticated account’s latest deposits", security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
            description: "Returns up to 50 owner-scoped deposits, newest first. No requestId or userId parameter is accepted. amountUsd is a decimal string in dollars; creditsIssued is a decimal string in cents.",
            responses: { "200": { description: "Deposit history", content: { "application/json": { schema: { type: "object", required: ["deposits"], properties: { deposits: { type: "array", maxItems: 50, items: { type: "object" } } } } } } }, "401": { description: "Authentication required" } },
        } },
		"/v1/usage/today": {
			get: {
				summary: "Today's free-chat quota (guest IP or signed-in account)",
				description: "Optional session or API-key authentication. Counts admitted free-chat attempts, including upstream failures; this read does not consume quota. Resets at midnight UTC. Paid API-key inference uses prepaid credits instead. Redis outages use bounded, process-local counters retaining observed usage; these are not durable across restarts.",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }, {}],
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
		"/v1/checkout": { post: {
            summary: "Create a Polar checkout for a prepaid credit pack", security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
            description: "Choose a configured plan. successUrl is optional; only allowed app origins are honored, otherwise the server uses its dashboard success URL. The Polar webhook delivers credits after payment. productId and cancelUrl are not request fields.",
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["plan"], properties: { plan: { type: "string", enum: ["hobby", "builder", "scale"] }, successUrl: { type: "string", format: "uri" } } } } } },
            responses: { "200": { description: "Hosted checkout created", content: { "application/json": { schema: { type: "object", required: ["id", "url", "plan", "creditsOnSuccess"], properties: { id: { type: "string" }, url: { type: "string", format: "uri" }, plan: { type: "string", enum: ["hobby", "builder", "scale"] }, creditsOnSuccess: { type: "integer" } } } } } }, "400": { description: "Invalid plan or successUrl" }, "401": { description: "Authentication required" }, "429": { description: "Checkout rate limit exceeded" }, "503": { description: "Card funding unavailable, paused or unconfigured" } },
        } },
        "/v1/credits/balance": { get: {
            summary: "Prepaid balance, credit holds and active batches", security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
            responses: { "200": { description: "Nonnegative spendable balance, optional refund shortfall and reserved/reconciliation holds in decimal-string cents", content: { "application/json": { schema: { type: "object", required: ["activeBatches", "balanceCents", "reservedCents", "reconciliationCents"], properties: { activeBatches: { type: "array", maxItems: 50, items: { type: "object" } }, ...publicBalanceProperties, reservedCents: { type: "string" }, reconciliationCents: { type: "string" } } } } } }, "401": { description: "Authentication required" } },
        } },
		"/v1/credits/transactions": {
			get: {
				summary: "Credit transaction history (deposits, usage, refunds)",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
				parameters: [
					{ in: "query", name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
				],
				responses: { "200": jsonSuccess("Transactions newest first", { type: "object", required: ["transactions"], properties: { transactions: { type: "array", maxItems: 200, items: { type: "object", required: ["id", "type", "amountCents", "status", "createdAt"], properties: { id: { type: "string" }, type: { type: "string", enum: ["deposit", "usage", "refund"] }, amountCents: { type: "number" }, status: { type: "string" }, createdAt: { type: "string", format: "date-time" } } } } } }) },
			},
		},
		"/v1/refunds": {
			post: {
				summary: "Request a full usage-charge credit refund for operator review",
				description: "Paid charges within 30 days only. At most five pending per account and one per usage charge. Approval restores OMA credits; it does not issue a card/USDC payment. Partial refunds are not supported.",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
				requestBody: {
					required: true,
					content: { "application/json": {
						schema: {
							type: "object",
							required: ["usageId", "reason"],
							properties: {
								usageId: { type: "string", format: "uuid" },
								reason: { type: "string", minLength: 10, maxLength: 1000 },
								amountCents: { type: "number", exclusiveMinimum: 0, description: "Optional exact full-charge amount in cents, including fractional cents. Omit to use the original charge." },
							},
						},
					} },
				},
				responses: {
					"200": jsonSuccess("Refund request created", { type: "object", required: ["id", "usageId", "amountCents", "status", "createdAt"], properties: { id: { type: "string", format: "uuid" }, usageId: { type: "string", format: "uuid" }, amountCents: { type: "number", exclusiveMinimum: 0 }, status: { type: "string", enum: ["pending"] }, createdAt: { type: "string", format: "date-time" } } }),
					"400": { description: "Validation error" },
					"401": { description: "Authentication required" },
					"404": { description: "usageId not found" },
					"409": { description: "Already refunded or a request is already pending" },
					"429": { description: "Too many open refund requests (max 5)" },
				},
			},
			get: {
				summary: "List the caller's refund requests (newest first)",
				security: [{ SessionCookie: [] }, { BearerAuth: [] }, { ApiKeyHeader: [] }],
				parameters: [{ in: "query", name: "status", schema: { type: "string", enum: ["pending", "granted", "denied"] } }, { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } }],
                responses: { "200": jsonSuccess("Owner-scoped refund requests", { type: "object", required: ["data", "creditRefundsAvailable"], properties: { data: { type: "array", maxItems: 200, items: { type: "object" } }, creditRefundsAvailable: { type: "boolean" } } }) },
			},
		},
		"/v1/export/usage": { get: {
            summary: "Export usage as CSV or JSON", security: [{ SessionCookie: [] }],
            description: "Owner-scoped usage, newest first, at most 10,000 rows. since must not exceed until. Monetary columns are decimal-string cents. Includes billed_cents/refunded_at. X-Export-Row-Count and X-Export-Truncated report the export bound. model, from and to are not filters.",
            parameters: [ { in: "query", name: "format", schema: { type: "string", enum: ["csv", "json"], default: "csv" } }, { in: "query", name: "since", schema: { type: "string", format: "date-time", description: "ISO timestamp with timezone offset" } }, { in: "query", name: "until", schema: { type: "string", format: "date-time", description: "ISO timestamp with timezone offset" } } ],
            responses: { "200": { description: "Usage export", headers: { "X-Export-Row-Count": { schema: { type: "integer", minimum: 0, maximum: 10000 } }, "X-Export-Truncated": { schema: { type: "boolean" } } }, content: { "text/csv": { schema: { type: "string" } }, "application/json": { schema: { type: "array", maxItems: 10000, items: { type: "object" } } } } }, "400": { description: "Invalid format or timestamp range" }, "401": { description: "Session required" } },
        } },
		"/v1/export/deposits": { get: {
            summary: "Export recorded deposits as CSV or JSON", security: [{ SessionCookie: [] }],
            description: "Latest 10,000 deposit rows for the authenticated account. amount_usd is dollars; credits_issued is cents. This exports deposits, not credit batches or expiration grants. format=json selects JSON; all other values produce CSV.",
            parameters: [{ in: "query", name: "format", schema: { type: "string", default: "csv" }, description: "Use json for JSON; otherwise CSV." }],
            responses: { "200": { description: "Deposit export", content: { "text/csv": { schema: { type: "string" } }, "application/json": { schema: { type: "array", maxItems: 10000, items: { type: "object" } } } } }, "401": { description: "Session required" } },
        } },
		"/v1/export/summary": { get: {
            summary: "Export all-time account totals as CSV or JSON", security: [{ SessionCookie: [] }],
            description: "All-time balance, deposited/used cents, request/token totals and non-refunded usage charges. No date-range filters are supported. format=json selects JSON; all other values produce CSV.",
            parameters: [{ in: "query", name: "format", schema: { type: "string", default: "csv" }, description: "Use json for JSON; otherwise CSV." }],
            responses: { "200": { description: "All-time summary export", content: { "text/csv": { schema: { type: "string" } }, "application/json": { schema: { type: "object" } } } }, "401": { description: "Session required" } },
        } },
		"/v1/export/account": {
			get: {
				summary: "JSON export of full account state (profile, balance, keys metadata, settings)",
				security: [{ SessionCookie: [] }],
				responses: { "200": jsonSuccess("Complete account snapshot without credential secrets", { type: "object", required: ["exportedAt", "format", "profile", "apiKeys", "usageRecords", "deposits", "creditBalance", "auditLogs", "sessions"], properties: { exportedAt: { type: "string", format: "date-time" }, format: { type: "string", enum: ["oma-data-export.v1"] }, profile: { type: ["object", "null"] }, apiKeys: { type: "array", items: { type: "object" } }, usageRecords: { type: "array", maxItems: 50000, items: { type: "object" } }, deposits: { type: "array", items: { type: "object" } }, creditBalance: { type: ["object", "null"] }, auditLogs: { type: "array", maxItems: 10000, items: { type: "object" } }, sessions: { type: "array", items: { type: "object" } } } }) },
			},
		},
		"/v1/models/{id}": {
			get: {
				summary: "Get a single model from the catalog",
				security: [],
				parameters: [
					{ in: "path", name: "id", required: true, schema: { type: "string" } },
				],
				responses: { "200": { description: "Model detail", content: { "application/json": { schema: { $ref: "#/components/schemas/Model" } } } }, "404": { description: "Not in catalog" } },
			},
		},
		"/ready": {
			get: {
				summary: "Database and Redis readiness probe",
				security: [],
				responses: {
					"200": jsonSuccess("All dependency checks passed", readinessSchema),
					"503": jsonSuccess("At least one dependency is degraded", readinessSchema),
				},
			},
		},
		"/version": {
			get: {
				summary: "Public application version",
				security: [],
				responses: { "200": { description: "version and service", content: { "application/json": { schema: { type: "object", required: ["version", "service"], properties: { version: { type: "string" }, service: { type: "string", enum: ["oma-ai"] } } } } } } },
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
					"400": { description: "query must contain 1–500 characters after trimming" },
                    "200": jsonSuccess("Search results, possibly empty", { type: "object", required: ["query", "results", "provider"], properties: { query: { type: "string" }, provider: { type: "string", enum: ["duckduckgo"] }, results: { type: "array", maxItems: 6, items: { type: "object", required: ["title", "url", "snippet"], properties: { title: { type: "string" }, url: { type: "string" }, snippet: { type: "string" }, site_name: { type: "string" }, favicon: { type: "string" } } } } } }),
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
						required: ["x402Version", "scheme", "network", "asset", "decimals", "payTo", "maxAtomicAmount", "maxTimeoutSeconds", "extra"],
						properties: {
							x402Version: { type: "integer", enum: [2] },
							scheme: { type: "string", enum: ["exact"] },
							network: { type: "string", enum: ["eip155:8453"] },
							asset: { type: "string", description: "USDC contract on Base" },
							decimals: { type: "integer", enum: [6] },
							payTo: { type: "string", description: "Configured x402 treasury address" },
							maxAtomicAmount: { type: "string", pattern: "^[0-9]+$", description: "Configured maximum top-up in atomic USDC units. Defaults to 10000000000 ($10,000); derived exactly from USDC_DEPOSIT_MAX_CENTS. Positive fractional USDC remains accepted." },
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
				description: "Moves the authorized USDC to the pinned treasury and waits for on-chain confirmation; this is not a dry run. The facilitator pays gas. Save the returned txHash, then call /x402/settle with the payer wallet's SIWE session to credit the account. Rate-limited at 10/min/IP. Funding is capped by USDC_DEPOSIT_MAX_CENTS ($10,000 default); read maxAtomicAmount from /x402/info. Oversized authorizations return 400 x402_funding_limit before transfer verification or broadcast. Positive fractional USDC remains accepted. Returns 503 funding_paused or funding_status_unavailable before moving funds when new crypto funding is unavailable. Existing transfers can still be credited through /x402/settle during a funding pause.",
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
                    "503": { description: "New crypto funding paused or status unavailable" },
				},
			},
		},
		"/x402/settle": {
			servers: fundingServers,
			post: {
				summary: "Credit a confirmed USDC payment to the authenticated payer",
				description: "Does not initiate another transfer. Requires a SIWE session for the payment sender; an API key is not accepted. Uses the confirmed amount, never a caller-supplied amount. Retries for the same account and transaction credit once; confirmed payments can be recovered after a server restart. Limited to 30 requests per minute per account and client IP; honor Retry-After on HTTP429.",
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
					"429": { description: "Settlement rate limit exceeded; retry after the Retry-After delay with the same transaction hash", headers: { "Retry-After": { schema: { type: "string" }, description: "Seconds until another settlement attempt is allowed" } } },
					"500": { description: "Credit application failed; retry settlement with the same transaction hash" },
				},
			},
		},
		"/health": {
			get: {
				summary: "Liveness probe",
				security: [],
				responses: { "200": jsonSuccess("Liveness", healthSchema) },
			},
		},
		"/v1/health": {
			get: {
				summary: "Liveness probe (v1-prefixed alias)",
				description:
					"Same payload as GET /health, exposed under /v1 so SDK-style callers that prepend /v1 to every path get a real 200.",
				security: [],
				responses: { "200": jsonSuccess("Liveness", healthSchema) },
			},
		},
	},
};

// Keep cookie-mutation header requirements aligned with the mounted guard.
for (const [path, item] of Object.entries(spec.paths)) {
 const globallyGuarded = originGuardPaths.some(pattern => pattern.endsWith("/*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern);
 if (!globallyGuarded && path !== "/v1/refunds") continue;
 for (const [method, value] of Object.entries(item)) {
  if (!["post", "put", "patch", "delete"].includes(method) || (!globallyGuarded && method !== "post")) continue;
  const operation = value as { parameters?: unknown[]; responses?: Record<string, { description: string }> };
  operation.parameters = [...(operation.parameters ?? []), {
   in: "header", name: "Origin", required: false, schema: { type: "string", format: "uri" },
   description: globallyGuarded
 ? "Required unless Referer supplies the allowed website origin, including when a Bearer key is used. Browsers send this automatically. Scripts must send Origin matching the website (production: https://www.oma-ai.com). Missing or disallowed origin returns 403 csrf_error."
 : "Required whenever cookies accompany the request, including when a Bearer key is selected, unless Referer supplies the allowed website origin. Not required for cookie-free Bearer API-key refunds. Missing or disallowed browser origin returns 403 csrf_error.",
  }];
  if (operation.responses) {
   const existing = operation.responses["403"]?.description;
   operation.responses["403"] = { ...operation.responses["403"], description: [existing, globallyGuarded ? "Origin/Referer missing or disallowed (csrf_error)" : "Cookie-bearing request Origin/Referer missing or disallowed (csrf_error)"].filter(Boolean).join("; ") };
  }
 }
}
return spec;
}
