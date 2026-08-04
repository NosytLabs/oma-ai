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
			"OpenAI-compatible inference gateway. Routes to Venice (premium) and Gonka/OpenBroker (decentralized). x402 pay-per-request for agents; USDC on Base for credit top-ups.",
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
					model: { type: "string" },
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
					{ in: "query", name: "provider", schema: { type: "string", enum: ["venice", "gonka"] } },
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
				summary: "USDC deposit instructions (treasury address, network, memo)",
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
		"/v1/images/generations": {
			post: {
				summary: "Image generation (Venice-backed)",
				description: "OpenAI-style image generation. Auth: Bearer oma_sk_… or x402.",
				responses: {
					"200": { description: "Image URL(s) or b64 payloads" },
					"401": { description: "Auth required" },
					"402": { description: "Insufficient credits" },
				},
			},
		},
		"/v1/videos/generations": {
			post: {
				summary: "Async video generation",
				description: "Queues a video job; poll GET /v1/videos/retrieve.",
				responses: {
					"200": { description: "Job id / quote" },
					"401": { description: "Auth required" },
					"402": { description: "Insufficient credits" },
				},
			},
		},
		"/v1/videos/retrieve": {
			get: {
				summary: "Poll async video job",
				parameters: [
					{ in: "query", name: "id", required: true, schema: { type: "string" } },
				],
				responses: {
					"200": { description: "Job status + output when ready" },
					"404": { description: "Unknown job" },
				},
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
