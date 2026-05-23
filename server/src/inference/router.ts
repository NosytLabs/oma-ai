import crypto from "crypto";
import { getModel, estimateTokens } from "./models.js";
import * as venice from "./venice.js";
import * as antseed from "./antseed.js";
import * as litellm from "./litellm.js";
import * as openrouter from "./openrouter.js";
import * as together from "./together.js";
import * as deepinfra from "./deepinfra.js";
import { isProviderAvailable, reportProviderResult } from "./provider-health.js";
import { preflightDeduction, refundCredits, getStakingDiscount } from "../credits/balance.js";
import { getModelPricing, calculateActualCost, getEstimatedOutputTokens } from "./services/billing-service.js";
import { recordUsage } from "./services/usage-service.js";
import type { ModelDef } from "./models.js";
import type { ModelPricing, ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

export { getModelPricing };

const PROPRIETARY_PREFIXES = ["anthropic/", "openai/", "gpt-", "claude-", "gemini-", "grok-", "o3", "venice/", "stabilityai/", "openrouter/"];
const OPENSOURCE_PREFIXES = ["llama-", "mixtral-", "qwen-", "deepseek-", "mistral/", "gemma-", "phi-", "solar-", "command-r", "yi-", "starcoder", "codestral", "wizardlm", "dbrx", "nous-", "dolphin-", "toppy-", "mythomax", "openchat", "zephyr", "minimax", "antseed/"];

function inferProviderFromModel(model: string): "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra" {
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

export async function selectProvider(model: string): Promise<{
  provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra";
  providerModelId: string;
}> {
  const modelDef = getModel(model);
  const preferred = modelDef ? modelDef.primaryProvider : inferProviderFromModel(model);
  const providerModelId = modelDef
    ? (preferred === "venice" ? (modelDef.veniceId ?? modelDef.id) : preferred === "antseed" ? (modelDef.antseedId ?? modelDef.id) : preferred === "litellm" ? (modelDef.litellmId ?? modelDef.id) : preferred === "openrouter" ? (modelDef.openrouterId ?? modelDef.id) : preferred === "together" ? (modelDef.togetherId ?? modelDef.id) : (modelDef.deepinfraId ?? modelDef.id))
    : model.startsWith("litellm/") ? model.replace("litellm/", "") : model;

  if (await isProviderAvailable(preferred)) {
    console.log(`[router] model=${model} provider=${preferred} source=primary`);
    return { provider: preferred, providerModelId };
  }

  const providers: Array<"venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra"> = ["venice", "antseed", "litellm", "openrouter", "together", "deepinfra"];
  const fallbacks = providers.filter(p => p !== preferred);

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

export async function routeInference(modelId: string): Promise<{ provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra"; providerModelId: string }> {
  return selectProvider(modelId);
}

async function callProvider(provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra", providerModelId: string, body: Record<string, unknown>): Promise<Response> {
  const start = Date.now();
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
    await reportProviderResult(provider, true, Date.now() - start);
    return resp;
  } catch (err) {
    await reportProviderResult(provider, false, Date.now() - start);
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

export async function handleChatCompletion(userId: string, apiKeyId: string, body: { model: string; messages?: ChatMessage[]; stream?: boolean; [key: string]: unknown }): Promise<{ response: Response; provider: string; inputTokens?: number; outputTokens?: number }> {
  const tracer = trace.getTracer("oma-server");
  const requestId = crypto.randomUUID();
  
  return tracer.startActiveSpan("llm.inference.handleChatCompletion", { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      span.setAttribute("user.id", userId);
      span.setAttribute("request.id", requestId);
      span.setAttribute("llm.model", body.model);
      span.setAttribute("llm.stream", body.stream ?? false);

      const modelId = body.model;
      const model = getModel(modelId);

      const discountPercent = await getStakingDiscount(userId);
      const inputTokens = body.messages ? countMessageTokens(body.messages) : 0;
      span.setAttribute("llm.tokens.input", inputTokens);

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
      span.setAttribute("llm.provider", provider);

      let resp: Response;
      try {
        resp = await callProvider(provider, providerModelId, body);
      } catch (err) {
        await refundCredits(userId, estimatedCostCents);
        throw err;
      }

      if (body.stream) {
        if (!resp.body) {
          await refundCredits(userId, estimatedCostCents);
          throw Object.assign(new Error("No response body for streaming"), { status: 502 });
        }

        const modelForTracking = model;
        const trackingStream = createTrackingStream(
          resp.body as ReadableStream<Uint8Array>,
          modelForTracking, modelId, inputTokens, discountPercent, userId, apiKeyId, provider, estimatedCostCents, pricing, requestId
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

        span.setStatus({ code: SpanStatusCode.OK });
        return { response, provider, inputTokens };
      }

      const json = await resp.json();
      const actualInput = json.usage?.prompt_tokens ?? inputTokens;
      const actualOutput = json.usage?.completion_tokens ?? 0;
      const outputTokens = actualOutput;
      span.setAttribute("llm.tokens.output", actualOutput);

      const actualCost = calculateActualCost(modelId, actualInput, actualOutput, discountPercent);

      await recordUsage({
        requestId, userId, apiKeyId, modelId, provider,
        inputTokens: actualInput, outputTokens: actualOutput,
        costCents: actualCost.costCents, markupCents: actualCost.markupCents, totalCents: actualCost.totalCents,
      });

      const refund = parseInt(estimatedCostCents, 10) - parseInt(actualCost.totalCents, 10);
      if (refund > 0) await refundCredits(userId, String(refund));

      const response = Response.json(json, { headers: { "x-provider": provider } });
      span.setStatus({ code: SpanStatusCode.OK });
      return { response, provider, inputTokens: actualInput, outputTokens };
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : "Unknown error",
      });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      span.end();
    }
  });
}

function createTrackingStream(
  upstream: ReadableStream<Uint8Array>,
  model: ModelDef | null,
  modelId: string,
  inputTokens: number,
  discountPercent: number,
  userId: string,
  apiKeyId: string,
  provider: string,
  estimatedTotalCents: string,
  pricing: ModelPricing,
  requestId: string,
): ReadableStream<Uint8Array> {
  let outputTokens = 0;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

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
                const cost = calculateActualCost(modelId, inputTokens, outputTokens, discountPercent);
                await recordUsage({
                  requestId, userId, apiKeyId, modelId, provider,
                  inputTokens, outputTokens,
                  costCents: cost.costCents, markupCents: cost.markupCents, totalCents: cost.totalCents,
                });
                const refund = parseInt(estimatedTotalCents, 10) - parseInt(cost.totalCents, 10);
                if (refund > 0) await refundCredits(userId, String(refund));
              } else {
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text ?? "";
                  if (delta) outputTokens += estimateTokens(delta);
                  if (parsed.usage?.completion_tokens) outputTokens = parsed.usage.completion_tokens;
                } catch {
                  // ignore parse errors in stream
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
    cancel() {
      refundCredits(userId, estimatedTotalCents).catch(() => {});
      upstream.cancel();
    },
  });
}