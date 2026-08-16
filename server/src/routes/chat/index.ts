/**
	* OpenAI-compatible chat completions — multi-provider proxy.
	*
	* Routes a single userId-keyed chat call to the upstream matching the
	* requested model's `provider` field, and:
	*
	*   - Streams the OpenAI-shaped SSE back to the browser unchanged.
	*   - Estimates prompt/completion token counts (some upstreams don't
	*     always include `usage` in streamed chunks).
	*   - Deducts credits from `creditBalances` after a successful call
	*     (5xx failures leave the balance alone).
	*   - Records one row per request into `usageRecords` for the dashboard.
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
import { and, eq } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { optionalAuth } from "../../auth/middleware.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { dailyUsageLimit } from "../../middleware/daily-limit.js";
import { getModelById } from "../../inference/models.js";
import { getModelPricing } from "../../inference/billing-service.js";
import { usageRecords } from "../../db/schema.js";
import { db } from "../../db/client.js";
import {
		assertSufficientBalance,
		createStreamingProxy,
		parseNonStreamingResponse,
		ProviderError,
		estimateTokens,
		flattenMessageContent,
		routeRequestWithFallback,
} from "../../inference/proxy.js";
import { logger } from "../../lib/logger.js";
import { config } from "../../config.js";

/**
	* Check if a model is eligible for the anonymous free website chat path.
	*
	* Free in /chat and /playground ONLY for catalog ids that are explicitly
	* allowlisted as Gonka-network models. The Gonka Network OpenBroker
	* upstream runs models on decentralized compute where OMA-AI pays in
	* protocol credits, so we can offer those at $0 to website visitors.
	*
	* Everything else (Venice-routed, Zyloo-routed OMA-AI resale, and even
	* other "openbroker"-tagged models that are not actually on the Gonka
	* network) requires auth + credits in /chat, /playground, and the
	* /v1 API surface.
	*
	* Mirrors `FREE_CHAT_MODEL_IDS` in app/src/lib/model-utils.ts — keep in sync.
	*/
const GONKA_FREE_MODEL_IDS = new Set<string>([
	"deepseek-v4-flash-0731-openbroker",
	"gemini-3-flash-preview",
	"kimi-k2-6",
	"minimax-m2-7",
	// Venice budget fallback so guest chat still works when OpenBroker is down.
	"mistral-small-2603",
]);

function isFreeWebsiteModel(modelId: string): boolean {
	return GONKA_FREE_MODEL_IDS.has(modelId);
}

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
								content: z.string().or(z.array(z.any())),
								name: z.string().optional(),
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

chatRoutes.post(
		"/v1/chat/completions",
		rateLimit({
			windowMs: 60_000,
			maxRequests: 60,
			// Guest playground traffic is useless if Redis blips 503 every send.
			failClosed: process.env.NODE_ENV === "production",
		}),
		// Authenticate before the daily limiter so signed-in website users receive
		// the registered-user quota instead of being treated as anonymous.
		optionalAuth,
		dailyUsageLimit(),
		async (c) => {
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
				const source = c.req.header("X-OMA-Source");
				const origin = c.req.header("Origin") || c.req.header("Referer") || "";
				const allowedOrigins = [
					config.PUBLIC_APP_URL,
					"http://localhost:3000",
					"http://127.0.0.1:3000",
				].filter(Boolean) as string[];
				const originOk = allowedOrigins.some(
					(allowed) =>
						origin === allowed ||
						origin.startsWith(`${allowed}/`) ||
						origin.startsWith(allowed),
				);
				const isWebsiteRequest = source === "website" && originOk;
				const isFreeModel = isFreeWebsiteModel(model);

				// Website chat with free OMA-AI models: allow anonymous, skip billing
				// API requests or non-free models: require auth and bill credits
				const isFreeWebsiteChat = isWebsiteRequest && isFreeModel;
				
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

				// 2026-07-30: idempotency-key support. If the client sends an
				// Idempotency-Key header (OpenAI / Anthropic convention) or
				// `idempotency_key` in the JSON body, and we've already processed
				// a request with that key from the same user, replay the cached
				// response (saves the upstream call, prevents double-billing).
				const idempotencyKey =
						c.req.header("Idempotency-Key")?.trim() ||
						(body as { idempotency_key?: string } | undefined)?.idempotency_key;
				const requestId = idempotencyKey
						? `idem-${userId}-${idempotencyKey}`.slice(0, 200)
						: `chatcmpl-${crypto.randomUUID()}`;

				try {
						if (idempotencyKey && userId) {
								const prior = await db
										.select()
										.from(usageRecords)
										.where(
												and(
														eq(usageRecords.userId, userId),
														eq(usageRecords.requestId, requestId),
														eq(usageRecords.status, "completed"),
												),
										)
										.limit(1);
						if (prior.length > 0) {
								// Cache hit — return the recorded usage data. Full response body
								// replay is deferred to v2 (requires storing the complete payload).
								// For now, return a structured completion with usage stats so
								// clients like Claude Code can read token counts.
								logger.info(
										{ userId, idempotencyKey, requestId },
										"[chat] idempotency cache hit; replaying",
								);
								return c.json({
										object: "chat.completion",
										id: requestId,
										note: "idempotency-replay",
										model,
										choices: [
												{
														index: 0,
														message: { role: "assistant", content: "" },
														finish_reason: "stop",
												},
										],
										usage: {
												prompt_tokens: prior[0].inputTokens,
												completion_tokens: prior[0].outputTokens,
												total_tokens: (prior[0].inputTokens ?? 0) + (prior[0].outputTokens ?? 0),
										},
								});
						}
				}

				const promptText = messages.map((m) => flattenMessageContent(m.content)).join("\n");
				const promptTokens = estimateTokens(promptText);

				// Fail before calling an upstream provider when an authenticated request
				// has no usable credit balance. The ledger remains the final atomic guard
				// after the provider returns, but this avoids serving obviously unpaid
				// requests and gives the client a useful 402 response.
				if (userId && !isFreeWebsiteChat) {
								await assertSufficientBalance(userId, getModelPricing(model), promptTokens, max_tokens);
						}

						const { response: upstreamResp, actualModelId } = await routeRequestWithFallback({
								modelId: model,
								clientFallbacks: clientModels,
								messages: messages.map((m) => ({
										role: m.role,
										content: m.content,
										...(m.name ? { name: m.name } : {}),
								})),
								stream,
								max_tokens,
								temperature,
								top_p,
								tools,
								tool_choice,
								userId: userId ?? "anonymous",
								requestId,
								skipBilling: isFreeWebsiteChat, // Don't deduct credits for free website chat
						});

						const actualModelDef = getModelById(actualModelId) || modelDef;
						const actualPricing = getModelPricing(actualModelId);

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
										userId: userId ?? "anonymous",
										model: actualModelId,
										provider: actualModelDef.provider as "venice" | "oma-ai" | "litellm",
										promptTokens,
										pricing: actualPricing,
										requestId,
										skipBilling: isFreeWebsiteChat,
								});
								return c.body(proxyStream, 200);
						}

						const { data } = await parseNonStreamingResponse(upstreamResp, {
								userId: userId ?? "anonymous",
								model: actualModelId,
								provider: actualModelDef.provider as "venice" | "oma-ai" | "litellm",
								promptTokens,
								pricing: actualPricing,
								requestId,
								skipBilling: isFreeWebsiteChat,
						});

						return c.json(data);
				} catch (err) {
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

export { ProviderError, estimateTokens, flattenMessageContent };