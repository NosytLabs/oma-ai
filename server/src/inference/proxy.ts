/**
	* Shared inference proxy — provider call + billing logic used by both
	* OpenAI-compatible (/v1/chat/completions) and Anthropic-compatible (/v1/messages) endpoints.
	*
	* This file is the public API surface. Internal logic is decomposed into:
	*   - provider-route.ts  — ProviderRoute, ProviderError, resolveProvider
	*   - token-utils.ts     — estimateTokens, flattenMessageContent
	*   - billing.ts         — RecordUsageArgs, assertSufficientBalance, recordUsage
	*   - streaming.ts       — createStreamingProxy, parseNonStreamingResponse
	*/
import { getModelById } from "./models.js";
import { buildFallbackChain } from "./fallback.js";
import { logger } from "../lib/logger.js";

// Decomposed modules — re-export for backward compatibility.
export {
		ProviderError,
		resolveProvider,
		type ProviderRoute,
} from "./provider-route.js";
export { estimateTokens, flattenMessageContent } from "./token-utils.js";
export {
		assertSufficientBalance,
		recordUsage,
		type RecordUsageArgs,
} from "./billing.js";
export {
		createStreamingProxy,
		parseNonStreamingResponse,
		type StreamingProxyArgs,
} from "./streaming.js";

// Re-export for existing test/route imports that pull helpers from proxy.
export { FALLBACK_MAP, buildFallbackChain, rewriteSseModelField } from "./fallback.js";

import { ProviderAuthenticationError, ProviderError, resolveProvider, isModelPrivacyAllowed } from "./provider-route.js";

export interface CallProviderOptions {
		modelId: string;
		messages: Array<{ role: string; content: string | unknown[] | null; name?: string; tool_calls?: unknown[]; tool_call_id?: string }>;
		stream: boolean;
		max_tokens?: number;
		temperature?: number;
		top_p?: number;
		tools?: unknown[];
		tool_choice?: unknown;
		userId: string;
		requestId: string;
		/** Cancel queued inference and retries when the caller disconnects. */
		signal?: AbortSignal;
		/** Skip credit deduction for free website chat */
		skipBilling?: boolean;
		/**
			* OpenRouter-style client fallback list (tried after the primary model,
			* before the server FALLBACK_MAP peers). Invalid/unknown ids are ignored.
			*/
		clientFallbacks?: string[];
		/** Restrict both primary and fallback routes to the caller's key scope. */
		allowedModels?: string[] | null;
		/** Do not multiply uncertain upstream bills after a prepaid hold. */
		prepaidReservation?: boolean;
}

/**
	* Core provider call — handles upstream request, streaming, billing, and usage recording.
	* Returns the raw upstream Response object for the caller to translate/stream as needed.
	*/
async function callProvider(opts: CallProviderOptions): Promise<Response> {
		const { modelId, messages, stream, max_tokens, temperature, top_p, tools, tool_choice } = opts;

		const modelDef = getModelById(modelId);
		if (!modelDef) {
			throw new ProviderError(`Model ${modelId} not found`, 404, true);
		}

		// Resolve upstream provider (Venice vs OMA-AI/OpenBroker).
		const provider = modelDef.provider;
		const route = resolveProvider(provider, modelDef);

		const upstreamUrl = `${route.baseUrl}/chat/completions`;
		const upstreamModel = route.upstreamModel(
				modelDef.veniceId ?? modelDef.id,
				modelDef.omaAiId,
		);

		const upstreamBody = route.extraBody({
			model: upstreamModel,
				messages: messages.map((m) => ({
						role: m.role,
						content: m.content,
						...(m.name ? { name: m.name } : {}),
						...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
						...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
				})),
				stream,
				...(stream ? { stream_options: { include_usage: true } } : {}),
				...(max_tokens ? { max_tokens } : {}),
				...(temperature !== undefined ? { temperature } : {}),
				...(top_p !== undefined ? { top_p } : {}),
				...(tools ? { tools } : {}),
				...(tool_choice ? { tool_choice } : {}),
		});

		// OpenBroker host selection can take several minutes. Keep both headers
		// and response-body reads bounded, within the router's overall budget.
		const timeoutMs = provider === "oma-ai" ? 180_000 : stream ? 120_000 : 60_000;
		const timeoutSignal = AbortSignal.timeout(timeoutMs);
		const upstreamSignal = opts.signal
			? AbortSignal.any([opts.signal, timeoutSignal])
			: timeoutSignal;
		let fetchError: unknown = null;
		const upstreamResp = await fetch(upstreamUrl, {
				method: "POST",
				headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${route.apiKey}`,
				},
				body: JSON.stringify(upstreamBody),
				signal: upstreamSignal,
		}).catch((err) => {
				fetchError = err;
				if (!opts.signal?.aborted) logger.error({ err, provider: route.providerLabel, timedOut: timeoutSignal.aborted }, "[proxy] upstream fetch failed");
				return null;
		});

		if (!upstreamResp) {
				opts.signal?.throwIfAborted();
				if (
						timeoutSignal.aborted ||
						(fetchError instanceof Error &&
								(fetchError.name === "AbortError" || /aborted|timeout/i.test(fetchError.message)))
				) {
						throw new ProviderError(
								`Upstream inference timeout after ${timeoutMs}ms`,
								408,
						);
				}
				throw new ProviderError("Upstream inference provider unreachable", 502);
		}

		if (!upstreamResp.ok) {
				const status = upstreamResp.status as number;
				// Error bodies can echo prompts or provider account information.
				// Release the response without retaining its contents in logs.
				await upstreamResp.body?.cancel().catch(() => {});
				logger.warn(
						{ status, model: modelId, provider: route.providerLabel },
						"[proxy] upstream returned non-2xx",
				);
				const safeStatus = status >= 500 ? 502 : status;
				// 401 from an upstream means the provider key is rejected (invalid,
				// expired, or out of credits). Surface an actionable message instead
				// of the raw upstream body, which is often just `{"error":"Authentication failed"}`.
				if (status === 401) {
						throw new ProviderAuthenticationError();
				}
				// 429 = upstream rate-limited / concurrency cap. Raw upstream bodies
				// are noise for end users; keep the detail in the server log instead.
				if (status === 429) {
						throw new ProviderError(
								"Inference provider is rate-limited. Try again in a few seconds.",
								429,
								true,
						);
				}
				// SECURITY: never forward the raw upstream body. For non-5xx
				// errors that body can contain sensitive provider data or prompts.
				// Retain status and routing metadata only.
				throw new ProviderError(
					status >= 500
						? "Inference provider temporarily unavailable"
						: `Upstream request failed (${status})`,
					safeStatus,
					status < 500,
				);
		}

		return upstreamResp;
}

/**
	* Intelligent Router — routes a requested model with automatic retries (exponential backoff)
	* and failover to comparable fallback models when errors occur.
	*/
export async function routeRequestWithFallback(
		opts: CallProviderOptions,
): Promise<{
	response: Response;
	actualModelId: string;
	/**
	 * Total upstream attempts made across the whole fallback chain, counting
	 * the successful one. 1 means the requested model served the request on
	 * its first try; >1 means retries and/or model failover were needed.
	 * Persisted as usage_records.attempt_count so the admin can compute a
	 * failover rate per requested model.
	 */
	attemptCount: number;
}> {
	const modelId = opts.modelId;
	if (opts.allowedModels && !opts.allowedModels.includes(modelId)) {
		throw new ProviderError("This API key does not allow the requested model", 403, true);
	}
	const requested = getModelById(modelId);
	if (requested && !isModelPrivacyAllowed(requested)) throw new ProviderError("This model is temporarily unavailable under the current privacy policy. Choose a private model.", 503, true);
	if (requested?.disabledReason) throw new ProviderError(requested.disabledReason, 503, true);
	if (requested?.maxOutputTokens && opts.max_tokens && opts.max_tokens > requested.maxOutputTokens) {
		throw new ProviderError(`max_tokens exceeds this model's limit of ${requested.maxOutputTokens}`, 400, true);
	}
	// One budget across all models and retries, including the returned body.
	// The frontend waits 270 seconds, leaving time to return an actionable error.
	const deadline = AbortSignal.timeout(240_000);
	const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;
	function assertActive() {
		opts.signal?.throwIfAborted();
		if (deadline.aborted) throw new ProviderError("Inference request exceeded the 240-second gateway limit", 504);
	}
	assertActive();
	// Cumulative attempts across every model in the chain, not just this one.
	let totalAttempts = 0;
		const freeOnly = opts.skipBilling === true;
		const fallbacks = buildFallbackChain(
				modelId,
				opts.clientFallbacks ?? [],
				freeOnly,
		).filter(id => !opts.allowedModels || opts.allowedModels.includes(id));

		let lastError: unknown = null;
		let allExecutionRejected = true;
		const errorLog: unknown[] = [];
		// A provider shares one operator credential across its models. Once
		// rejected, further same-provider calls cannot repair it in this request.
		const rejectedProviders = new Set<string>();

		/** Narrow an `unknown` thrown value to the error fields we actually use. */
		function readError(e: unknown): { status?: number; message?: string; name?: string } {
				if (e && typeof e === "object") {
						const v = e as { status?: unknown; message?: unknown; name?: unknown };
						return {
								status: typeof v.status === "number" ? v.status : undefined,
								message: typeof v.message === "string" ? v.message : undefined,
								name: typeof v.name === "string" ? v.name : undefined,
						};
				}
				return {};
		}

		for (const currentModelId of fallbacks) {
				let attempt = 0;
				// Free website chat: fewer same-model retries so we fail over to the
				// next free peer quickly (OpenRouter-style model layer). Paid API keeps
				// a slightly deeper retry budget for transient 5xx/429.
				const maxRetries = freeOnly ? 1 : 2;
			const modelDef = getModelById(currentModelId);
			if (!modelDef) continue;
			if (!isModelPrivacyAllowed(modelDef)) continue;
			if (rejectedProviders.has(modelDef.provider)) continue;
			// A fallback with a smaller output ceiling cannot satisfy this request.
			if (modelDef.maxOutputTokens && opts.max_tokens && opts.max_tokens > modelDef.maxOutputTokens) continue;

				while (attempt <= maxRetries) {
						assertActive();
						try {
							totalAttempts++;
							const response = await callProvider({
										...opts,
										modelId: currentModelId,
										signal,
								});

								if (currentModelId !== modelId) {
										logger.info(
												{ originalModel: modelId, actualModel: currentModelId, requestId: opts.requestId },
												"[router] Fallback model selected successfully",
										);
								}

								return { response, actualModelId: currentModelId, attemptCount: Math.max(1, totalAttempts) };
						} catch (err) {
								assertActive();
								attempt++;
								lastError = err;
								errorLog.push(err);
								const e = readError(err);
								allExecutionRejected &&= err instanceof ProviderError && err.executionRejected;
								if (opts.prepaidReservation && !(err instanceof ProviderAuthenticationError) &&
					(e.status === undefined || e.status === 408 || (e.status >= 500 && !((err instanceof ProviderError) && err.executionRejected)))) {
									const failure = err instanceof ProviderError ? err : new ProviderError("Inference outcome requires reconciliation; retry with the same key", 502);
									failure.billingUncertain = true;
									throw failure;
								}
								const message = e.message ?? String(err);

								// Auth / not-found / bad request: never thrash the same model —
								// jump straight to the next peer in the chain.
								const isImmediateFailover =
										err instanceof ProviderAuthenticationError ||
										e.status === 401 ||
										e.status === 403 ||
										e.status === 404 ||
										e.status === 400 ||
										e.status === 408 ||
										e.status === 503;

								// Transient: 5xx, 408 request timeout, 429 rate limit, or network.
								const isTransient =
										e.status !== undefined &&
										(e.status >= 500 || e.status === 429 || e.status === 408);

								const isNetworkError =
										e.status === undefined ||
										(typeof e.message === "string" &&
												(e.message.includes("unreachable") ||
														e.message.includes("timeout") ||
														e.message.includes("fetch failed") ||
														e.message.includes("ECONNRESET") ||
														e.message.includes("ETIMEDOUT")));

								if (err instanceof ProviderAuthenticationError) rejectedProviders.add(modelDef.provider);
								if (
										!isImmediateFailover &&
										attempt <= maxRetries &&
										(isTransient || isNetworkError)
								) {
										// Exponential backoff with jitter. Cap higher on rate limits so we
										// don't hammer a throttled provider (OpenRouter-style patience).
										const baseDelay =
												e.status === 429
														? 400 * Math.pow(2, attempt - 1)
														: 100 * Math.pow(2, attempt - 1);
										const jitter = Math.random() * (e.status === 429 ? 150 : 50);
										const delay = Math.min(baseDelay + jitter, e.status === 429 ? 5000 : 2000);
										logger.warn(
												{ modelId: currentModelId, attempt, delay, error: message, status: e.status },
												"[router] Transient error calling model. Retrying after backoff...",
										);
										await new Promise((resolve) => setTimeout(resolve, delay));
										continue;
								}

								// Non-transient errors (like 400, 401, 403, 404), or exhausted retries:
								// log and break to try the next fallback model.
								logger.error(
										{ modelId: currentModelId, error: message, status: e.status },
										"[router] Error not retryable or exhausted retries on model.",
								);
								break;
						}
				}
		}

		// If all fallbacks failed, report the last observed error. If several
		// providers failed, surface the combination so users aren't misled into
		// thinking one provider alone broke the request.
		if (lastError) {
				const seen = new Map<string, string>();
				for (const err of errorLog) {
						const e = readError(err);
						const status = e.status ?? "network";
						const label = e.status === undefined ? "network/unreachable" : String(status);
						if (!seen.has(label)) seen.set(label, `${label} (${statusLabel(e.status, e.message)})`);
				}
				if (seen.size > 1) {
						throw new ProviderError(
								`All model providers failed: ${[...seen.values()].join(", ")}. Try another model or try again later.`,
								502, allExecutionRejected,
						);
				}
				if (lastError instanceof ProviderError) lastError.executionRejected = allExecutionRejected;
				throw lastError;
		}
		throw new ProviderError("Model routing failed on all fallback attempts", 502);
}

function statusLabel(status: number | undefined, message?: string): string {
		if (status === undefined) return "unreachable";
		if (status === 401) return "auth failed";
		if (status === 429) return "rate-limited";
		if (status >= 500) return "unavailable";
		if (typeof message === "string" && message.trim()) return message.slice(0, 80);
		return String(status);
}
