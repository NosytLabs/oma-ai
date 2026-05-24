import crypto from "crypto";
import { getModel, estimateTokens } from "./models.js";
import * as venice from "./venice.js";
import * as antseed from "./antseed.js";
import * as litellm from "./litellm.js";
import * as openrouter from "./openrouter.js";
import * as together from "./together.js";
import * as deepinfra from "./deepinfra.js";
import { isProviderAvailable, reportProviderResult } from "./provider-health.js";
import { isCircuitOpen, recordProviderError, recordProviderSuccess } from "./circuit-breaker.js";
import { preflightDeduction, refundCredits, getStakingDiscount } from "../credits/balance.js";
import { getModelPricing, calculateActualCost, getEstimatedOutputTokens } from "./billing-service.js";
import { recordUsage } from "./usage-service.js";
import { parseProviderWeights, parseModelWeights } from "../lib/router-utils.js";
import type { ModelDef } from "./models.js";
import type { ModelPricing, ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { config } from "../config.js";
import {
  LLM_ATTRS,
  PROVIDER_ERROR_TYPES,
  setErrorAttributes,
} from "../tracing.js";

export { getModelPricing };

export type Provider = "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra";

const ALL_PROVIDERS: Provider[] = ["venice", "antseed", "litellm", "openrouter", "together", "deepinfra"];

const PROPRIETARY_PREFIXES = ["anthropic/", "openai/", "gpt-", "claude-", "gemini-", "grok-", "o3", "venice/", "stabilityai/", "openrouter/"];
const OPENSOURCE_PREFIXES = ["llama-", "mixtral-", "qwen-", "deepseek-", "mistral/", "gemma-", "phi-", "solar-", "command-r", "yi-", "starcoder", "codestral", "wizardlm", "dbrx", "nous-", "dolphin-", "toppy-", "mythomax", "openchat", "zephyr", "minimax", "antseed/"];

const DEBUG_STREAM = config.DEBUG_STREAM;
let streamParseErrors = 0;

export function getStreamMetrics() {
  return { parseErrors: streamParseErrors };
}

function logStreamDebug(message: string, data?: Record<string, unknown>) {
  if (DEBUG_STREAM) {
    console.debug(`[router:stream] ${message}`, data ?? {});
  }
}

function inferProviderFromModel(model: string): Provider {
  if (model.startsWith("openrouter/") || model.startsWith("openai/")) return "openrouter";
  if (model.startsWith("litellm/")) return "litellm";
  if (model.startsWith("together/")) return "together";
  if (model.startsWith("deepinfra/")) return "deepinfra";
  for (const prefix of PROPRIETARY_PREFIXES) {
    if (model.startsWith(prefix)) return "venice";
  }
  for (const prefix of OPENSOURCE_PREFIXES) {
    if (model.startsWith(prefix)) return "antseed";
  }
  return "antseed";
}

export interface ModelWeightConfig {
  weights: Map<Provider, number>;
  modelId: string;
}

function selectProviderWeighted(weights: Map<Provider, number>, available: Provider[]): Provider | null {
  const activeProviders = available.filter(p => weights.get(p) && weights.get(p)! > 0);

  if (activeProviders.length === 0) return null;

  const totalWeight = activeProviders.reduce((sum, p) => sum + (weights.get(p) || 0), 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0;
  for (const provider of activeProviders) {
    cumulative += weights.get(provider) || 0;
    if (random <= cumulative) return provider;
  }

  return activeProviders[activeProviders.length - 1];
}

export async function selectProvider(model: string): Promise<{
  provider: Provider;
  providerModelId: string;
}> {
  const modelDef = getModel(model);
  const preferred = modelDef ? modelDef.primaryProvider : inferProviderFromModel(model);
  const providerModelId = modelDef
    ? (preferred === "venice" ? (modelDef.veniceId ?? modelDef.id) : preferred === "antseed" ? (modelDef.antseedId ?? modelDef.id) : preferred === "litellm" ? (modelDef.litellmId ?? modelDef.id) : preferred === "openrouter" ? (modelDef.openrouterId ?? modelDef.id) : preferred === "together" ? (modelDef.togetherId ?? modelDef.id) : (modelDef.deepinfraId ?? modelDef.id))
    : model.startsWith("litellm/") ? model.replace("litellm/", "") : model;

  const modelWeights = parseModelWeights(config.MODEL_WEIGHTS);
  const globalWeights = parseProviderWeights(config.PROVIDER_WEIGHTS);

  const canUseProvider = (p: Provider): boolean => {
    return !modelDef || modelDef.provider === "both" || modelDef.provider === "all" || modelDef.provider === p;
  };

  const getAvailableProviders = async (): Promise<Provider[]> => {
    const results = await Promise.all(ALL_PROVIDERS.map(async p => ({ provider: p, available: await isProviderAvailable(p) })));
    return results.filter(r => r.available).map(r => r.provider);
  };

  const selectFromWeights = async (weights: Map<Provider, number>): Promise<{ provider: Provider; providerModelId: string } | null> => {
    const availableProviders = await getAvailableProviders();
    const weightedSelected = selectProviderWeighted(weights, availableProviders);

    if (weightedSelected && canUseProvider(weightedSelected)) {
      const selectedModelId = modelDef
        ? (weightedSelected === "venice" ? (modelDef.veniceId ?? modelDef.id) : weightedSelected === "antseed" ? (modelDef.antseedId ?? modelDef.id) : weightedSelected === "litellm" ? (modelDef.litellmId ?? modelDef.id) : weightedSelected === "openrouter" ? (modelDef.openrouterId ?? modelDef.id) : weightedSelected === "together" ? (modelDef.togetherId ?? modelDef.id) : (modelDef.deepinfraId ?? modelDef.id))
        : model.startsWith("litellm/") ? model.replace("litellm/", "") : model;

      return { provider: weightedSelected, providerModelId: selectedModelId };
    }
    return null;
  };

  if (modelWeights.has(model)) {
    const weights = modelWeights.get(model)!;
    const result = await selectFromWeights(weights);
    if (result) {
      console.log(`[router] model=${model} provider=${result.provider} source=model_weights`);
      return result;
    }
  }

  if (globalWeights) {
    const result = await selectFromWeights(globalWeights);
    if (result) {
      console.log(`[router] model=${model} provider=${result.provider} source=global_weights`);
      return result;
    }
  }

  if (await isProviderAvailable(preferred)) {
    console.log(`[router] model=${model} provider=${preferred} source=primary`);
    return { provider: preferred, providerModelId };
  }

  const fallbacks = ALL_PROVIDERS.filter(p => p !== preferred);

  for (const fallback of fallbacks) {
    const canFallback = !modelDef || modelDef.provider === "both" || modelDef.provider === "all" || modelDef.provider === fallback;
    if (canFallback && await isProviderAvailable(fallback)) {
      const fallbackModelId = modelDef
        ? (fallback === "venice" ? (modelDef.veniceId ?? modelDef.id) : fallback === "antseed" ? (modelDef.antseedId ?? modelDef.id) : fallback === "litellm" ? (modelDef.litellmId ?? modelDef.id) : fallback === "openrouter" ? (modelDef.openrouterId ?? modelDef.id) : fallback === "together" ? (modelDef.togetherId ?? modelDef.id) : (modelDef.deepinfraId ?? modelDef.id))
        : model.startsWith("litellm/") ? model.replace("litellm/", "") : model;
      console.log(`[router] model=${model} provider=${fallback} source=fallback`);
      return { provider: fallback, providerModelId: fallbackModelId };
    }
  }

  console.error(`[router] model=${model} no available provider`);
  throw Object.assign(new Error("All inference providers are currently unavailable. Please try again later."), { status: 503 });
}

export async function routeInference(modelId: string): Promise<{ provider: Provider; providerModelId: string }> {
  return selectProvider(modelId);
}

async function callProvider(provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra", providerModelId: string, body: Record<string, unknown>): Promise<Response> {
  const start = Date.now();
  const isStreaming = body.stream === true;
  const controller = new AbortController();
  const timeoutMs = isStreaming ? 120_000 : 60_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (await isCircuitOpen(provider, providerModelId)) {
    clearTimeout(timeout);
    throw Object.assign(new Error(`Circuit breaker open for ${provider}:${providerModelId}`), { status: 503, provider, type: PROVIDER_ERROR_TYPES.CIRCUIT_BREAKER });
  }

  try {
    const reqBody = { ...body, model: providerModelId };
    let resp: Response;
    if (provider === "venice") {
      resp = await venice.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
    } else if (provider === "antseed") {
      resp = await antseed.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
    } else if (provider === "openrouter") {
      resp = await openrouter.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
    } else if (provider === "together") {
      resp = await together.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
    } else if (provider === "deepinfra") {
      resp = await deepinfra.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
    } else {
      resp = await litellm.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
    }
    clearTimeout(timeout);
    await reportProviderResult(provider, true, Date.now() - start);
    await recordProviderSuccess(provider, providerModelId);
    return resp;
  } catch (err) {
    clearTimeout(timeout);
    await reportProviderResult(provider, false, Date.now() - start);
    await recordProviderError(provider, providerModelId);
    throw err;
  }
}

function countMessageTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && typeof part.text === "string") total += estimateTokens(part.text);
      }
    }
  }
  return total;
}

const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024;
const MAX_MESSAGE_CONTENT_SIZE = 100_000;

async function refundCreditsWithRetry(userId: string, amount: string, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await refundCredits(userId, amount);
      return;
    } catch (err) {
      if (attempt === retries) {
        console.error(`[router] Refund credits failed after ${retries} attempts:`, err);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
}

export async function handleChatCompletion(userId: string, apiKeyId: string, body: { model: string; messages?: ChatMessage[]; stream?: boolean; [key: string]: unknown }): Promise<{ response: Response; provider: string; inputTokens?: number; outputTokens?: number }> {
  const tracer = trace.getTracer("oma-server");
  const requestId = crypto.randomUUID();
  const requestStartTime = Date.now();

  if (JSON.stringify(body).length > MAX_REQUEST_BODY_SIZE) {
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

  return tracer.startActiveSpan("llm.inference.handleChatCompletion", { kind: SpanKind.INTERNAL }, async (span) => {

    try {
      let _ttftMs: number | undefined;
      span.setAttribute("user.id", userId);
      span.setAttribute(LLM_ATTRS.REQUEST_ID, requestId);
      span.setAttribute(LLM_ATTRS.MODEL, body.model);
      span.setAttribute(LLM_ATTRS.STREAMING, body.stream ?? false);
      span.setAttribute(LLM_ATTRS.API_KEY_ID, apiKeyId);
      span.setAttribute(LLM_ATTRS.USER_ID, userId);

      const modelId = body.model;
      const model = getModel(modelId);

      const discountPercent = await getStakingDiscount(userId);
      const inputTokens = body.messages ? countMessageTokens(body.messages) : 0;
      span.setAttribute(LLM_ATTRS.TOKENS_INPUT, inputTokens);

      const pricing = getModelPricing(modelId);
      const estimatedOutputTokens = getEstimatedOutputTokens(modelId);
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

      let resp: Response;
      try {
        resp = await callProvider(provider, providerModelId, body);
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

      if (body.stream) {
        if (!resp.body) {
          await refundCreditsWithRetry(userId, estimatedCostCents);
          throw Object.assign(new Error("No response body for streaming"), { status: 502 });
        }

        const modelForTracking = model;
        const trackingStream = createTrackingStream(
          resp.body as ReadableStream<Uint8Array>,
          modelForTracking, modelId, inputTokens, discountPercent, userId, apiKeyId, provider, estimatedCostCents, pricing, requestId,
          async (timeToFirstToken, totalTokens, durationMs) => {
            _ttftMs = timeToFirstToken;
            span.setAttribute(LLM_ATTRS.TIME_TO_FIRST_TOKEN_MS, timeToFirstToken);
            if (totalTokens > 0 && durationMs > 0) {
              span.setAttribute(LLM_ATTRS.TOKEN_THROUGHPUT_PER_SEC, totalTokens / (durationMs / 1000));
            }
            span.setAttribute("llm.streaming_duration_ms", durationMs);
          }
        );

        const response = new Response(trackingStream as ReadableStream<Uint8Array>, {
          status: resp.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "x-provider": provider,
          },
        });

        span.setAttribute("llm.response_start_time_ms", Date.now() - requestStartTime);
        span.setStatus({ code: SpanStatusCode.OK });
        return { response, provider, inputTokens };
      }

      const json = await resp.json();
      const actualInput = json.usage?.prompt_tokens ?? inputTokens;
      const actualOutput = json.usage?.completion_tokens ?? 0;
      const outputTokens = actualOutput;
      span.setAttribute(LLM_ATTRS.TOKENS_INPUT, actualInput);
      span.setAttribute(LLM_ATTRS.TOKENS_OUTPUT, actualOutput);
      span.setAttribute(LLM_ATTRS.TOKENS_TOTAL, actualInput + actualOutput);
      span.setAttribute("llm.request_duration_ms", Date.now() - requestStartTime);

      const actualCost = calculateActualCost(modelId, actualInput, actualOutput, discountPercent);

        await recordUsage({
          requestId, userId, apiKeyId, modelId, provider,
          inputTokens: actualInput, outputTokens: actualOutput,
          costCents: actualCost.costCents, markupCents: actualCost.markupCents, totalCents: actualCost.totalCents,
        });

        const refund = parseInt(estimatedCostCents, 10) - parseInt(actualCost.totalCents, 10);
        if (refund > 0) await refundCreditsWithRetry(userId, String(refund));

        const response = Response.json(json, { headers: { "x-provider": provider } });
        span.setStatus({ code: SpanStatusCode.OK });
        return { response, provider, inputTokens: actualInput, outputTokens };
    } catch (err) {
      const errorType = (err as { status?: number }).status
        ? (err as { type?: string }).type ?? PROVIDER_ERROR_TYPES.UNKNOWN_ERROR
        : PROVIDER_ERROR_TYPES.CONNECTION_ERROR;
      setErrorAttributes(errorType, "Request processing failed", (err as { provider?: string }).provider);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: "Request processing failed",
      });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      const publicError = new Error("Inference request failed");
      throw Object.assign(publicError, { status: (err as { status?: number }).status ?? 500 });
    } finally {
      span.end();
    }
  });
}

function createTrackingStream(
  upstream: ReadableStream<Uint8Array>,
  model: ModelDef | null,
  modelId: string,
  _inputTokens: number,
  discountPercent: number,
  userId: string,
  apiKeyId: string,
  provider: string,
  estimatedTotalCents: string,
  pricing: ModelPricing,
  requestId: string,
  onStreamingMetrics?: (ttftMs: number, totalTokens: number, durationMs: number) => Promise<void>
): ReadableStream<Uint8Array> {
  let outputTokens = 0;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let accumulatedContent = "";
  let usageDataReceived = false;
  let firstTokenReceived = false;
  let firstTokenTime: number | undefined;
  const streamStartTime = Date.now();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                const streamDuration = Date.now() - streamStartTime;
                const finalOutputTokens = usageDataReceived
                  ? outputTokens
                  : estimateTokens(accumulatedContent);

                if (firstTokenTime !== undefined && onStreamingMetrics) {
                  onStreamingMetrics(firstTokenTime, finalOutputTokens, streamDuration);
                }

                const cost = calculateActualCost(modelId, _inputTokens, finalOutputTokens, discountPercent);
                await recordUsage({
                  requestId, userId, apiKeyId, modelId, provider,
                  inputTokens: _inputTokens, outputTokens: finalOutputTokens,
                  costCents: cost.costCents, markupCents: cost.markupCents, totalCents: cost.totalCents,
                });
                const refund = parseInt(estimatedTotalCents, 10) - parseInt(cost.totalCents, 10);
                if (refund > 0) await refundCreditsWithRetry(userId, String(refund));
              } else {
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text ?? "";
                  if (delta && !firstTokenReceived) {
                    firstTokenReceived = true;
                    firstTokenTime = Date.now() - streamStartTime;
                  }
                  if (delta) accumulatedContent += delta;
                  if (parsed.usage?.completion_tokens) {
                    outputTokens = parsed.usage.completion_tokens;
                    usageDataReceived = true;
                  }
                } catch (err) {
                  streamParseErrors++;
                  const parseError = err instanceof Error ? err.message : String(err);
                  logStreamDebug("SSE parse error", {
                    requestId,
                    error: parseError,
                    dataLength: data.length,
                    dataPreview: data.length > 100 ? data.slice(0, 100) + "..." : data,
                    totalErrors: streamParseErrors,
                  });
                  // Don't re-throw; continue processing remaining lines
                }
              }
            }
            controller.enqueue(encoder.encode(line + "\n"));
          }
        }
      } catch (err) {
        try { await reader.cancel(); } catch {
          // ignore cancel errors
        }
        controller.error(err);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
    async cancel() {
      try {
        await refundCreditsWithRetry(userId, estimatedTotalCents);
      } catch (err) {
        console.error('[router] Refund failed during cancel:', err);
      }
      await upstream.cancel();
    },
  });
}