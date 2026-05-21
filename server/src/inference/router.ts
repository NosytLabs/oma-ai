import { getModel, calculateCost, estimateTokens } from "./models.js";
import * as venice from "./venice.js";
import * as antseed from "./antseed.js";
import * as litellm from "./litellm.js";
import { isProviderAvailable, reportProviderResult } from "./circuit-breaker.js";
import { preflightDeduction, refundCredits, getStakingDiscount } from "../credits/balance.js";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";
import type { ModelDef } from "./models.js";
import type { ModelPricing, ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

const PROPRIETARY_PREFIXES = ["anthropic/", "openai/", "gpt-", "claude-", "gemini-", "grok-", "o3", "venice/", "stabilityai/"];
const OPENSOURCE_PREFIXES = ["llama-", "mixtral-", "qwen-", "deepseek-", "mistral/", "gemma-", "phi-", "solar-", "command-r", "yi-", "starcoder", "codestral", "wizardlm", "dbrx", "nous-", "dolphin-", "toppy-", "mythomax", "openchat", "zephyr", "minimax", "antseed/"];

function inferProviderFromModel(model: string): "venice" | "antseed" | "litellm" {
  if (model.startsWith("litellm/")) return "litellm";
  for (const prefix of PROPRIETARY_PREFIXES) {
    if (model.startsWith(prefix)) return "venice";
  }
  for (const prefix of OPENSOURCE_PREFIXES) {
    if (model.startsWith(prefix)) return "antseed";
  }
  return "antseed";
}

export async function selectProvider(model: string): Promise<{
  provider: "venice" | "antseed" | "litellm";
  providerModelId: string;
}> {
  const modelDef = getModel(model);
  const preferred = modelDef ? modelDef.primaryProvider : inferProviderFromModel(model);
  const providerModelId = modelDef
    ? (preferred === "venice" ? (modelDef.veniceId ?? modelDef.id) : preferred === "antseed" ? (modelDef.antseedId ?? modelDef.id) : (modelDef.litellmId ?? modelDef.id))
    : model.startsWith("litellm/") ? model.replace("litellm/", "") : model;

  if (await isProviderAvailable(preferred)) {
    console.log(`[router] model=${model} provider=${preferred} source=primary`);
    return { provider: preferred, providerModelId };
  }

  // Try fallbacks
  const providers: Array<"venice" | "antseed" | "litellm"> = ["venice", "antseed", "litellm"];
  const fallbacks = providers.filter(p => p !== preferred);

  for (const fallback of fallbacks) {
    const canFallback = !modelDef || modelDef.provider === "both" || modelDef.provider === "all" || modelDef.provider === fallback;
    if (canFallback && await isProviderAvailable(fallback)) {
      const fallbackModelId = modelDef
        ? (fallback === "venice" ? (modelDef.veniceId ?? modelDef.id) : fallback === "antseed" ? (modelDef.antseedId ?? modelDef.id) : (modelDef.litellmId ?? modelDef.id))
        : model.startsWith("litellm/") ? model.replace("litellm/", "") : model;
      console.log(`[router] model=${model} provider=${fallback} source=fallback`);
      return { provider: fallback, providerModelId: fallbackModelId };
    }
  }

  console.error(`[router] model=${model} no available provider`);
  throw Object.assign(new Error("All inference providers are currently unavailable. Please try again later."), { status: 503 });
}

export function getModelPricing(model: string): ModelPricing {
  const modelDef = getModel(model);
  if (modelDef) {
    return {
      inputPer1k: modelDef.inputPricePer1M / 1000,
      outputPer1k: modelDef.outputPricePer1M / 1000,
      provider: modelDef.primaryProvider,
      markup: modelDef.markupPercent,
    };
  }

  const inferred = inferProviderFromModel(model);
  const isProprietary = PROPRIETARY_PREFIXES.some(p => model.startsWith(p)) || model.startsWith("litellm/");
  const markup = isProprietary ? 5 : 150;

  if (inferred === "antseed") {
    return { inputPer1k: 0.0005, outputPer1k: 0.001, provider: "antseed", markup };
  } else if (inferred === "litellm") {
    return { inputPer1k: 0.0015, outputPer1k: 0.002, provider: "litellm", markup };
  }
  return { inputPer1k: 0.001, outputPer1k: 0.002, provider: "venice", markup };
}

export async function routeInference(modelId: string): Promise<{ provider: "venice" | "antseed" | "litellm"; providerModelId: string }> {
  return selectProvider(modelId);
}

async function callProvider(provider: "venice" | "antseed" | "litellm", providerModelId: string, body: Record<string, unknown>): Promise<Response> {
  const start = Date.now();
  try {
    const reqBody = { ...body, model: providerModelId };
    let resp: Response;
    if (provider === "venice") {
      resp = await venice.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
    } else if (provider === "antseed") {
      resp = await antseed.chatCompletion(reqBody as { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown });
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

async function recordUsage(params: {
  userId: string;
  apiKeyId: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costCents: string;
  markupCents: string;
  totalCents: string;
}): Promise<void> {
  await db.insert(usageRecords).values({
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    model: params.modelId,
    provider: params.provider as "venice" | "antseed" | "litellm",
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costCents: params.costCents,
    markupCents: params.markupCents,
    totalCents: params.totalCents,
  });
}

export async function handleChatCompletion(userId: string, apiKeyId: string, body: { model: string; messages?: ChatMessage[]; stream?: boolean; [key: string]: unknown }): Promise<{ response: Response; provider: string; inputTokens?: number; outputTokens?: number }> {
  const tracer = trace.getTracer("oma-server");
  
  return tracer.startActiveSpan("llm.inference.handleChatCompletion", { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      span.setAttribute("user.id", userId);
      span.setAttribute("llm.model", body.model);
      span.setAttribute("llm.stream", body.stream ?? false);

      const modelId = body.model;
      const model = getModel(modelId);

      const discountPercent = await getStakingDiscount(userId);
      const inputTokens = body.messages ? countMessageTokens(body.messages) : 0;
      span.setAttribute("llm.tokens.input", inputTokens);

      const pricing = getModelPricing(modelId);
      const estimatedOutputTokens = model ? Math.floor(model.maxTokens / 4) : 1024;
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
          modelForTracking, modelId, inputTokens, discountPercent, userId, apiKeyId, provider, estimatedCostCents, pricing
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

      let actualCost: { costCents: string; markupCents: string; totalCents: string };
      if (model) {
        actualCost = calculateCost(model.id, actualInput, actualOutput, discountPercent);
      } else {
        const costUsd = ((actualInput * inputPerToken) + (actualOutput * outputPerToken)) * markupMultiplier * discountMultiplier;
        const baseUsd = (actualInput * inputPerToken) + (actualOutput * outputPerToken);
        const markupUsd = costUsd - baseUsd;
        actualCost = {
          costCents: String(Math.max(1, Math.ceil(baseUsd * 100))),
          markupCents: String(Math.ceil(markupUsd * 100)),
          totalCents: String(Math.max(1, Math.ceil(costUsd * 100))),
        };
      }

      await recordUsage({
        userId, apiKeyId, modelId, provider,
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
                let cost: { costCents: string; markupCents: string; totalCents: string };
                if (model) {
                  cost = calculateCost(model.id, inputTokens, outputTokens, discountPercent);
                } else {
                  const markupMultiplier = 1 + pricing.markup / 100;
                  const discountMultiplier = 1 - discountPercent / 100;
                  const inputPerToken = pricing.inputPer1k / 1000;
                  const outputPerToken = pricing.outputPer1k / 1000;
                  const costUsd = ((inputTokens * inputPerToken) + (outputTokens * outputPerToken)) * markupMultiplier * discountMultiplier;
                  const baseUsd = (inputTokens * inputPerToken) + (outputTokens * outputPerToken);
                  const markupUsd = costUsd - baseUsd;
                  cost = {
                    costCents: String(Math.max(1, Math.ceil(baseUsd * 100))),
                    markupCents: String(Math.ceil(markupUsd * 100)),
                    totalCents: String(Math.max(1, Math.ceil(costUsd * 100))),
                  };
                }
                await recordUsage({
                  userId, apiKeyId, modelId, provider,
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
