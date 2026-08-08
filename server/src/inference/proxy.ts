/**
 * Shared inference proxy — provider call + billing logic used by both
 * OpenAI-compatible (/v1/chat/completions) and Anthropic-compatible (/v1/messages) endpoints.
 *
 * Extracts the common logic from routes/chat/index.ts so both gateways
 * route through the same provider selection, streaming, billing, and
 * usage-recording pipeline.
 */
import { getModelById } from "./models.js";
import { getModelPricing } from "./billing-service.js";
import { trackPolarUsage } from "./polar-usage.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { creditBalances, usageRecords } from "../db/schema.js";
import { auditLog } from "../middleware/audit.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";

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

function resolveProvider(provider: string, _omaAiId?: string): ProviderRoute {
  if (provider === "oma-ai") {
    if (!config.ZYLOO_API_KEY) {
      throw new ProviderError(
        "OMA-AI/OpenBroker API key not configured (set ZYLOO_API_KEY in the server env).",
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
}

/**
 * Core provider call — handles upstream request, streaming, billing, and usage recording.
 * Returns the raw upstream Response object for the caller to translate/stream as needed.
 */
export async function callProvider(opts: CallProviderOptions): Promise<Response> {
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
    route = resolveProvider(provider, modelDef.omaAiId);
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

  const upstreamResp = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${route.apiKey}`,
    },
    body: JSON.stringify(upstreamBody),
  }).catch((err) => {
    logger.error({ err, provider: route.providerLabel }, "[proxy] upstream fetch failed");
    return null;
  });

  if (!upstreamResp) {
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
    throw new ProviderError(
      status >= 500
        ? "Inference provider temporarily unavailable"
        : `Upstream ${status}: ${errBody.slice(0, 200)}`,
      safeStatus,
    );
  }

  return upstreamResp;
}

export const FALLBACK_MAP: Record<string, string[]> = {
  // Frontier
  "claude-opus-5": ["openai-gpt-56-sol", "claude-sonnet-5"],
  "openai-gpt-56-sol": ["claude-opus-5", "claude-sonnet-5"],
  
  // Premium
  "claude-sonnet-5": ["openai-gpt-54", "kimi-k3", "openai-gpt-52"],
  "openai-gpt-54": ["claude-sonnet-5", "kimi-k3", "openai-gpt-52"],
  "kimi-k3": ["claude-sonnet-5", "openai-gpt-54", "grok-4-5"],
  "openai-gpt-52": ["openai-gpt-54", "grok-4-5"],
  "grok-4-5": ["openai-gpt-54", "claude-sonnet-5"],
  "zai-org-glm-5-2": ["grok-4-5", "claude-sonnet-5"],

  // Mid
  "deepseek-v4-pro": ["qwen-3-7-plus", "gemini-3-5-flash", "kimi-k2.6"],
  "gemini-3-5-flash": ["deepseek-v4-pro", "qwen-3-7-plus", "kimi-k2.6"],
  "gemini-3-flash-preview": ["deepseek-v4-flash", "mistral-small-2603"],
  "llama-3.3-70b": ["deepseek-v4-pro", "qwen-3-7-plus"],
  "zai-org-glm-5-1": ["deepseek-v4-pro", "gemini-3-5-flash"],
  "qwen-3-7-plus": ["deepseek-v4-pro", "gemini-3-5-flash", "kimi-k2.6"],

  // Budget
  "deepseek-v4-flash": ["mistral-small-2603", "xiaomi-mimo-v2-5", "minimax-m2.7"],
  "mistral-small-2603": ["deepseek-v4-flash", "xiaomi-mimo-v2-5", "minimax-m2.7"],
  "xiaomi-mimo-v2-5": ["deepseek-v4-flash", "mistral-small-2603", "minimax-m2.7"],
  "mercury-2": ["deepseek-v4-flash", "mistral-small-2603"],

  // OMA-AI Free Models (OpenBroker) — prefer oma-ai peers first, then budget Venice
  "minimax-m2.7": ["kimi-k2.6", "deepseek-v4-flash", "mistral-small-2603"],
  "kimi-k2.6": ["minimax-m2.7", "deepseek-v4-flash", "mistral-small-2603"],
};

/**
 * Intelligent Router — routes a requested model with automatic retries (exponential backoff)
 * and failover to comparable fallback models when errors occur.
 */
export async function routeRequestWithFallback(
  opts: CallProviderOptions,
): Promise<{ response: Response; actualModelId: string }> {
  const modelId = opts.modelId;
  const fallbacks = [modelId, ...(FALLBACK_MAP[modelId] || [])];

  let lastError: unknown = null;

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
    const maxRetries = 3;
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
        const e = readError(err);
        const message = e.message ?? String(err);

        // Transient errors include server errors (5xx) or rate limits (429)
        const isTransient =
          e.status !== undefined && (e.status >= 500 || e.status === 429);

        const isNetworkError =
          e.status === undefined ||
          (typeof e.message === "string" &&
            (e.message.includes("unreachable") ||
              e.message.includes("timeout") ||
              e.message.includes("fetch failed")));

        if (attempt <= maxRetries && (isTransient || isNetworkError)) {
          // Exponential backoff with random jitter: 100ms * 2^attempt, plus up to 50ms random jitter
          const baseDelay = 100 * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 50;
          const delay = Math.min(baseDelay + jitter, 2000);
          logger.warn(
            { modelId: currentModelId, attempt, delay, error: message },
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

  // If all fallbacks failed, throw the last observed error
  if (lastError) throw lastError;
  throw new ProviderError("Model routing failed on all fallback attempts", 502);
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
export function estimateUserCostCents(
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

/** Record usage, deduct credits, emit audit log, and send Polar meter event. */
export async function recordUsage(args: RecordUsageArgs): Promise<void> {
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
    if (status === "completed" && !isAnonymous) {
      void trackPolarUsage({
        externalCustomerId: userId,
        requestId,
        model,
        provider,
        promptTokens,
        outputTokens,
        totalTokens,
        costCents: userCostCents,
      });
    }
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
  let outputTokens = 0;
  let finalPromptTokens: number | null = null;
  let finalOutputTokens: number | null = null;
  let upstreamStatus: "completed" | "error" = "completed";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          // Use upstream-reported usage when available (OMA-AI sends a final
          // usage chunk at the end of the stream), falling back to estimates.
          const finalTokens = finalOutputTokens ?? recordArgs.outputTokens ?? outputTokens;
          const promptTokens = finalPromptTokens ?? recordArgs.promptTokens;
          await recordUsage({ ...recordArgs, promptTokens, outputTokens: finalTokens, status: upstreamStatus });
          return;
        }
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            const choice = obj.choices?.[0];
            // Handle both "content" and "reasoning"/"reasoning_content" deltas.
            // OMA-AI/OpenBroker uses "reasoning" for MiniMax chain-of-thought;
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
        controller.enqueue(value);
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

  return { data, promptTokens: finalPromptTokens, outputTokens: completionTokens };
}

export { ProviderError, estimateTokens, flattenMessageContent, resolveProvider };
export type { ProviderRoute };