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
	reservation?: boolean;
	/** Signal the terminal inference outcome before an outer response guard sees EOF. */
	onFinalized?: (status: "completed" | "error" | "aborted") => void;
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
		let providerResponseId: string | undefined;
		let terminalSeen = false;
		let malformedFrame = false;
		let completionFrameSeen = false;
		let usageFinalized = false;
		let sseCarry = "";
		let terminated = false;
		async function finishUsage(status: "completed" | "error" | "aborted") {
			if (usageFinalized) return;
			usageFinalized = true;
			const usageVerified = finalPromptTokens !== null && finalOutputTokens !== null && !malformedFrame;
			const missingPaidUsage = recordArgs.reservation && status === "completed" && (!usageVerified || !terminalSeen || !completionFrameSeen);
			let finalizedStatus = missingPaidUsage ? "error" as const : status;
			try {
				await recordUsage({
					...recordArgs,
					promptTokens: finalPromptTokens ?? recordArgs.promptTokens,
					outputTokens: finalOutputTokens ?? recordArgs.outputTokens ?? estimatedOutput(),
					status: finalizedStatus,
					providerResponseId,
					usageVerified,
				});
				if (missingPaidUsage) throw new ProviderError("Provider usage is incomplete; credits are held for reconciliation", 503);
			} catch (err) {
				logger.warn({ err, status }, "[proxy] recordUsage failed");
				if (recordArgs.reservation) {
					finalizedStatus = "error";
					throw err;
				}
			} finally {
				recordArgs.onFinalized?.(finalizedStatus);
			}
		}
		function consumeLine(line: string) {
			if (!line.startsWith("data:")) return;
			const payload = line.slice(5).trim();
			if (payload === "[DONE]") { terminalSeen = true; return; }
			if (!payload) return;
			let obj;
			try { obj = JSON.parse(payload); } catch { malformedFrame = true; return; }
			if (!obj || typeof obj !== "object" || Array.isArray(obj)) { malformedFrame = true; return; }
			if (Array.isArray(obj.choices) && obj.choices.length > 0) completionFrameSeen = true;
			if (obj?.error) throw new ProviderError("Upstream stream failed", 502);
			if (typeof obj?.id === "string") providerResponseId = obj.id.slice(0, 256);
			if (typeof obj?.choices?.[0]?.finish_reason === "string" && obj.choices[0].finish_reason) terminalSeen = true;
			try {
				const delta = obj.choices?.[0]?.delta;
				if (typeof delta?.content === "string") contentText += delta.content;
				// Providers can emit both aliases for the same reasoning. Count it once.
				const reasoning = delta?.reasoning_content || delta?.reasoning;
				if (typeof reasoning === "string") reasoningText += reasoning;
				if (Array.isArray(delta?.tool_calls)) for (const tool of delta.tool_calls) {
					if (typeof tool?.function?.arguments === "string") toolText += tool.function.arguments;
				}
				// The latest usage frame is authoritative. A malformed final frame
				// cannot borrow valid preliminary counters and silently underbill.
				if (obj.usage !== undefined && obj.usage !== null) {
					finalOutputTokens = tokenCount(obj.usage?.completion_tokens);
					finalPromptTokens = tokenCount(obj.usage?.prompt_tokens);
				}
			} catch { /* Malformed upstream SSE lines pass through unchanged. */ }
		}

		return new ReadableStream<Uint8Array>({
				async pull(controller) {
						if (terminated) return;
						try {
								const { done, value } = await reader.read();
								// Cancellation resolves an in-flight read. Do not close or meter twice.
								if (terminated) return;
								if (done) {
										// Flush any incomplete trailing SSE line
										if (sseCarry) {
												consumeLine(sseCarry);
												const rewritten = rewriteSseModelField(sseCarry, recordArgs.model);
												controller.enqueue(encoder.encode(rewritten));
												sseCarry = "";
										}
										// Use upstream-reported usage when available (OMA-AI sends a final
										// usage chunk at the end of the stream), falling back to estimates.
										await finishUsage("completed");
										terminated = true;
										// Admission guards must observe persisted usage before EOF.
										controller.close();
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
									if (terminated) return;
									terminated = true;
									logger.warn({ err }, "[proxy] stream read failed");
									// Retain consumed-token cost estimates for operations. Failed
									// completions are recorded without a customer credit deduction.
									await finishUsage("error");
									controller.error(err);
									try {
										await reader.cancel();
									} catch (cancelErr) {
										logger.warn({ err: cancelErr }, "[proxy] reader cancel failed");
									}
								}
								},
								async cancel() {
								if (terminated) return;
								terminated = true;
								reader.cancel().catch(() => {});
								// Canceled streams retain token/cost estimates without charging
								// customer credits, so the admin can account for the expense.
								await finishUsage("aborted");
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
		if (data.error) throw new ProviderError("Upstream response failed", 502);

		const message = data?.choices?.[0]?.message;
		const completionText = flattenMessageContent(message?.content ?? "");
		const reasoning = message?.reasoning_content || message?.reasoning;
		const toolText = Array.isArray(message?.tool_calls) ? message.tool_calls
			.map((tool: { function?: { arguments?: unknown } }) => typeof tool?.function?.arguments === "string" ? tool.function.arguments : "").join("") : "";
		const completionTokens = tokenCount(data?.usage?.completion_tokens) ?? (
			estimateTokens(completionText) + estimateTokens(typeof reasoning === "string" ? reasoning : "") + estimateTokens(toolText));
		const finalPromptTokens = tokenCount(data?.usage?.prompt_tokens) ?? recordArgs.promptTokens;

		const usageVerified = tokenCount(data?.usage?.prompt_tokens) !== null && tokenCount(data?.usage?.completion_tokens) !== null;
		const completionValid = message && (typeof message.content === "string" || Array.isArray(message.content) || (Array.isArray(message.tool_calls) && message.tool_calls.length > 0));
		const missingPaidUsage = recordArgs.reservation && (!usageVerified || !completionValid);
		await recordUsage({
				...recordArgs,
				promptTokens: finalPromptTokens,
				outputTokens: completionTokens,
				status: missingPaidUsage ? "error" : "completed",
				providerResponseId: typeof data.id === "string" ? data.id.slice(0, 256) : undefined,
				usageVerified,
		});
		if (missingPaidUsage) throw new ProviderError("Provider usage is incomplete; credits are held for reconciliation", 503);

		// OpenRouter-style: body.model is the model that actually served the request
		// (may differ from the requested id after failover).
		if (data && typeof data === "object" && recordArgs.model) {
				(data as { model?: string }).model = recordArgs.model;
		}

		return { data, promptTokens: finalPromptTokens, outputTokens: completionTokens };
}
