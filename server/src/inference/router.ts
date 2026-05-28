import crypto from "crypto";
import { getModel } from "./models.js";
import { selectProvider } from "./provider-selector.js";
import { callProvider } from "./call-provider.js";
import type { Provider } from "./provider-selector.js";
import { countMessageTokens, refundCreditsWithRetry } from "./credit-preflight.js";
import { createTrackingStream, getStreamMetrics } from "./stream-tracker.js";
import { calculateActualCost, getModelPricing, getEstimatedOutputTokens } from "./billing-service.js";
import { recordUsage } from "./usage-service.js";
import { getStakingDiscount, preflightDeduction } from "../credits/index.js";
import { trace, SpanKind, SpanStatusCode, type Span } from "@opentelemetry/api";
import {
  LLM_ATTRS,
  PROVIDER_ERROR_TYPES,
  setErrorAttributes,
} from "../tracing.js";

export { getModelPricing } from "./billing-service.js";
export { getStreamMetrics };
export { selectProvider };
export { routeInference } from "./provider-selector.js";
export type { Provider } from "./provider-selector.js";

const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024;
const MAX_MESSAGE_CONTENT_SIZE = 100_000;

function validateRequest(body: { model?: string; messages?: import("./types.js").ChatMessage[]; [key: string]: unknown }): void {
  const bodySize = new TextEncoder().encode(JSON.stringify(body)).length;
  if (bodySize > MAX_REQUEST_BODY_SIZE) {
    throw Object.assign(new Error("Request body too large"), { status: 413 });
  }
  if (body.messages) {
    for (const msg of body.messages) {
      const content = typeof msg.content === "string" ? msg.content : "";
      if (content.length > MAX_MESSAGE_CONTENT_SIZE) {
        throw Object.assign(new Error("Message content exceeds maximum length"), { status: 400 });
      }
    }
  }
}

async function callProviderWithRefund(provider: Provider, providerModelId: string, body: Record<string, unknown>, userId: string, estimatedCostCents: string): Promise<Response> {
  try {
    return await callProvider(provider, providerModelId, body);
  } catch (err) {
    await refundCreditsWithRetry(userId, estimatedCostCents);
    const errorType = (err as { status?: number }).status
      ? (err as { type?: string }).type ?? PROVIDER_ERROR_TYPES.UNKNOWN_ERROR
      : PROVIDER_ERROR_TYPES.CONNECTION_ERROR;
    setErrorAttributes(errorType, "Provider request failed", provider);
    const publicError = (err as { status?: number }).status
      ? new Error("Inference provider error")
      : new Error("Failed to connect to inference provider");
    throw Object.assign(publicError, { status: (err as { status?: number }).status ?? 502 });
  }
}

async function handleNonStreamingResponse(
  json: unknown, modelId: string, inputTokens: number, discountPercent: number,
  userId: string, apiKeyId: string, provider: string, estimatedCostCents: string,
  requestId: string, requestStartTime: number, span: Span,
): Promise<{ response: Response; provider: string; inputTokens: number; outputTokens: number }> {
  const actualInput = (json as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? inputTokens;
  const actualOutput = (json as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? 0;
  span.setAttribute(LLM_ATTRS.TOKENS_INPUT, actualInput);
  span.setAttribute(LLM_ATTRS.TOKENS_OUTPUT, actualOutput);
  span.setAttribute(LLM_ATTRS.TOKENS_TOTAL, actualInput + actualOutput);
  span.setAttribute("llm.request_duration_ms", Date.now() - requestStartTime);
  const actualCost = await calculateActualCost(modelId, actualInput, actualOutput, discountPercent);
  await recordUsage({
    requestId, userId, apiKeyId, modelId, provider,
    inputTokens: actualInput, outputTokens: actualOutput,
    costCents: actualCost.costCents, markupCents: actualCost.markupCents, totalCents: actualCost.totalCents,
  });
  const refund = parseInt(estimatedCostCents, 10) - parseInt(actualCost.totalCents, 10);
  if (refund > 0) await refundCreditsWithRetry(userId, String(refund));
  const response = Response.json(json, { headers: { "x-provider": provider } });
  span.setStatus({ code: SpanStatusCode.OK });
  return { response, provider, inputTokens: actualInput, outputTokens: actualOutput };
}

export async function handleChatCompletion(userId: string, apiKeyId: string, body: { model: string; messages?: import("./types.js").ChatMessage[]; stream?: boolean; [key: string]: unknown }): Promise<{ response: Response; provider: string; inputTokens?: number; outputTokens?: number }> {
  const requestId = crypto.randomUUID();
  const requestStartTime = Date.now();
  validateRequest(body);

  return trace.getTracer("oma-server").startActiveSpan("llm.inference.handleChatCompletion", { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      let _ttftMs: number | undefined;
      span.setAttribute("user.id", userId);
      span.setAttribute(LLM_ATTRS.REQUEST_ID, requestId);
      span.setAttribute(LLM_ATTRS.MODEL, body.model);
      span.setAttribute(LLM_ATTRS.STREAMING, body.stream ?? false);
      span.setAttribute(LLM_ATTRS.API_KEY_ID, apiKeyId);
      span.setAttribute(LLM_ATTRS.USER_ID, userId);

      const modelId = body.model;
      const model = await getModel(modelId);
      const [discountPercent, pricing, estimatedOutputTokens] = await Promise.all([
        getStakingDiscount(userId),
        getModelPricing(modelId),
        getEstimatedOutputTokens(modelId),
      ]);
      const inputTokens = body.messages ? countMessageTokens(body.messages) : 0;
      span.setAttribute(LLM_ATTRS.TOKENS_INPUT, inputTokens);
      const inputPerToken = pricing.inputPer1k / 1000;
      const outputPerToken = pricing.outputPer1k / 1000;
      const markupMultiplier = 1 + pricing.markup / 100;
      const discountMultiplier = 1 - discountPercent / 100;
      const estimatedCostUsd = ((inputTokens * inputPerToken) + (estimatedOutputTokens * outputPerToken)) * markupMultiplier * discountMultiplier;
      const estimatedCostCents = String(Math.max(1, Math.ceil(estimatedCostUsd * 100)));

      const deducted = await preflightDeduction(userId, estimatedCostCents);
      if (!deducted) throw Object.assign(new Error("Insufficient credits"), { status: 402 });

      const { provider, providerModelId } = await selectProvider(modelId);
      span.setAttribute(LLM_ATTRS.PROVIDER, provider);
      span.setAttribute("llm.provider_model_id", providerModelId);

      const resp = await callProviderWithRefund(provider, providerModelId, body, userId, estimatedCostCents);

      if (body.stream) {
        if (!resp.body) {
          await refundCreditsWithRetry(userId, estimatedCostCents);
          throw Object.assign(new Error("No response body for streaming"), { status: 502 });
        }
        const trackingStream = createTrackingStream(
          resp.body as ReadableStream<Uint8Array>,
          model, modelId, inputTokens, discountPercent, userId, apiKeyId, provider, estimatedCostCents, pricing, requestId,
          async (timeToFirstToken, totalTokens, durationMs) => {
            _ttftMs = timeToFirstToken;
            span.setAttribute(LLM_ATTRS.TIME_TO_FIRST_TOKEN_MS, timeToFirstToken);
            if (totalTokens > 0 && durationMs > 0)
              span.setAttribute(LLM_ATTRS.TOKEN_THROUGHPUT_PER_SEC, totalTokens / (durationMs / 1000));
            span.setAttribute("llm.streaming_duration_ms", durationMs);
          }
        );
        const response = new Response(trackingStream as ReadableStream<Uint8Array>, {
          status: resp.status,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "x-provider": provider },
        });
        span.setAttribute("llm.response_start_time_ms", Date.now() - requestStartTime);
        span.setStatus({ code: SpanStatusCode.OK });
        // Note: outputTokens is not available for streaming responses until the stream completes.
        // Usage is recorded asynchronously via the stream tracker's handleStreamEnd function.
        return { response, provider, inputTokens };
      }

      const json = await resp.json();
      return handleNonStreamingResponse(json, modelId, inputTokens, discountPercent, userId, apiKeyId, provider, estimatedCostCents, requestId, requestStartTime, span);
    } catch (err) {
      const errorType = (err as { status?: number }).status
        ? (err as { type?: string }).type ?? PROVIDER_ERROR_TYPES.UNKNOWN_ERROR
        : PROVIDER_ERROR_TYPES.CONNECTION_ERROR;
      setErrorAttributes(errorType, "Request processing failed", (err as { provider?: string }).provider);
      span.setStatus({ code: SpanStatusCode.ERROR, message: "Request processing failed" });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw Object.assign(new Error("Inference request failed"), { status: (err as { status?: number }).status ?? 500 });
    } finally {
      span.end();
    }
  });
}
