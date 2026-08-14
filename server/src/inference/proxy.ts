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
import { getModelPricing } from "./billing-service.js";
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

import { ProviderError, resolveProvider } from "./provider-route.js";
import { estimateTokens, flattenMessageContent } from "./token-utils.js";

export interface CallProviderOptions {
  modelId: string;
  messages: Array<{ role: string; content: string | unknown[]; name?: string }>;
  stream: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  userId: string;
  requestId: string;
  /** Optional override: force a specific provider for testing. */
  providerOverride?: "venice" | "oma-ai";
  /** Skip credit deduction for free website chat */
  skipBilling?: boolean;
  /**
   * OpenRouter-style client fallback list (tried after the primary model,
   * before the server FALLBACK_MAP peers). Invalid/unknown ids are ignored.
   */
  clientFallbacks?: string[];
}

/**
 * Core provider call — handles upstream request, streaming, billing, and usage recording.
 * Returns the raw upstream Response object for the caller to translate/stream as needed.
 */
async function callProvider(opts: CallProviderOptions): Promise<Response> {
  const { modelId, messages, stream, max_tokens, temperature, top_p, tools, tool_choice, providerOverride } = opts;

  const modelDef = getModelById(modelId);
  if (!modelDef) {
    throw new ProviderError(`Model ${modelId} not found`, 404);
  }

  const _pricing = getModelPricing(modelId);

  // Resolve upstream provider (Venice vs OMA-AI/OpenBroker).
  const provider = providerOverride ?? modelDef.provider;
  const route = resolveProvider(provider, modelDef);

  const upstreamUrl = `${route.baseUrl}/chat/completions`;
  const upstreamModel = route.upstreamModel(
    modelDef.veniceId ?? modelDef.id,
    modelDef.omaAiId,
  );

  const promptText = messages.map((m) => flattenMessageContent(m.content)).join("\n");
  const _promptTokens = estimateTokens(promptText);

  const upstreamBody = route.extraBody({
    model: upstreamModel,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
    })),
    stream,
    ...(max_tokens ? { max_tokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(top_p !== undefined ? { top_p } : {}),
    ...(tools ? { tools } : {}),
    ...(tool_choice ? { tool_choice } : {}),
  });

  // Hard timeout so a hung upstream cannot pin a worker forever.
  // Abort → 408 so the router retries / failovers; plain network fail → 502.
  const upstreamController = new AbortController();
  const timeoutMs = stream ? 120_000 : 60_000;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    upstreamController.abort();
  }, timeoutMs);
  let fetchError: unknown = null;
  const upstreamResp = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${route.apiKey}`,
    },
    body: JSON.stringify(upstreamBody),
    signal: upstreamController.signal,
  }).catch((err) => {
    fetchError = err;
    logger.error({ err, provider: route.providerLabel, timedOut }, "[proxy] upstream fetch failed");
    return null;
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  if (!upstreamResp) {
    if (
      timedOut ||
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
    const errBody = await upstreamResp.text().catch(() => "");
    logger.warn(
      { status, model: modelId, errBody: errBody.slice(0, 300) },
      "[proxy] upstream returned non-2xx",
    );
    const safeStatus = status >= 500 ? 502 : status;
    // 401 from an upstream means the provider key is rejected (invalid,
    // expired, or out of credits). Surface an actionable message instead
    // of the raw upstream body, which is often just `{"error":"Authentication failed"}`.
    if (status === 401) {
      throw new ProviderError(
        "Model provider authentication failed (provider API key invalid or out of credits). Contact support.",
        401,
      );
    }
    // 429 = upstream rate-limited / concurrency cap. Raw upstream bodies
    // are noise for end users; keep the detail in the server log instead.
    if (status === 429) {
      throw new ProviderError(
        "Inference provider is rate-limited. Try again in a few seconds.",
        429,
      );
    }
    throw new ProviderError(
      status >= 500
        ? "Inference provider temporarily unavailable"
        : `Upstream ${status}: ${errBody.slice(0, 200)}`,
      safeStatus,
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
): Promise<{ response: Response; actualModelId: string }> {
  const modelId = opts.modelId;
  const freeOnly = opts.skipBilling === true;
  const fallbacks = buildFallbackChain(
    modelId,
    opts.clientFallbacks ?? [],
    freeOnly,
  );

  let lastError: unknown = null;
  const errorLog: unknown[] = [];

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

    while (attempt <= maxRetries) {
      try {
        const response = await callProvider({
          ...opts,
          modelId: currentModelId,
        });

        if (currentModelId !== modelId) {
          logger.info(
            { originalModel: modelId, actualModel: currentModelId, requestId: opts.requestId },
            "[router] Fallback model selected successfully",
          );
        }

        return { response, actualModelId: currentModelId };
      } catch (err) {
        attempt++;
        lastError = err;
        errorLog.push(err);
        const e = readError(err);
        const message = e.message ?? String(err);

        // Auth / not-found / bad request: never thrash the same model —
        // jump straight to the next peer in the chain.
        const isImmediateFailover =
          e.status === 401 ||
          e.status === 403 ||
          e.status === 404 ||
          e.status === 400 ||
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
        502,
      );
    }
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
