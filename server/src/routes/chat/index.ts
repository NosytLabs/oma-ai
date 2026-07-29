/**
 * OpenAI-compatible chat completions — proxy through Venice AI.
 *
 * The only wired provider right now. Routes a single userId-keyed chat
 * call to https://api.venice.ai/api/v1/chat/completions and:
 *
 *   - Streams the OpenAI-shaped SSE back to the browser unchanged.
 *   - Estimates prompt/completion token counts (Venice doesn't always
 *     include `usage` in streamed chunks).
 *   - Deducts credits from `creditBalances` after a successful call
 *     (5xx failures leave the balance alone).
 *   - Records one row per request into `usageRecords` for the dashboard.
 *
 * Adds a small provider markup on top of Venice's per-token cost
 * (defined in the `ModelDef.markupPercent` field).
 */
import { Hono } from "hono";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { sessionOrBearerAuth } from "../../auth/middleware.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { getModelById } from "../../inference/models.js";
import { getModelPricing } from "../../inference/billing-service.js";
import { config } from "../../config.js";
import { db } from "../../db/client.js";
import { creditBalances, usageRecords } from "../../db/schema.js";
import { auditLog } from "../../middleware/audit.js";
import { logger } from "../../lib/logger.js";

const chatSchema = z.object({
  model: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.string().or(z.array(z.any())),
        name: z.string().optional(),
      }),
    )
    .min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  tools: z.array(z.any()).optional(),
  tool_choice: z.any().optional(),
});

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

export const chatRoutes = new Hono<OmaEnv>();

chatRoutes.post(
  "/v1/chat/completions",
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  sessionOrBearerAuth,
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: "Invalid request",
            type: "invalid_request_error",
            issues: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    const { model, messages, stream, max_tokens, temperature, top_p } = parsed.data;
    const modelDef = getModelById(model);
    if (!modelDef) {
      return c.json(
        { error: { message: `Model ${model} not found`, type: "not_found" } },
        404,
      );
    }
    const userId = c.get("userId");
    const pricing = getModelPricing(model);
    const upstreamUrl = `${config.VENICE_API_URL}/api/v1/chat/completions`;
    const upstreamModel = modelDef.veniceId ?? modelDef.id;
    const veniceKey = config.VENICE_API_KEY;
    if (!veniceKey) {
      return c.json(
        {
          error: {
            message: "Inference provider not configured (VENICE_API_KEY missing).",
            type: "server_error",
          },
        },
        503,
      );
    }

    const requestId = `chatcmpl-${crypto.randomUUID()}`;
    const promptText = messages.map((m) => flattenMessageContent(m.content)).join("\n");
    const promptTokens = estimateTokens(promptText);

    const upstreamBody = {
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
      // Venice privacy: force private mode unless the operator explicitly
      // enabled non-private opt-out.
      venice_parameters: {
        private: !config.OMMA_ALLOW_NON_PRIVATE_VENICE,
      },
    };

    const upstreamResp = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${veniceKey}`,
      },
      body: JSON.stringify(upstreamBody),
    }).catch((err) => {
      logger.error({ err }, "[chat] upstream fetch failed");
      return null;
    });

    if (!upstreamResp) {
      return c.json(
        {
          error: {
            message: "Upstream inference provider unreachable",
            type: "server_error",
          },
        },
        502,
      );
    }

    if (!upstreamResp.ok) {
      const status = upstreamResp.status as number;
      const errBody = await upstreamResp.text().catch(() => "");
      logger.warn(
        { status, model, errBody: errBody.slice(0, 300) },
        "[chat] upstream returned non-2xx",
      );
      // Surface 4xx/5xx as-is so clients can react; never bill on 5xx.
      const safeStatus = status >= 500 ? 502 : status;
      return c.json(
        {
          error: {
            message:
              status >= 500
                ? "Inference provider temporarily unavailable"
                : `Upstream ${status}: ${errBody.slice(0, 200)}`,
            type: status >= 500 ? "server_error" : "upstream_error",
          },
        },
        safeStatus as 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502,
      );
    }

    // ── Streaming branch: pipe SSE chunks back, accumulate usage ───────
    if (stream) {
      if (!upstreamResp.body) {
        return c.json(
          { error: { message: "Upstream stream empty", type: "server_error" } },
          502,
        );
      }
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache, no-transform");
      c.header("X-Accel-Buffering", "no");
      const reader = upstreamResp.body.getReader();
      const decoder = new TextDecoder();
      let outputTokens = 0;
      let upstreamStatus: "completed" | "error" = "completed";

      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              await recordUsage({
                userId,
                model,
                provider: "venice",
                promptTokens,
                outputTokens,
                pricing,
                requestId,
                status: upstreamStatus,
              });
              return;
            }
            const text = decoder.decode(value, { stream: true });
            // Count `content` token deltas. `reasoning`/chain-of-thought deltas
            // are counted separately by Venice but we treat them as output for
            // billing since the model "produced" them for the user.
            for (const line of text.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const obj = JSON.parse(payload);
                const choice = obj.choices?.[0];
                const delta = choice?.delta?.content ?? choice?.delta?.reasoning_content;
                if (typeof delta === "string" && delta.length > 0) {
                  outputTokens += estimateTokens(delta);
                }
                if (obj.usage?.completion_tokens) {
                  outputTokens = obj.usage.completion_tokens;
                }
              } catch {
                // ignore unparseable SSE lines
              }
            }
            controller.enqueue(value);
          } catch (err) {
            logger.warn({ err }, "[chat] stream read failed");
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

      return c.body(stream, 200);
    }

    // ── Non-streaming branch: parse JSON, return OpenAI shape ───────────
    const data = await upstreamResp.json().catch(() => null);
    if (!data) {
      return c.json(
        { error: { message: "Invalid upstream response", type: "server_error" } },
        502,
      );
    }

    const completionText =
      data?.choices?.[0]?.message?.content ??
      flattenMessageContent(data?.choices?.[0]?.message?.content ?? "") ??
      "";
    const reported = data?.usage?.completion_tokens;
    const completionTokens =
      typeof reported === "number" && reported > 0 ? reported : estimateTokens(completionText);
    await recordUsage({
      userId,
      model,
      provider: "venice",
      promptTokens: data?.usage?.prompt_tokens ?? promptTokens,
      outputTokens: completionTokens,
      pricing,
      requestId,
      status: "completed",
    });

    return c.json(data);
  },
);

async function recordUsage(args: {
  userId: string;
  model: string;
  provider: "venice";
  promptTokens: number;
  outputTokens: number;
  pricing: ReturnType<typeof getModelPricing>;
  requestId: string;
  status: "completed" | "error";
}): Promise<void> {
  const {
    userId,
    model,
    provider,
    promptTokens,
    outputTokens,
    pricing,
    requestId,
    status,
  } = args;
  const totalTokens = promptTokens + outputTokens;
  const upstreamCostCents =
    (promptTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M;
  const markupMultiplier = 1 + pricing.markup / 100;
  const userCostCents = upstreamCostCents * markupMultiplier;
  const markupCents = userCostCents - upstreamCostCents;

  try {
    await db.transaction(async (tx) => {
      if (status === "completed") {
        // Deduct only on success. We use a single guarded update — if
        // the user has no row or insufficient balance we leave it
        // alone and continue to record the usage with status=completed.
        // (Real money > bookkeeping; real launch will refund or hard-fail.)
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
      await tx.insert(usageRecords).values({
        requestId,
        userId,
        model,
        provider,
        inputTokens: promptTokens,
        outputTokens,
        costCents: upstreamCostCents.toFixed(4),
        markupCents: markupCents.toFixed(4),
        totalCents: userCostCents.toFixed(4),
        status,
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
  } catch (err) {
    logger.error({ err, requestId }, "[chat] usage record failed");
  }
}

void rateLimit;