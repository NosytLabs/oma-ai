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

function tokenCount(value: unknown): number | null {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

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
		let contentText = "";
		let reasoningText = "";
		let toolText = "";
		const estimatedOutput = () => estimateTokens(contentText) + estimateTokens(reasoningText) + estimateTokens(toolText);
		let finalPromptTokens: number | null = null;
		let finalOutputTokens: number | null = null;
		let upstreamStatus: "completed" | "error" = "completed";
		let sseCarry = "";
		function consumeLine(line: string) {
			if (!line.startsWith("data:")) return;
			const payload = line.slice(5).trim();
			if (!payload || payload === "[DONE]") return;
			try {
				const obj = JSON.parse(payload);
				const delta = obj.choices?.[0]?.delta;
				if (typeof delta?.content === "string") contentText += delta.content;
				// Providers can emit both aliases for the same reasoning. Count it once.
				const reasoning = delta?.reasoning_content || delta?.reasoning;
				if (typeof reasoning === "string") reasoningText += reasoning;
				if (Array.isArray(delta?.tool_calls)) for (const tool of delta.tool_calls) {
					if (typeof tool?.function?.arguments === "string") toolText += tool.function.arguments;
				}
				finalOutputTokens = tokenCount(obj.usage?.completion_tokens) ?? finalOutputTokens;
				finalPromptTokens = tokenCount(obj.usage?.prompt_tokens) ?? finalPromptTokens;
			} catch { /* Malformed upstream SSE lines pass through unchanged. */ }
		}

		return new ReadableStream<Uint8Array>({
				async pull(controller) {
						try {
								const { done, value } = await reader.read();
								if (done) {
										// Flush any incomplete trailing SSE line
										if (sseCarry) {
												consumeLine(sseCarry);
												const rewritten = rewriteSseModelField(sseCarry, recordArgs.model);
												controller.enqueue(encoder.encode(rewritten));
												sseCarry = "";
										}
										controller.close();
										// Use upstream-reported usage when available (OMA-AI sends a final
										// usage chunk at the end of the stream), falling back to estimates.
										const finalTokens = finalOutputTokens ?? recordArgs.outputTokens ?? estimatedOutput();
										const promptTokens = finalPromptTokens ?? recordArgs.promptTokens;
										await recordUsage({ ...recordArgs, promptTokens, outputTokens: finalTokens, status: upstreamStatus });
										return;
								}
								const text = sseCarry + decoder.decode(value, { stream: true });
								// Keep last incomplete line so we never split mid-JSON.
								const lastNl = text.lastIndexOf("\n");
								const complete = lastNl >= 0 ? text.slice(0, lastNl + 1) : "";
								sseCarry = lastNl >= 0 ? text.slice(lastNl + 1) : text;

								for (const line of complete.split("\n")) consumeLine(line);
								const out = rewriteSseModelField(complete, recordArgs.model);
								controller.enqueue(encoder.encode(out));
								} catch (err) {
									logger.warn({ err }, "[proxy] stream read failed");
									upstreamStatus = "error";
									controller.error(err);
									// Retain consumed-token cost estimates for operations. Failed
									// completions are recorded without a customer credit deduction.
									try {
										await recordUsage({
											...recordArgs,
											promptTokens: finalPromptTokens ?? recordArgs.promptTokens,
											outputTokens: finalOutputTokens ?? estimatedOutput(),
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
								// Canceled streams retain token/cost estimates without charging
								// customer credits, so the admin can account for the expense.
								try {
								await recordUsage({
									...recordArgs,
									promptTokens: finalPromptTokens ?? recordArgs.promptTokens,
									outputTokens: finalOutputTokens ?? estimatedOutput(),
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

		const message = data?.choices?.[0]?.message;
		const completionText = flattenMessageContent(message?.content ?? "");
		const reasoning = message?.reasoning_content || message?.reasoning;
		const toolText = Array.isArray(message?.tool_calls) ? message.tool_calls
			.map((tool: { function?: { arguments?: unknown } }) => typeof tool?.function?.arguments === "string" ? tool.function.arguments : "").join("") : "";
		const completionTokens = tokenCount(data?.usage?.completion_tokens) ?? (
			estimateTokens(completionText) + estimateTokens(typeof reasoning === "string" ? reasoning : "") + estimateTokens(toolText));
		const finalPromptTokens = tokenCount(data?.usage?.prompt_tokens) ?? recordArgs.promptTokens;

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
