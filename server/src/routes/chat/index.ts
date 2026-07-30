/**
 * OpenAI-compatible chat completions — multi-provider proxy.
 *
 * Routes a single userId-keyed chat call to the upstream matching the
 * requested model's `provider` field, and:
 *
 *   - Streams the OpenAI-shaped SSE back to the browser unchanged.
 *   - Estimates prompt/completion token counts (some upstreams don't
 *     always include `usage` in streamed chunks).
 *   - Deducts credits from `creditBalances` after a successful call
 *     (5xx failures leave the balance alone).
 *   - Records one row per request into `usageRecords` for the dashboard.
 *
 * Adds a small provider markup on top of the upstream's per-token cost
 * (defined in the `ModelDef.markupPercent` field).
 *
 * Wired providers (see `inference/models.ts` for the catalog):
 *
 *   venice — Venice AI (privacy-first, OpenAI-compatible).
 *             https://api.venice.ai/api/v1/chat/completions
 *   gonka  — Gonka decentralized inference broker (OpenBroker by
 *             default). OpenAI-compatible. Used as the cheap tier for
 *             large-context / tool-use requests.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { OmaEnv } from "../../types.js";
import { sessionOrBearerAuth } from "../../auth/middleware.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { getModelById } from "../../inference/models.js";
import { getModelPricing } from "../../inference/billing-service.js";
import {
  callProvider,
  createStreamingProxy,
  parseNonStreamingResponse,
  ProviderError,
  estimateTokens,
  flattenMessageContent,
} from "../../inference/proxy.js";
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
    const { model, messages, stream, max_tokens, temperature, top_p, tools, tool_choice } = parsed.data;
    const modelDef = getModelById(model);
    if (!modelDef) {
      return c.json(
        { error: { message: `Model ${model} not found`, type: "not_found" } },
        404,
      );
    }
    const userId = c.get("userId");
    const pricing = getModelPricing(model);
    const requestId = `chatcmpl-${crypto.randomUUID()}`;

    const promptText = messages.map((m) => flattenMessageContent(m.content)).join("\n");
    const promptTokens = estimateTokens(promptText);

    try {
      const upstreamResp = await callProvider({
        modelId: model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.name ? { name: m.name } : {}),
        })),
        stream,
        max_tokens,
        temperature,
        top_p,
        tools,
        tool_choice,
        userId,
        requestId,
      });

      if (stream) {
        c.header("Content-Type", "text/event-stream");
        c.header("Cache-Control", "no-cache, no-transform");
        c.header("X-Accel-Buffering", "no");
        const proxyStream = createStreamingProxy(upstreamResp, {
          userId,
          model,
          provider: modelDef.provider as "venice" | "gonka",
          promptTokens,
          pricing,
          requestId,
        });
        return c.body(proxyStream, 200);
      }

      const { data } = await parseNonStreamingResponse(upstreamResp, {
        userId,
        model,
        provider: modelDef.provider as "venice" | "gonka",
        promptTokens,
        pricing,
        requestId,
      });

      return c.json(data);
    } catch (err) {
      if (err instanceof ProviderError) {
        return c.json(
          {
            error: { message: err.message, type: err.status >= 500 ? "server_error" : "upstream_error" },
          },
          err.status as 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
        );
      }
      logger.error({ err, model }, "[chat] unexpected error");
      return c.json(
        { error: { message: "Internal server error", type: "server_error" } },
        500,
      );
    }
  },
);

export { ProviderError, estimateTokens, flattenMessageContent };