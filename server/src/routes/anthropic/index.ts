/**
	* Anthropic-compatible Messages API — /v1/messages
	*
	* Translates Anthropic Messages API format to OpenAI format internally,
	* reuses the shared provider proxy (Venice/OMA-AI), and translates
	* responses back to Anthropic format (both streaming and non-streaming).
	*/
import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";
import { sessionOrBearerAuth } from "../../auth/middleware.js";
import { modelRateLimit, rateLimit } from "../../middleware/rate-limit.js";
import { getModelById, listAllModels } from "../../inference/models.js";
import { getModelPricing } from "../../inference/billing-service.js";
import type { UsageProvider } from "../../inference/billing.js";
import {
		parseNonStreamingResponse,
		assertSufficientBalance,
		ProviderError,
		estimateTokens,
		flattenMessageContent,
		routeRequestWithFallback,
} from "../../inference/proxy.js";
import { anthropicSchema, toOpenAIMessages, toOpenAITools, toOpenAIToolChoice } from "./request.js";
import { createAnthropicStream, anthropicStopReason } from "./stream.js";
import { logger } from "../../lib/logger.js";
import { inferenceIdempotency } from "../../middleware/inference-idempotency.js";


/** Convert OpenAI non-streaming response → Anthropic message */
function toAnthropicMessage(
		data: unknown,
		modelId: string,
		requestId: string,
		tokenUsage: { promptTokens: number; outputTokens: number },
): Record<string, unknown> {
		const openaiData = data as {
				choices?: Array<{
						message?: { content?: string | unknown[]; tool_calls?: unknown[] };
						finish_reason?: string;
				}>;
				usage?: { prompt_tokens?: number; completion_tokens?: number };
		};

		const choice = openaiData.choices?.[0];
		const content = choice?.message?.content ?? "";
		const text = typeof content === "string" ? content : flattenMessageContent(content);

		const contentBlocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }> = [];
		if (text) {
				contentBlocks.push({ type: "text", text });
		}

		if (choice?.message?.tool_calls) {
				for (const tc of choice.message.tool_calls) {
						const tcTyped = tc as { id?: string; function?: { name?: string; arguments?: string } };
						let input: unknown;
						try { input = JSON.parse(tcTyped.function?.arguments ?? "{}"); }
						catch { throw new ProviderError("Upstream returned invalid tool arguments", 502); }
						if (!tcTyped.id || !tcTyped.function?.name || !input || typeof input !== "object" || Array.isArray(input)) {
							throw new ProviderError("Upstream returned an invalid tool call", 502);
						}
						contentBlocks.push({
								type: "tool_use",
								id: tcTyped.id,
								name: tcTyped.function.name,
								input,
						});
				}
		}

		return {
				id: requestId,
				type: "message",
				role: "assistant",
				model: modelId,
				content: contentBlocks,
				stop_reason: anthropicStopReason(choice?.finish_reason),
				stop_sequence: null,
				usage: {
						input_tokens: tokenUsage.promptTokens,
						output_tokens: tokenUsage.outputTokens,
				},
		};
}


export const anthropicRoutes = new Hono<OmaEnv>();

/** POST /v1/messages — Anthropic Messages API */
anthropicRoutes.post(
		"/v1/messages",
		rateLimit({ windowMs: 60_000, maxRequests: 60 }),
		sessionOrBearerAuth,
		// Same per-model RPM + TPM enforcement as /v1/chat/completions. This
		// route previously had only the generic 60/min burst guard, so the
		// Anthropic-compatible surface (what Claude Code and similar clients
		// use) could exceed MODEL_LIMITS entirely — an alternate door into the
		// same unthrottled inference path.
		modelRateLimit(),
		inferenceIdempotency(),
		async (c) => {
				// Start of the request, persisted as usage_records.latency_ms so
				// provider latency is finally observable on this route too.
				const startedAt = Date.now();
				const body = await c.req.json().catch(() => null);
				const parsed = anthropicSchema.safeParse(body);
				if (!parsed.success) {
						return c.json(
								{
										type: "error",
										error: {
												type: "invalid_request_error",
												message: "Invalid request",
												details: parsed.error.flatten(),
										},
								},
								400,
						);
				}

				const { model, messages, system, max_tokens, temperature, top_p, stream, tools, tool_choice } = parsed.data;
				const modelDef = getModelById(model);
				if (!modelDef) {
						return c.json(
								{
										type: "error",
										error: { type: "not_found_error", message: `Model ${model} not found` },
								},
								404,
						);
				}

				const userId = c.get("userId");
				const apiKeyId = c.get("apiKey")?.id ?? null;
				const requestId = c.get("inferenceRequestId") ?? `msg_${crypto.randomUUID()}`;
				c.header("X-OMA-Request-ID", requestId);

				const openAIMessages = toOpenAIMessages(messages, system);
				const promptText = openAIMessages.map((m) => flattenMessageContent(m.content as string | unknown[])).join("\n");
				const promptTokens = estimateTokens(promptText);

				try {
						await assertSufficientBalance(userId, getModelPricing(model), promptTokens, max_tokens);
						const { response: upstreamResp, actualModelId, attemptCount } =
							await routeRequestWithFallback({
								modelId: model,
								allowedModels: c.get("apiKey")?.allowedModels,
								messages: openAIMessages,
								stream,
								max_tokens,
								temperature,
								top_p,
								tools: toOpenAITools(tools),
								tool_choice: toOpenAIToolChoice(tool_choice),
								userId,
								requestId,
								signal: c.req.raw.signal,
						});

						const actualModelDef = getModelById(actualModelId) || modelDef;
						const actualPricing = getModelPricing(actualModelId);
						const routedVia = actualModelId !== model ? "fallback" : "direct";

						// Set OMA custom response headers to indicate routing & fallback choice
						c.header("x-provider", actualModelDef.provider);
						c.header("x-actual-model", actualModelId);
						if (actualModelId !== model) {
								c.header("x-oma-fallback", "1");
								c.header("x-oma-requested-model", model);
						}

						if (stream) {
								c.header("Content-Type", "text/event-stream");
								c.header("Cache-Control", "no-cache, no-transform");
								c.header("X-Accel-Buffering", "no");
								const anthropicStream = createAnthropicStream(upstreamResp, actualModelId, requestId, {
								onFinalized: status => c.set("inferenceOutcome", status),
								userId,
								apiKeyId,
								model: actualModelId,
								requestedModel: model,
								provider: actualModelDef.provider as UsageProvider,
								routedVia,
								attemptCount,
								promptTokens,
								pricing: actualPricing,
								requestId,
								startedAt,
							});
								return c.body(anthropicStream, 200);
						}

						const { data, promptTokens: actualPromptTokens, outputTokens } = await parseNonStreamingResponse(upstreamResp, {
											userId,
											apiKeyId,
											model: actualModelId,
											requestedModel: model,
											provider: actualModelDef.provider as UsageProvider,
											routedVia,
											attemptCount,
											promptTokens,
											pricing: actualPricing,
											requestId,
											startedAt,
										});

						const anthropicMsg = toAnthropicMessage(data, actualModelId, requestId, { promptTokens: actualPromptTokens, outputTokens });
						return c.json(anthropicMsg);
				} catch (err) {
						if (err instanceof ProviderError) {
								const status = err.status >= 500 ? 502 : err.status;
								return c.json(
										{
												type: "error",
												error: { type: err.status >= 500 ? "api_error" : "invalid_request_error", message: err.message },
										},
										status as 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
								);
						}
						logger.error({ err, model }, "[anthropic] unexpected error");
						return c.json(
								{ type: "error", error: { type: "api_error", message: "Internal server error" } },
								500,
						);
				}
		},
);

/** GET /v1/models — Anthropic-shaped model list */
anthropicRoutes.get("/v1/models", sessionOrBearerAuth, async (c) => {
		const models = listAllModels();
		const data = models.map((m) => ({
				id: m.id,
				display_name: m.displayName,
				created_at: new Date().toISOString(),
				type: "model",
		}));
		return c.json({ data, has_more: false, first_id: data[0]?.id ?? null, last_id: data[data.length - 1]?.id ?? null });
});
