/**
 * Shared inference proxy — provider call + billing logic used by both
 * OpenAI-compatible (/v1/chat/completions) and Anthropic-compatible (/v1/messages) endpoints.
 *
 * Extracts the common logic from routes/chat/index.ts so both gateways
 * route through the same provider selection, streaming, billing, and
 * usage-recording pipeline.
 */
import type { OmaEnv } from "../types.js";
import { getModelById } from "./models.js";
import { getModelPricing } from "./billing-service.js";
import { trackPolarUsage } from "./polar-usage.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { creditBalances, usageRecords } from "../db/schema.js";
import { auditLog } from "../middleware/audit.js";
import { logger } from "../lib/logger.js";
import { eq, sql } from "drizzle-orm";

/** Provider-specific request envelope. Both backends are OpenAI-compatible. */
interface ProviderRoute {
  baseUrl: string;
  apiKey: string;
  /** Translate OMA model id → upstream model id (Venice, OpenBroker). */
  upstreamModel: (omaModelId: string, gonkaId?: string) => string;
  /** Strip provider-only fields the upstream doesn't accept. */
  extraBody: (body: Record<string, unknown>) => Record<string, unknown>;
  /** Surface the upstream provider name in audit + usage rows. */
  providerLabel: "venice" | "gonka";
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

function resolveProvider(provider: string, gonkaId?: string): ProviderRoute {
  if (provider === "gonka") {
    if (!config.GONKA_API_KEY) {
      throw new ProviderError(
        "Gonka/OpenBroker API key not configured (set GONKA_API_KEY in the server env).",
        503,
      );
    }
    return {
      baseUrl: `${config.GONKA_API_URL}/v1`,
      apiKey: config.GONKA_API_KEY,
      upstreamModel: (id, gid) => gid ?? id,
      extraBody: (body) => body, // OpenAI-compatible — pass through
      providerLabel: "gonka",
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
  providerOverride?: "venice" | "gonka";
  /** Skip credit deduction for free website chat */
  skipBilling?: boolean;
}

/**
 * Core provider call — handles upstream request, streaming, billing, and usage recording.
 * Returns the raw upstream Response object for the caller to translate/stream as needed.
 */
export async function callProvider(opts: CallProviderOptions): Promise<Response> {
  const { modelId, messages, stream, max_tokens, temperature, top_p, tools, tool_choice, userId, requestId, providerOverride } = opts;

  const modelDef = getModelById(modelId);
  if (!modelDef) {
    throw new ProviderError(`Model ${modelId} not found`, 404);
  }

  const pricing = getModelPricing(modelId);

  // Resolve upstream provider (Venice vs Gonka/OpenBroker).
  let route: ProviderRoute;
  try {
    const provider = providerOverride ?? modelDef.provider;
    route = resolveProvider(provider, modelDef.gonkaId);
  } catch (err) {
    if (err instanceof ProviderError) {
      throw err;
    }
    throw err;
  }

  const upstreamUrl = `${route.baseUrl}/chat/completions`;
  const upstreamModel = route.upstreamModel(
    modelDef.veniceId ?? modelDef.id,
    modelDef.gonkaId,
  );

  const promptText = messages.map((m) => flattenMessageContent(m.content)).join("\n");
  const promptTokens = estimateTokens(promptText);

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
    const error = new Error(
      status >= 500
        ? "Inference provider temporarily unavailable"
        : `Upstream ${status}: ${errBody.slice(0, 200)}`,
    ) as Error & { status: number; type: string };
    error.status = safeStatus;
    error.type = status >= 500 ? "server_error" : "upstream_error";
    throw error;
  }

  return upstreamResp;
}

export interface RecordUsageArgs {
  userId: string;
  model: string;
  provider: "venice" | "gonka";
  promptTokens: number;
  outputTokens: number;
  pricing: ReturnType<typeof getModelPricing>;
  requestId: string;
  status: "completed" | "error";
  /** Skip credit deduction for free website chat */
  skipBilling?: boolean;
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

  try {
    await db.transaction(async (tx) => {
      // Only deduct credits if not free website chat
      if (status === "completed" && !skipBilling) {
        const balanceRows = await tx
          .select()
          .from(creditBalances)
          .where(eq(creditBalances.userId, userId))
          .limit(1);
        if (balanceRows.length > 0) {
          await tx
            .update(creditBalances)
            .set({
              balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric - ${userCostCents.toFixed(4)}::numeric, 0)`,
              totalUsedCents: sql`${creditBalances.totalUsedCents}::numeric + ${userCostCents.toFixed(4)}::numeric`,
              lastActivityAt: sql`NOW()`,
            })
            .where(eq(creditBalances.userId, userId));
        }
      }
      // Always record usage (for analytics), but mark as free tier
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
    if (status === "completed") {
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
  provider: "venice" | "gonka";
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
          // Use upstream-reported usage when available (Gonka sends a final
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
            // Gonka/OpenBroker uses "reasoning" for MiniMax chain-of-thought;
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
        } catch {}
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