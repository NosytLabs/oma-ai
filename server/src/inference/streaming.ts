/**
	* Streaming and non-streaming response handlers.
	*
	* Extracted from proxy.ts for focused responsibility.
	*/
import { logger } from "../lib/logger.js";
import { rewriteSseModelField } from "./fallback.js";
import { ProviderError } from "./provider-route.js";
import { estimateTokens, flattenMessageContent } from "./token-utils.js";
import {
	recordUsage,
	type RecordUsageArgs,
	type UsageProvider,
} from "./billing.js";

/** Args for createStreamingProxy — outputTokens is calculated during streaming. */
export interface StreamingProxyArgs {
	userId: string;
	model: string;
	requestedModel?: string;
	provider: UsageProvider;
	routedVia?: string;
	attemptCount?: number;
	promptTokens: number;
	pricing: RecordUsageArgs["pricing"];
	requestId: string;
	outputTokens?: number;
	/** Epoch ms of request start; persisted as usage_records.latency_ms. */
	startedAt?: number;
	/** Skip credit deduction for free website chat */
	skipBilling?: boolean;
	/** API key row id for Bearer-auth callers (null for website sessions). */
	apiKeyId?: string | null;
}

/**
	* Streaming helper — wraps an upstream SSE stream, counts output tokens,
	* and calls recordUsage when the stream ends (or errors).
	* Returns a new ReadableStream that pipes the upstream chunks through.
	*/
export function createStreamingProxy(
		upstreamResp: Response,
		recordArgs: StreamingProxyArgs,
): ReadableStream<Uint8Array> {
		if (!upstreamResp.body) {
				throw new ProviderError("Upstream stream empty", 502);
		}
		const reader = upstreamResp.body.getReader();
		const decoder = new TextDecoder();
		const encoder = new TextEncoder();
		let outputTokens = 0;
		let finalPromptTokens: number | null = null;
		let finalOutputTokens: number | null = null;
		let upstreamStatus: "completed" | "error" = "completed";
		let sseCarry = "";

		return new ReadableStream<Uint8Array>({
				async pull(controller) {
						try {
								const { done, value } = await reader.read();
								if (done) {
										// Flush any incomplete trailing SSE line
										if (sseCarry) {
												const rewritten = rewriteSseModelField(sseCarry, recordArgs.model);
												controller.enqueue(encoder.encode(rewritten));
												sseCarry = "";
										}
										controller.close();
										// Use upstream-reported usage when available (OMA-AI sends a final
										// usage chunk at the end of the stream), falling back to estimates.
										const finalTokens = finalOutputTokens ?? recordArgs.outputTokens ?? outputTokens;
										const promptTokens = finalPromptTokens ?? recordArgs.promptTokens;
										await recordUsage({ ...recordArgs, promptTokens, outputTokens: finalTokens, status: upstreamStatus });
										return;
								}
								const text = sseCarry + decoder.decode(value, { stream: true });
								// Keep last incomplete line so we never split mid-JSON.
								const lastNl = text.lastIndexOf("\n");
								const complete = lastNl >= 0 ? text.slice(0, lastNl + 1) : "";
								sseCarry = lastNl >= 0 ? text.slice(lastNl + 1) : text;

								for (const line of complete.split("\n")) {
										if (!line.startsWith("data:")) continue;
										const payload = line.slice(5).trim();
										if (!payload || payload === "[DONE]") continue;
										try {
												const obj = JSON.parse(payload);
												const choice = obj.choices?.[0];
												// Handle both "content" and "reasoning"/"reasoning_content" deltas.
												// OMA-AI/Gonka uses "reasoning" for chain-of-thought;
												// Venice uses "reasoning_content". Both count as output tokens.
												const delta = choice?.delta?.content ?? choice?.delta?.reasoning_content ?? choice?.delta?.reasoning;
												if (typeof delta === "string" && delta.length > 0) {
														outputTokens += estimateTokens(delta);
												}
												// Capture upstream-reported usage (final chunk has usage object)
												if (obj.usage?.completion_tokens) {
														finalOutputTokens = obj.usage.completion_tokens;
												}
												if (obj.usage?.prompt_tokens) {
														finalPromptTokens = obj.usage.prompt_tokens;
												}
										} catch {
												// ignore unparseable SSE lines
										}
								}
								const out = rewriteSseModelField(complete, recordArgs.model);
								controller.enqueue(encoder.encode(out));
								} catch (err) {
									logger.warn({ err }, "[proxy] stream read failed");
									upstreamStatus = "error";
									controller.error(err);
									// SECURITY (audit 2026-09-27 / P0): record usage for the tokens
									// already streamed before the read error. Without this the
									// consumed upstream tokens are never billed — a client can
									// force a read error and walk away with free tokens.
									try {
										await recordUsage({
											...recordArgs,
											promptTokens: finalPromptTokens ?? recordArgs.promptTokens,
											outputTokens: finalOutputTokens ?? outputTokens,
											status: "error",
										});
									} catch (recErr) {
										logger.warn({ err: recErr }, "[proxy] recordUsage on read-error failed");
									}
									try {
										await reader.cancel();
									} catch (cancelErr) {
										logger.warn({ err: cancelErr }, "[proxy] reader cancel failed");
									}
								}
								},
								async cancel() {
								reader.cancel().catch(() => {});
								// SECURITY (audit 2026-09-27 / P0): a client can read most of a
								// completion then abort before done. Bill the tokens streamed so far
								// instead of letting the disconnect absorb the cost.
								try {
								await recordUsage({
									...recordArgs,
									promptTokens: finalPromptTokens ?? recordArgs.promptTokens,
									outputTokens: finalOutputTokens ?? outputTokens,
									status: "aborted",
								});
								} catch (recErr) {
								logger.warn({ err: recErr }, "[proxy] recordUsage on client-abort failed");
								}
								},
		});
}

/**
	* Non-streaming helper — parses upstream JSON, counts tokens, records usage,
	* and returns the parsed data for the caller to translate.
	*/
export async function parseNonStreamingResponse(
		upstreamResp: Response,
		recordArgs: Omit<RecordUsageArgs, "status" | "outputTokens">,
): Promise<{
		data: unknown;
		promptTokens: number;
		outputTokens: number;
}> {
		const data = await upstreamResp.json().catch(() => null);
		if (!data) {
				throw new ProviderError("Invalid upstream response", 502);
		}

		const completionText =
				data?.choices?.[0]?.message?.content ??
				flattenMessageContent(data?.choices?.[0]?.message?.content ?? "") ??
				"";
		const reported = data?.usage?.completion_tokens;
		const completionTokens =
				typeof reported === "number" && reported > 0 ? reported : estimateTokens(completionText);
		const finalPromptTokens = data?.usage?.prompt_tokens ?? recordArgs.promptTokens;

		await recordUsage({
				...recordArgs,
				promptTokens: finalPromptTokens,
				outputTokens: completionTokens,
				status: "completed",
		});

		// OpenRouter-style: body.model is the model that actually served the request
		// (may differ from the requested id after failover).
		if (data && typeof data === "object" && recordArgs.model) {
				(data as { model?: string }).model = recordArgs.model;
		}

		return { data, promptTokens: finalPromptTokens, outputTokens: completionTokens };
}
