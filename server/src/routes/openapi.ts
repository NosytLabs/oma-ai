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

const spec = {
	openapi: "3.1.0",
	info: {
		title: "OMA-AI Inference Gateway",
		version: "2.1.0",
		description:
			"OpenAI-compatible inference gateway. Routes to Venice (premium) and OMA-AI/OpenBroker (decentralized). x402 pay-per-request for agents; USDC on Base for credit top-ups.",
	},
	servers: [
		{ url: config.PUBLIC_API_URL, description: "Production" },
		{ url: config.PUBLIC_API_URL.replace(/^https?:\/\//, "http://").replace(/:\d+/, ":3001"), description: "Local dev" },
	],
	components: {
		securitySchemes: {
			BearerAuth: { type: "http", scheme: "bearer" },
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
					supports_streaming: { type: "boolean" },
					supports_tools: { type: "boolean" },
					pricing: {
						type: "object",
						required: ["prompt", "completion"],
						properties: {
							prompt: { type: "number", description: "USD per 1M input tokens" },
							completion: { type: "number", description: "USD per 1M output tokens" },
						},
					},
				},
			},
			ChatMessage: {
				type: "object",
				required: ["role", "content"],
				properties: {
					role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
					content: { type: "string" },
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
					"429": { description: "Rate limited" },
					"502": { description: "Upstream provider error" },
				},
			},
		},
		"/v1/messages": {
			post: {
				summary: "Anthropic-compatible Messages API (Claude Code, Anthropic SDKs)",
				description:
					"Accepts Anthropic Messages request shape; routes through the same OMA catalog and billing as chat completions. Auth: Bearer oma_sk_… or x-api-key.",
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
					"200": { description: "Anthropic-shaped message (or SSE when stream=true)" },
					"401": { description: "Missing or invalid API key" },
					"402": { description: "Insufficient credit balance" },
					"404": { description: "Unknown model id" },
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
				summary: "Paginated per-request usage history (model, provider, token counts, cents)",
				parameters: [
					{ in: "query", name: "model", schema: { type: "string" } },
					{ in: "query", name: "provider", schema: { type: "string", enum: ["venice", "oma-ai", "litellm"] } },
					{ in: "query", name: "since", schema: { type: "string", format: "date-time" } },
					{ in: "query", name: "until", schema: { type: "string", format: "date-time" } },
					{ in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
					{ in: "query", name: "cursor", schema: { type: "string" } },
				],
				responses: {
					"200": { description: "Paginated usage records" },
				},
			},
		},
		"/v1/keys": {
			get: {
				summary: "List active API keys",
				responses: { "200": { description: "Keys" } },
			},
			post: {
				summary: "Mint a new API key (returned once)",
				responses: { "200": { description: "New key" } },
			},
		},
		"/v1/keys/{id}": {
			delete: {
				summary: "Revoke an API key",
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
		"/v1/usage/today": {
			get: {
				summary: "Today's free-tier usage counter (anon IP, authed user)",
				responses: { "200": { description: "Counter" } },
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
		"/v1/site-settings": {
			get: {
				summary: "Public rail/config status (card + crypto toggles, treasury + Polar configured flags)",
				description:
					"Lets the frontend render honest rail statuses. When the DB is unreachable the endpoint falls back to env-derived defaults so the deposit page never 5xxs for an anonymous visitor.",
				security: [],
				responses: {
					"200": {
						description: "Settings snapshot",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										maintenanceMode: { type: "boolean" },
										cardPaymentsEnabled: { type: "boolean" },
										cryptoPaymentsEnabled: { type: "boolean" },
										usdcDepositConfigured: { type: "boolean" },
										polarConfigured: { type: "boolean" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/v1/admin/site-settings": {
			post: {
				summary: "Toggle site-level kill switches (maintenance, card, crypto)",
				description:
					"Admin-only. Mutations write an audit log row tagged SITE_SETTINGS_UPDATED.",
				responses: {
					"200": { description: "Updated settings echoed" },
					"400": { description: "Invalid body" },
					"401": { description: "Not authenticated" },
					"403": { description: "Not an admin" },
				},
			},
		},
		"/v1/admin/credit-adjust": {
			post: {
				summary: "Add or deduct credits for a user (cents)",
				description:
					"Admin-only. Server clamps delta to ±$1k per operation. Writes CREDIT_ADJUSTED or CREDIT_DEDUCTED audit row.",
				responses: {
					"200": { description: "OK" },
					"400": { description: "Invalid body" },
					"404": { description: "User not found" },
					"401": { description: "Not authenticated" },
					"403": { description: "Not an admin" },
				},
			},
		},
		"/v1/admin/user-suspend": {
			post: {
				summary: "Flip the user.suspended flag",
				description:
					"Admin-only. Writes USER_SUSPENDED or USER_UNSUSPENDED audit row with reason.",
				responses: {
					"200": { description: "OK" },
					"400": { description: "Invalid body" },
					"404": { description: "User not found" },
					"401": { description: "Not authenticated" },
					"403": { description: "Not admin" },
				},
			},
		},
		"/v1/admin/rate-limit-override": {
			post: {
				summary: "Set or clear a per-user rate-limit override",
				description:
					"Admin-only. Pass maxRequestsPerMinute: null to clear. Writes RATE_LIMIT_OVERRIDE_SET or _REMOVED audit row.",
				responses: {
					"200": { description: "OK" },
					"400": { description: "Invalid body" },
					"404": { description: "User not found" },
					"401": { description: "Not authenticated" },
					"403": { description: "Not admin" },
				},
			},
		},
		"/v1/admin/users": {
			get: {
				summary: "Paginated user list with balance",
				description:
					"Admin-only. Cursor-based pagination over (id ASC). Optional q filter searches email + name ILIKE.",
				parameters: [
					{ in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
					{ in: "query", name: "cursor", schema: { type: "string" } },
					{ in: "query", name: "q", schema: { type: "string", maxLength: 100 } },
				],
				responses: {
					"200": { description: "{ items: AdminUser[], nextCursor: string|null }" },
					"401": { description: "Not authenticated" },
					"403": { description: "Not admin" },
				},
			},
		},
		"/x402/verify": {
			post: {
				summary: "Verify an EIP-3009 PAYMENT-SIGNATURE envelope (no settlement)",
				description:
					"Strict amount checks (no zero, no overpayment), payee pinned to SERVER_TREASURY, EIP-2 low-S signature mandate. Rate-limited at 10/min/IP.",
				security: [],
				responses: {
					"200": { description: "Verified (cached for downstream settle)" },
					"400": { description: "Invalid signature / amount / payee" },
					"402": { description: "Payment required (insufficient or malformed)" },
				},
			},
		},
		"/x402/settle": {
			post: {
				summary: "Settle a previously-verified payment (writes USDC tx on Base)",
				description:
					"Session-auth required. Idempotent — concurrent calls collapse into a single DB write + on-chain settlement.",
				responses: {
					"200": { description: "Receipt payload (signed)" },
					"401": { description: "Not authenticated" },
					"402": { description: "No verified payment" },
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

openapiRoutes.get("/openapi.json", (c) => c.json(spec));
openapiRoutes.get("/openapi", (c) => c.json(spec));
// Common alternate paths used by SDK generators / agent tooling
openapiRoutes.get("/v1/openapi.json", (c) => c.json(spec));
openapiRoutes.get("/v1/openapi", (c) => c.json(spec));
