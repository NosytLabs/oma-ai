/**
	* OpenAI-compatible chat completions — multi-provider proxy.
	*
	* Routes a single userId-keyed chat call to the upstream matching the
	* requested model's `provider` field, and:
	*
	*   - Forwards OpenAI-shaped SSE with the served model ID.
	*   - Reserves paid credits before upstream work and settles verified usage.
	*   - Retains a review hold when provider execution or final usage is uncertain.
	*   - Estimates usage only for free website chat or operational error records.
	*   - Records request usage and preserves detached paid financial receipts.
	*
	* Adds a small provider markup on top of the upstream's per-token cost
	* (defined in the `ModelDef.markupPercent` field).
	*
	* Wired providers (see `inference/models.ts` for the catalog):
	*
	*   venice — Venice AI (privacy-first, OpenAI-compatible).
	*             https://api.venice.ai/api/v1/chat/completions
	*   oma-ai  — OMA-AI decentralized inference broker (OpenBroker by
	*             default). OpenAI-compatible. Used as the cost-effective tier for
	*             large-context / tool-use requests.
	*/
import { Hono } from "hono";
import { z } from "zod";
import type { OmaEnv } from "../../types.js";
import { optionalAuth } from "../../auth/middleware.js";
import { modelRateLimit, rateLimit } from "../../middleware/rate-limit.js";
import { dailyUsageLimit } from "../../middleware/daily-limit.js";
import { inferenceIdempotency } from "../../middleware/inference-idempotency.js";
import { getModelById } from "../../inference/models.js";
import { getModelPricing } from "../../inference/billing-service.js";
import {
		createStreamingProxy,
		parseNonStreamingResponse,
		ProviderError,
		estimateTokens,
		flattenMessageContent,
		routeRequestWithFallback,
		} from "../../inference/proxy.js";
		import type { UsageProvider } from "../../inference/billing.js";
import { logger } from "../../lib/logger.js";
import { isWebsiteChatRequest, WEBSITE_CHAT_PATH } from "../../inference/website-chat-request.js";
import { isFreeWebsiteModel } from "../../inference/free-website-model.js";
import { reservationQuote, reserveInferenceCredits, failInferenceReservation } from "../../inference/credit-reservations.js";
import { boundedDefaultOutput } from "../../inference/token-utils.js";

/**
	* Check if a model is eligible for the anonymous free website chat path.
	*
	* Free in /chat and /playground ONLY for catalog ids that are explicitly
	* allowlisted as Gonka-network models. The Gonka Network OpenBroker
	* upstream runs models on decentralized compute where OMA-AI pays in
	* protocol credits, so we can offer those at $0 to website visitors.
	*
	* Everything else (Venice-routed, OMA-AI resale, and even
	* other "openbroker"-tagged models that are not actually on the Gonka
	* network) requires auth + credits in /chat, /playground, and the
	* /v1 API surface.
	*
	* Mirrors `FREE_CHAT_MODEL_IDS` in app/src/lib/model-utils.ts — keep in sync.
	*/
const chatSchema = z.object({
		model: z.string(),
		/**
			* OpenRouter-style fallback chain. Tried after `model` fails (and before
			* the server peer map). Max 8 to bound worst-case fan-out.
			*/
		models: z.array(z.string().min(1)).max(8).optional(),
		messages: z
				.array(
						z.object({
								role: z.enum(["system", "user", "assistant", "tool"]),
								content: z.string().or(z.array(z.any())).nullable(),
								name: z.string().optional(),
								tool_calls: z.array(z.unknown()).optional(),
								tool_call_id: z.string().optional(),
						}),
				)
				.min(1),
		temperature: z.number().min(0).max(2).optional(),
		top_p: z.number().min(0).max(1).optional(),
		max_tokens: z.number().int().positive().optional(),
		stream: z.boolean().optional().default(false),
		tools: z.array(z.any()).optional(),
		tool_choice: z.any().optional(),
});

export const chatRoutes = new Hono<OmaEnv>();

for (const path of ["/v1/chat/completions", WEBSITE_CHAT_PATH]) chatRoutes.post(
		path,
		rateLimit({
			windowMs: 60_000,
			maxRequests: 60,
			// Fail OPEN to the in-memory bound, including in production.
			//
			// This used to be `failClosed: process.env.NODE_ENV === "production"`,
			// which contradicted the comment directly above it and the policy
			// documented in rate-limit/sliding-window.ts ("a missing cache
			// dependency should degrade enforcement, not availability").
			// With no Redis configured, EVERY visitor's chat send returned
			// 503 service_unavailable — the entire free playground was offline.
			//
			// This per-minute limiter is a burst guard, not the cost gate: the
			// real cap is dailyUsageLimit() below (20 msgs/day anonymous), and
			// it still applies. Degrading here keeps a per-instance bound
			// without taking the product offline. Configure real Redis for a
			// shared, multi-instance-accurate limit.
			failClosed: false,
		}),
		// Authenticate before the daily limiter so signed-in website users receive
				// the registered-user quota instead of being treated as anonymous.
				optionalAuth,
				// Per-model RPM **and TPM** enforcement (MODEL_LIMITS). Previously
				// this route applied only the generic 60/min burst guard, so a
				// caller could send an unlimited number of requests — and an
				// unlimited number of TOKENS — to a catalog model that declares
				// limits. Runs after optionalAuth so the limit is keyed to the
				// caller's own budget, not the shared IP bucket.
				modelRateLimit(),
				dailyUsageLimit(),
				inferenceIdempotency(),
				async (c) => {
						// Captured before any upstream work so usage_records.latency_ms
						// measures the full round-trip (queue + provider + stream).
						// latency_ms existed on the table but was never populated.
						const startedAt = Date.now();
						const body = await c.req.json().catch(() => null);
				const parsed = chatSchema.safeParse(body);
				if (!parsed.success) {
						return c.json(
								{
										error: {
												message: "Invalid request",
												type: "invalid_request_error",
												issues: parsed.error.flatten(),
										},
								},
								400,
						);
				}
				const {
						model,
						models: clientModels,
						messages,
						stream,
						max_tokens,
						temperature,
						top_p,
						tools,
						tool_choice,
				} = parsed.data;
				const modelDef = getModelById(model);
				if (!modelDef) {
						return c.json(
								{ error: { message: `Model ${model} not found`, type: "not_found" } },
								404,
						);
				}

				const userId = c.get("userId");
				if (modelDef.disabledReason) {
					return c.json({ error: { message: modelDef.disabledReason, type: "model_unavailable" } }, 503);
				}
			const isWebsiteRequest = isWebsiteChatRequest(c);
			if (c.req.path === WEBSITE_CHAT_PATH && !isWebsiteRequest) {
				return c.json({ error: { message: "Website chat requires the trusted website proxy", code: "website_chat_only" } }, 403);
			}
			const isFreeModel = isFreeWebsiteModel(model);
			// API-key callers always pay, even on free-tier models: the free
			// path is session/guest website chat only. The auth middleware
			// sets `apiKey` for Bearer oma_sk_* (or oma_api_key cookie) auth,
			// so a spoofed X-OMA-Source header can't get API traffic for free.

			// Website chat with free OMA-AI models: allow anonymous, skip billing
			// API requests or non-free models: require auth and bill credits
			const apiKey = c.get("apiKey");
			const apiKeyId = apiKey?.id ?? null;
			// Older website tabs used the SDK path; the current proxy strips
			// their source header. A session-only request to an eligible free
			// model must use the website handler or an explicit paid API key.
			if (c.req.path === "/v1/chat/completions" && isFreeModel && userId && !apiKey) {
				return c.json({ error: { message: "Website chat has been updated. Reload this page and send your message again.", code: "website_chat_moved" } }, 409);
			}
			const isFreeWebsiteChat = isWebsiteRequest && isFreeModel && !apiKey;
				
				if (!isFreeWebsiteChat && !userId) {
						return c.json(
								{
										error: {
												message: "Authentication required. Sign in for free website chat, or use an API key.",
												type: "authentication_error",
												code: "auth_required",
										},
								},
								401,
						);
				}

				const requestId = c.get("inferenceRequestId") ?? `chatcmpl-${crypto.randomUUID()}`;
				c.header("X-OMA-Request-ID", requestId);
				let reserved = false;
				let providerStarted = false;
				let outputLimit = max_tokens ?? boundedDefaultOutput(modelDef);

				try {
				const promptText = messages.map((m) => flattenMessageContent(m.content)).join("\n");
				const promptTokens = estimateTokens(promptText);

				// Atomically hold the worst eligible provider charge before inference.
				if (userId && !isFreeWebsiteChat) {
								const quote = reservationQuote({ modelId: model, clientFallbacks: clientModels, allowedModels: apiKey?.allowedModels, messages, tools, max_tokens });
								outputLimit = quote.maxTokens;
								await reserveInferenceCredits(userId, requestId, quote.cents, { requestedModel: model, pricingSnapshot: quote.pricingSnapshot });
								reserved = true;
						}

						providerStarted = true;
						const { response: upstreamResp, actualModelId, attemptCount } =
					await routeRequestWithFallback({
								modelId: model,
								clientFallbacks: clientModels,
								allowedModels: apiKey?.allowedModels,
								messages,
								stream,
								max_tokens: outputLimit,
								temperature,
								top_p,
								tools,
								tool_choice,
								userId: userId ?? "anonymous",
								requestId,
								signal: c.req.raw.signal,
								skipBilling: isFreeWebsiteChat, // Don't deduct credits for free website chat
								prepaidReservation: reserved,
						});

						const actualModelDef = getModelById(actualModelId) || modelDef;
									const actualPricing = getModelPricing(actualModelId);
									// How the request was served, for the admin ledger:
									// "free-website" | "direct" | "fallback".
									const routedVia = isFreeWebsiteChat
										? "free-website"
										: actualModelId !== model
											? "fallback"
											: "direct";

						// Set OMA custom response headers to indicate routing & fallback choice
						// (OpenRouter-style transparency: clients can detect failover).
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
								const proxyStream = createStreamingProxy(upstreamResp, {
										onFinalized: status => c.set("inferenceOutcome", status),
										userId: userId ?? "anonymous",
										model: actualModelId,
										requestedModel: model,
										provider: actualModelDef.provider as UsageProvider,
										routedVia,
										attemptCount,
										promptTokens,
										pricing: actualPricing,
										requestId,
										startedAt,
										skipBilling: isFreeWebsiteChat,
										apiKeyId,
										reservation: reserved,
									});
								return c.body(proxyStream, 200);
						}

						const { data } = await parseNonStreamingResponse(upstreamResp, {
										userId: userId ?? "anonymous",
										model: actualModelId,
										requestedModel: model,
										provider: actualModelDef.provider as UsageProvider,
										routedVia,
										attemptCount,
										promptTokens,
										pricing: actualPricing,
										requestId,
										startedAt,
										skipBilling: isFreeWebsiteChat,
										apiKeyId,
										reservation: reserved,
									});

						return c.json(data);
				} catch (err) {
						if (reserved) await failInferenceReservation(requestId, !providerStarted || (err instanceof ProviderError && err.executionRejected && !err.billingUncertain)).catch(failure => logger.error({ err: failure, requestId }, "[chat] reservation finalization requires reconciliation"));
						if (err instanceof ProviderError) {
								return c.json(
										{
												error: { message: err.message, type: err.status >= 500 ? "server_error" : "upstream_error" },
										},
										err.status as 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
								);
						}
						logger.error({ err, model }, "[chat] unexpected error");
						return c.json(
								{ error: { message: "Internal server error", type: "server_error" } },
								500,
						);
				}
		},
);
