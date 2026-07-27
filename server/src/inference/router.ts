import crypto from "crypto";
import { getModel } from "./models.js";
import { callProvider } from "./call-provider.js";
import type { Provider } from "./provider-selector.js";
import { countMessageTokens, refundCreditsWithRetry } from "./credit-preflight.js";
import { createTrackingStream } from "./stream-tracker.js";
import { calculateActualCost, getModelPricing, getEstimatedOutputTokens } from "./billing-service.js";
import { recordUsage } from "./usage-service.js";
import { getStakingDiscount, preflightDeduction } from "../credits/index.js";
import { trace, SpanKind, SpanStatusCode, type Span } from "@opentelemetry/api";
import {
  LLM_ATTRS,
  PROVIDER_ERROR_TYPES,
  setErrorAttributes,
} from "../tracing.js";
import { getCandidateProviders, recordFailover } from "./cross-provider-router.js";
import { getModelIdForProvider } from "./provider-selector.js";
import { logger } from "../lib/logger.js";
import { trackApiKeySpend } from "./handler-helpers.js";

export { getModelPricing } from "./billing-service.js";
export { selectProvider } from "./provider-selector.js";
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

async function callProviderWithRefund(
  provider: Provider,
  providerModelId: string,
  body: Record<string, unknown>,
  userId: string,
  estimatedCostCents: string,
  signal?: AbortSignal,
  skipRefund = false,
): Promise<Response> {
  try {
    return await callProvider(provider, providerModelId, body, undefined, signal);
  } catch (err) {
    // SECURITY: When skipRefund is true, the credit reservation is still held
    // from a previous provider attempt. We do NOT refund here because the
    // failover loop will try the next provider using the same reservation.
    // Refunding on every failure would cause a double-refund:
    //   p1 fails → refund full estimate → p2 succeeds → refund delta = net gain
    if (!skipRefund) {
      await refundCreditsWithRetry(userId, estimatedCostCents);
    }
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

/**
 * Normalize a non-streaming upstream completion for clients:
 *  - never leak upstream internals (devshard ids, provider model slugs) —
 *    the id becomes `gen-<requestId>` (usable with GET /v1/generation) and
 *    `model` becomes our catalog id
 *  - Gonka (MiniMax M2.7) embeds reasoning as a leading `<think>…</think>`
 *    block inside `content` — move it to `reasoning_content` like every
 *    other reasoning model
 */
function normalizeCompletionJson(json: unknown, modelId: string, requestId: string, provider: string): void {
  const obj = json as { id?: string; model?: string; choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }> };
  if (!obj || typeof obj !== "object") return;
  obj.id = `gen-${requestId}`;
  obj.model = modelId;
  if (provider === "gonka") {
    for (const choice of obj.choices ?? []) {
      const msg = choice?.message as (typeof choice)["message"] & { reasoning?: string | null };
      if (!msg) continue;
      // vLLM sometimes surfaces reasoning in a `reasoning` field — mirror it
      // to the OpenAI-style name our clients read.
      if (msg.reasoning != null && msg.reasoning_content == null) {
        msg.reasoning_content = msg.reasoning;
      }
      if (typeof msg.content !== "string") continue;
      const m = msg.content.match(/^\s*<think>([\s\S]*?)(?:<\/think>\s*|$)/);
      if (m) {
        msg.reasoning_content = ((msg.reasoning_content ?? "") + m[1]).trim() || null;
        msg.content = msg.content.slice(m[0].length).replace(/^\s+/, "");
      }
    }
  }
}

async function handleNonStreamingResponse(
  json: unknown,
  modelId: string,
  inputTokens: number,
  discountPercent: number,
  userId: string,
  apiKeyId: string,
  provider: string,
  estimatedCostCents: string,
  requestId: string,
  requestStartTime: number,
  span: Span,
): Promise<{ response: Response; provider: string; inputTokens: number; outputTokens: number }> {
  const actualInput = (json as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? inputTokens;
  const actualOutput = (json as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? 0;
  span.setAttribute(LLM_ATTRS.TOKENS_INPUT, actualInput);
  span.setAttribute(LLM_ATTRS.TOKENS_OUTPUT, actualOutput);
  span.setAttribute(LLM_ATTRS.TOKENS_TOTAL, actualInput + actualOutput);
  const latencyMs = Date.now() - requestStartTime;
  span.setAttribute("llm.request_duration_ms", latencyMs);
  const actualCost = await calculateActualCost(modelId, actualInput, actualOutput, discountPercent);
  await recordUsage({
    requestId, userId, apiKeyId, modelId, provider,
    inputTokens: actualInput, outputTokens: actualOutput,
    costCents: actualCost.costCents, markupCents: actualCost.markupCents, totalCents: actualCost.totalCents,
    latencyMs, status: "completed",
  });
  // Sub-cent precision: cost strings carry decimals — parseInt floored them.
  const refund = Math.round((parseFloat(estimatedCostCents) - parseFloat(actualCost.totalCents)) * 100) / 100;
  if (refund > 0) await refundCreditsWithRetry(userId, String(refund));
  normalizeCompletionJson(json, modelId, requestId, provider);
  // Expose OpenRouter-style usage.cost on the body too — agents that never
  // read headers still see what they were billed.
  const usage = (json as { usage?: Record<string, unknown> }).usage;
  if (usage) usage.cost = parseFloat(actualCost.totalCents) / 100;
  // Surface the billed cost so the route can track per-key spend and emit
  // the x-oma-response-cost header — it previously read a json.usage field
  // that never existed, leaving daily spend limits permanently untripped.
  const response = Response.json(json, {
    headers: {
      "x-provider": provider,
      "x-oma-cost-cents": actualCost.totalCents,
      "x-request-id": requestId,
    },
  });
  span.setStatus({ code: SpanStatusCode.OK });
  return { response, provider, inputTokens: actualInput, outputTokens: actualOutput };
}

/** Output-token ceiling for flat-rate x402 requests — a single prepaid
 *  price can't cover unbounded generation. */
const X402_MAX_OUTPUT_TOKENS = 4096;

export async function handleChatCompletion(
  userId: string,
  apiKeyId: string,
  body: { model: string; messages?: import("./types.js").ChatMessage[]; stream?: boolean; [key: string]: unknown },
  signal?: AbortSignal,
  opts?: { prepaidUsd?: number; keyHash?: string },
): Promise<{ response: Response; provider: string; inputTokens?: number; outputTokens?: number }> {
  const requestId = crypto.randomUUID();
  const requestStartTime = Date.now();
  validateRequest(body);

  // Always request the final usage chunk from upstream on streams. Without
  // it, streaming billing falls back to the chars/4 heuristic — the primary
  // revenue path running on an estimate. Harmless if the client also set it.
  if (body.stream) {
    (body as Record<string, unknown>).stream_options = {
      ...((body as { stream_options?: Record<string, unknown> }).stream_options ?? {}),
      include_usage: true,
    };
  }

  return trace.getTracer("oma-server").startActiveSpan("llm.inference.handleChatCompletion", { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      span.setAttribute("user.id", userId);
      span.setAttribute(LLM_ATTRS.REQUEST_ID, requestId);
      span.setAttribute(LLM_ATTRS.MODEL, body.model);
      span.setAttribute(LLM_ATTRS.STREAMING, body.stream ?? false);
      span.setAttribute(LLM_ATTRS.API_KEY_ID, apiKeyId);
      span.setAttribute(LLM_ATTRS.USER_ID, userId);

      const modelId = body.model;
      const model = await getModel(modelId);

      // x402 flat-rate prepaid path: the payment was already settled
      // on-chain by paymentMiddleware, so no credits, no preflight
      // deduction, no refunds. userId is a synthetic guest — it must not
      // reach any balance/discount query (those key on real accounts).
      if (opts?.prepaidUsd !== undefined) {
        span.setAttribute("llm.x402_prepaid", true);
        const pricing = await getModelPricing(modelId);
        const requestedMax =
          typeof body.max_tokens === "number" && body.max_tokens > 0
            ? body.max_tokens
            : X402_MAX_OUTPUT_TOKENS;
        const maxOut = Math.min(requestedMax, X402_MAX_OUTPUT_TOKENS);
        const prepaidBody = { ...body, max_tokens: maxOut };
        const inputTokens = body.messages ? countMessageTokens(body.messages) : 0;
        const estimatedCostUsd =
          ((inputTokens * pricing.inputPer1k) / 1000 +
            (maxOut * pricing.outputPer1k) / 1000) *
          (1 + pricing.markup / 100);
        if (estimatedCostUsd > opts.prepaidUsd) {
          throw Object.assign(
            new Error(
              `Request exceeds the flat x402 price ($${opts.prepaidUsd.toFixed(2)}): worst-case cost ~$${estimatedCostUsd.toFixed(4)}. Lower max_tokens, shorten the prompt, or pick a cheaper model.`,
            ),
            { status: 402, type: "payment_error" },
          );
        }
        const candidates = await getCandidateProviders(modelId, model);
        const providersToTry: Provider[] = candidates
          ? [candidates.primary, ...candidates.alternates]
          : [];
        if (providersToTry.length === 0) {
          throw Object.assign(new Error("No inference providers available for this model"), { status: 503 });
        }
        let lastError: unknown = null;
        for (const provider of providersToTry) {
          const providerModelId = getModelIdForProvider(model, provider, modelId);
          if (!providerModelId) continue;
          try {
            const resp = await callProvider(provider, providerModelId, prepaidBody, undefined, signal);
            if (resp.status >= 500) {
              throw Object.assign(new Error(`Provider ${provider} returned ${resp.status}`), { status: resp.status });
            }
            span.setAttribute(LLM_ATTRS.PROVIDER, provider);
            span.setStatus({ code: SpanStatusCode.OK });
            const prepaidCents = Math.round(opts.prepaidUsd * 100);
            if (prepaidBody.stream) {
              if (!resp.body) {
                throw Object.assign(new Error("No response body for streaming"), { status: 502 });
              }
              // Audit 2026-07-26: x402 traffic was completely unmetered —
              // wrap in the tracking stream (prepaid mode) so tokens/COGS
              // land in usage_records with the flat price as revenue.
              const trackingStream = createTrackingStream(
                resp.body as ReadableStream<Uint8Array>,
                model, modelId, inputTokens, 0, userId, apiKeyId, provider, "0", pricing, requestId,
                undefined,
                { billingMode: "prepaid", prepaidCents },
              );
              const response = new Response(trackingStream as ReadableStream<Uint8Array>, {
                status: resp.status,
                headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "x-provider": provider, "X-Accel-Buffering": "no", "x-request-id": requestId },
              });
              return { response, provider, inputTokens };
            }
            const json = await resp.json();
            const actualInput = (json as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? inputTokens;
            const actualOutput = (json as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? 0;
            const wholesale = await calculateActualCost(modelId, actualInput, actualOutput, 0);
            await recordUsage({
              requestId, userId, apiKeyId, modelId, provider,
              inputTokens: actualInput, outputTokens: actualOutput,
              costCents: wholesale.costCents, markupCents: "0",
              totalCents: prepaidCents.toFixed(2),
              latencyMs: Date.now() - requestStartTime, status: "x402",
            });
            normalizeCompletionJson(json, modelId, requestId, provider);
            const usage = (json as { usage?: Record<string, unknown> }).usage;
            if (usage) usage.cost = prepaidCents / 100;
            const response = Response.json(json, { headers: { "x-provider": provider, "x-request-id": requestId, "x-oma-cost-cents": prepaidCents.toFixed(2) } });
            return { response, provider, inputTokens };
          } catch (err) {
            lastError = err;
          }
        }
        throw lastError;
      }
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
      if (!deducted) {
        // Free tier fallback: route to Gonka/OpenBroker instead of blocking.
        // Gonka costs us ~$0.0002/M tokens — negligible enough to absorb for
        // users with zero balance. No billing/credits are touched on this path.
        // CRITICAL: only attempt this when the model actually has a Gonka
        // mapping. Models that are Venice-only (e.g. llama-3.3-70b) skip the
        // free-tier path entirely and surface a clean 402.
        const freeModelId = model ? getModelIdForProvider(model, 'gonka', modelId) : null;
        if (freeModelId) {
          logger.info({ userId, modelId, gonkaModelId: freeModelId }, "[free-tier] Routing to Gonka");
          const provider = 'gonka' as Provider;
          try {
            const freeResponse = await callProvider(provider, freeModelId, body, undefined, signal);
            // Audit 2026-07-26: the free tier was completely unmetered —
            // infinite invisible inference per zero-balance account. Record
            // every request (status "free_tier", zero revenue, real wholesale
            // costCents) so it shows up in usage, analytics, and abuse review.
            if (body.stream) {
              if (!freeResponse.body) {
                throw Object.assign(new Error("No response body for streaming"), { status: 502 });
              }
              const trackingStream = createTrackingStream(
                freeResponse.body as ReadableStream<Uint8Array>,
                model, modelId, inputTokens, 0, userId, apiKeyId, provider, "0", pricing, requestId,
                undefined,
                { billingMode: "free" },
              );
              const streamingResponse = new Response(trackingStream as ReadableStream<Uint8Array>, {
                status: freeResponse.status,
                headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "x-provider": "gonka", "X-Accel-Buffering": "no", "x-request-id": requestId },
              });
              return { response: streamingResponse, provider: 'gonka', inputTokens };
            }
            const json = await freeResponse.json();
            const freeInput = (json as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? inputTokens;
            const freeOutput = (json as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? 0;
            const wholesale = await calculateActualCost(modelId, freeInput, freeOutput, 0);
            await recordUsage({
              requestId, userId, apiKeyId, modelId, provider,
              inputTokens: freeInput, outputTokens: freeOutput,
              costCents: wholesale.costCents, markupCents: "0", totalCents: "0",
              latencyMs: Date.now() - requestStartTime, status: "free_tier",
            });
            normalizeCompletionJson(json, modelId, requestId, provider);
            const usage = (json as { usage?: Record<string, unknown> }).usage;
            if (usage) usage.cost = 0;
            const nonStreamResponse = Response.json(json, { headers: { "x-provider": "gonka", "x-request-id": requestId } });
            return { response: nonStreamResponse, provider: 'gonka', inputTokens };
          } catch (err) {
            // Free-tier Gonka call failed (model not on Gonka, network, 402
            // from upstream). Fall through to the user-facing 402 instead of
            // bubbling a 500 — the user can't fix the upstream, only deposit.
            logger.warn({ err, userId, modelId, gonkaModelId: freeModelId }, "[free-tier] Gonka fallback failed, returning 402");
          }
        }
        throw Object.assign(
          new Error(
            `Insufficient credits. Deposit USDC at /deposit or pick a free-tier model with a Gonka mapping (MiniMax-M2.7, MiniMax-M3, MiniMax-M3-preview, etc.).`,
          ),
          { status: 402, type: "insufficient_credits", code: "insufficient_credits" },
        );
      }

      // Find the ordered list of candidate providers for this model.
      const candidates = await getCandidateProviders(modelId, model);
      const providersToTry: Provider[] = candidates
        ? [candidates.primary, ...candidates.alternates]
        : [];
      if (providersToTry.length === 0) {
        throw Object.assign(new Error("No inference providers available for this model"), { status: 503 });
      }

      let lastError: unknown = null;
      for (let i = 0; i < providersToTry.length; i++) {
        const provider = providersToTry[i];
        const providerModelId = getModelIdForProvider(model, provider, modelId);
        if (!providerModelId) continue;
        // SECURITY: On failover (i > 0), skip the refund in callProviderWithRefund.
        // The preflight deduction is still held; refunding on each failure would
        // cause double-refund: p1 fails → full refund → p2 succeeds → partial
        // refund → user balance higher than before the request. Instead, we keep
        // the reservation and only settle the delta after the final provider.
        const isFailover = i > 0;
        try {
          const resp = await callProviderWithRefund(provider, providerModelId, body, userId, estimatedCostCents, signal, isFailover);

          span.setAttribute(LLM_ATTRS.PROVIDER, provider);
          span.setAttribute("llm.provider_model_id", providerModelId);

          // Skip billing on 5xx upstream failures and fail over. Do NOT
          // refund here: the reservation must stay held across the failover
          // loop. A mid-loop refund followed by a later provider's success
          // (which settles the delta) or the all-failed full refund below
          // would credit the user twice. Cancel the body so the socket is
          // released instead of held until GC.
          if (resp.status >= 500) {
            resp.body?.cancel().catch(() => {});
            throw Object.assign(new Error(`Provider ${provider} returned ${resp.status}`), { status: resp.status });
          }

          if (body.stream) {
            if (!resp.body) {
              throw Object.assign(new Error("No response body for streaming"), { status: 502 });
            }
            const trackingStream = createTrackingStream(
              resp.body as ReadableStream<Uint8Array>,
              model, modelId, inputTokens, discountPercent, userId, apiKeyId, provider, estimatedCostCents, pricing, requestId,
              async (timeToFirstToken, totalTokens, durationMs) => {
                span.setAttribute(LLM_ATTRS.TIME_TO_FIRST_TOKEN_MS, timeToFirstToken);
                if (totalTokens > 0 && durationMs > 0)
                  span.setAttribute(LLM_ATTRS.TOKEN_THROUGHPUT_PER_SEC, totalTokens / (durationMs / 1000));
                span.setAttribute("llm.streaming_duration_ms", durationMs);
              },
              {
                billingMode: "credits",
                // Streaming previously bypassed SPEND_LIMIT_DAILY_CENTS
                // entirely — the daily cap only ran on non-stream responses.
                onSettled: (totalCents) => trackApiKeySpend(opts?.keyHash, Math.ceil(totalCents)),
              }
            );
            const response = new Response(trackingStream as ReadableStream<Uint8Array>, {
              status: resp.status,
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "x-provider": provider, "X-Accel-Buffering": "no", "x-request-id": requestId },
            });
            span.setAttribute("llm.response_start_time_ms", Date.now() - requestStartTime);
            span.setStatus({ code: SpanStatusCode.OK });
            return { response, provider, inputTokens };
          }

          const json = await resp.json();
          return handleNonStreamingResponse(json, modelId, inputTokens, discountPercent, userId, apiKeyId, provider, estimatedCostCents, requestId, requestStartTime, span);
        } catch (err) {
          lastError = err;
          // Try the next candidate provider (failover). Skip the trailing
          // entry — there's nothing after it.
          if (i < providersToTry.length - 1) {
            const nextProvider = providersToTry[i + 1];
            try {
              recordFailover({
                modelId,
                fromProvider: provider,
                toProvider: nextProvider,
                latencyMs: Date.now() - requestStartTime,
              });
            } catch {
              // stats errors are non-fatal
            }
          }
        }
      }

       // All providers failed. Refund the full preflight deduction since
       // no provider succeeded. This is the only safe refund point for the
       // full estimated cost.
       await refundCreditsWithRetry(userId, estimatedCostCents);
       throw lastError ?? Object.assign(new Error("All providers failed"), { status: 502 });
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
