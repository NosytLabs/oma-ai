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
