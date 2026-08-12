/**
 * Shared inference proxy — provider call + billing logic used by both
 * OpenAI-compatible (/v1/chat/completions) and Anthropic-compatible (/v1/messages) endpoints.
 *
 * Extracts the common logic from routes/chat/index.ts so both gateways
 * route through the same provider selection, streaming, billing, and
 * usage-recording pipeline.
 */
import { getModelById, type ModelDef } from "./models.js";
import { getModelPricing } from "./billing-service.js";
import {
  FALLBACK_MAP,
  buildFallbackChain,
  rewriteSseModelField,
} from "./fallback.js";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { creditBalances, usageRecords } from "../db/schema.js";
import { auditLog } from "../middleware/audit.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";

// Re-export for existing test/route imports that pull helpers from proxy.
export { FALLBACK_MAP, buildFallbackChain, rewriteSseModelField };

/** Provider-specific request envelope. Both backends are OpenAI-compatible. */
interface ProviderRoute {
  baseUrl: string;
  apiKey: string;
  /** Translate OMA model id → upstream model id (Venice, OpenBroker). */
  upstreamModel: (omaModelId: string, omaAiId?: string) => string;
  /** Strip provider-only fields the upstream doesn't accept. */
  extraBody: (body: Record<string, unknown>) => Record<string, unknown>;
  /** Surface the upstream provider name in audit + usage rows. */
  providerLabel: "venice" | "oma-ai";
}

class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

function resolveProvider(provider: string, modelDef?: ModelDef): ProviderRoute {
  if (provider === "oma-ai") {
    // Two resale upstreams, both branded "oma-ai" to users:
    //   zyloo      → api.zyloo.io        (gemini-*, gpt-*)
    //   openbroker → api.openbroker.gonka.gg (MiniMax-M2.7, Kimi-K2.6)
    if (modelDef?.upstream === "openbroker") {
      if (!config.OPENBROKER_API_KEY) {
        throw new ProviderError(
          "OpenBroker API key not configured (set OPENBROKER_API_KEY in the server env).",
          503,
        );
      }
      return {
        baseUrl: `${config.OPENBROKER_API_URL}/v1`,
        apiKey: config.OPENBROKER_API_KEY,
        upstreamModel: (id, gid) => gid ?? id,
        extraBody: (body) => body, // OpenAI-compatible — pass through
        providerLabel: "oma-ai",
      };
    }
    if (!config.ZYLOO_API_KEY) {
      throw new ProviderError(
        "Zyloo API key not configured (set ZYLOO_API_KEY in the server env).",
        503,
      );
    }
    return {
      baseUrl: `${config.ZYLOO_API_URL}/v1`,
      apiKey: config.ZYLOO_API_KEY,
      upstreamModel: (id, gid) => gid ?? id,
      extraBody: (body) => body, // OpenAI-compatible — pass through
      providerLabel: "oma-ai",
    };
  }
  // default: venice
  if (!config.VENICE_API_KEY) {
    throw new ProviderError(
      "Inference provider not configured (VENICE_API_KEY missing).",
      503,
    );
  }
  return {
    baseUrl: `${config.VENICE_API_URL}/api/v1`,
    apiKey: config.VENICE_API_KEY,
    upstreamModel: (id) => id,
    extraBody: (body) => ({
      ...body,
      // Venice privacy: force private mode unless the operator explicitly
      // enabled non-private opt-out. Other providers ignore this field.
      venice_parameters: {
        private: !config.OMMA_ALLOW_NON_PRIVATE_VENICE,
      },
    }),
    providerLabel: "venice",
  };
}

/** Rough token estimate when the upstream doesn't report usage. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function flattenMessageContent(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

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
  let route: ProviderRoute;
  try {
    const provider = providerOverride ?? modelDef.provider;
    route = resolveProvider(provider, modelDef);
  } catch (err) {
    if (err instanceof ProviderError) {
      throw err;
    }
    throw err;
  }

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

export interface RecordUsageArgs {
  userId: string;
  model: string;
  provider: "venice" | "oma-ai";
  promptTokens: number;
  outputTokens: number;
  pricing: ReturnType<typeof getModelPricing>;
  requestId: string;
  status: "completed" | "error";
  /** Skip credit deduction for free website chat */
  skipBilling?: boolean;
}

/**
 * Estimate the maximum charge for a request before contacting the provider.
 * Values are cents and intentionally use the requested max token budget as
 * the worst-case output bound.
 */
function estimateUserCostCents(
  pricing: ReturnType<typeof getModelPricing>,
  promptTokens: number,
  maxOutputTokens?: number,
): number {
  const outputTokens = Math.max(0, maxOutputTokens ?? 0);
  const upstreamCostCents =
    ((promptTokens / 1_000_000) * pricing.inputPer1M +
      (outputTokens / 1_000_000) * pricing.outputPer1M) *
    100;
  return upstreamCostCents * (1 + pricing.markup / 100);
}

/**
 * Preflight the authenticated credit balance. This is deliberately a read
 * only check; the transaction in recordUsage remains the authoritative final
 * deduction and protects against concurrent callers.
 */
export async function assertSufficientBalance(
  userId: string,
  pricing: ReturnType<typeof getModelPricing>,
  promptTokens: number,
  maxOutputTokens?: number,
): Promise<void> {
  const [balance] = await db
    .select({ balanceCents: creditBalances.balanceCents })
    .from(creditBalances)
    .where(sql`${creditBalances.userId} = ${userId}`)
    .limit(1);
  const available = Number(balance?.balanceCents ?? 0);
  const estimated = estimateUserCostCents(pricing, promptTokens, maxOutputTokens);
  // A zero estimate can occur for a catalog entry with missing upstream
  // pricing; allow it through so the provider/config error remains visible.
  if (estimated > 0 && available < estimated) {
    throw new ProviderError(
      `Insufficient credits. Add credits to continue (estimated maximum: $${(estimated / 100).toFixed(4)}).`,
      402,
    );
  }
}

/** Record usage, deduct credits, and emit an audit log entry. */
async function recordUsage(args: RecordUsageArgs): Promise<void> {
  const {
    userId,
    model,
    provider,
    promptTokens,
    outputTokens,
    pricing,
    requestId,
    status,
    skipBilling = false,
  } = args;
  const totalTokens = promptTokens + outputTokens;
  // Pricing fields are in DOLLARS per 1M tokens; multiply by 100 for cents.
  const upstreamCostCents =
    ((promptTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M) * 100;
  const markupMultiplier = 1 + pricing.markup / 100;
  const userCostCents = upstreamCostCents * markupMultiplier;
  const markupCents = userCostCents - upstreamCostCents;

  // Anonymous free-tier requests have no BetterAuth user. The DB schema
  // enforces a FK on usage_records.user_id, and there's no credit balance
  // to deduct. The daily-limit middleware already tracks anon usage in
  // Redis. Skip the DB write entirely for anon to avoid the FK throw.
  const isAnonymous = userId === "anonymous" || !userId;

  try {
    await db.transaction(async (tx) => {
      // Only deduct credits if not free website chat AND user is authed.
      // Upsert: seed a fresh credit row on first call (with the configured
      // free-trial cents) instead of silently letting the call go free when
      // the user has no balance row. Without this, every new user gets free
      // inference forever and the ledger never moves.
      if (status === "completed" && !skipBilling && !isAnonymous) {
        const freeTrialCents = Number(config.FREE_SIGNUP_CENTS ?? 0);
        const initialBalanceCents = Math.max(0, freeTrialCents - userCostCents);
        await tx
          .insert(creditBalances)
          .values({
            userId,
            balanceCents: initialBalanceCents.toFixed(4),
            totalDepositedCents: freeTrialCents.toFixed(4),
            totalUsedCents: userCostCents.toFixed(4),
          })
          .onConflictDoUpdate({
            target: creditBalances.userId,
            set: {
              balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric - ${userCostCents.toFixed(4)}::numeric, 0)`,
              totalUsedCents: sql`${creditBalances.totalUsedCents}::numeric + ${userCostCents.toFixed(4)}::numeric`,
              lastActivityAt: sql`NOW()`,
            },
          });
      }
      // Only persist usage for authenticated users. Anonymous free-tier
      // is tracked in Redis by the daily-limit middleware.
      if (!isAnonymous) {
        await tx.insert(usageRecords).values({
          requestId,
          userId,
          model,
          provider,
          inputTokens: promptTokens,
          outputTokens,
          costCents: skipBilling ? "0" : upstreamCostCents.toFixed(4),
          markupCents: skipBilling ? "0" : markupCents.toFixed(4),
          totalCents: skipBilling ? "0" : userCostCents.toFixed(4),
          status: skipBilling ? "free_tier" : status,
        });
      }
    });
    await auditLog({
      userId,
      action: "USER_CREATED",
      resource: "chat_completion",
      resourceId: requestId,
      metadata: {
        model,
        provider,
        promptTokens,
        outputTokens,
        totalTokens,
        costCents: userCostCents.toFixed(4),
        status,
      },
    });
  } catch (err) {
    logger.error({ err, requestId }, "[proxy] usage record failed");
  }
}

/** Args for createStreamingProxy — outputTokens is calculated during streaming. */
export interface StreamingProxyArgs {
  userId: string;
  model: string;
  provider: "venice" | "oma-ai";
  promptTokens: number;
  pricing: ReturnType<typeof getModelPricing>;
  requestId: string;
  outputTokens?: number;
  /** Skip credit deduction for free website chat */
  skipBilling?: boolean;
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
          try {
            await reader.cancel();
          } catch (cancelErr) {
            logger.warn({ err: cancelErr }, "[proxy] reader cancel failed");
          }
        }
    },
    cancel() {
      reader.cancel().catch(() => {});
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

export { ProviderError, estimateTokens, flattenMessageContent, resolveProvider };
export type { ProviderRoute };