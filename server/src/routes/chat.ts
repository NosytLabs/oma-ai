import { Hono } from "hono";
import { z } from "zod";
import { bearerAuth } from "../auth/middleware.js";
import { handleChatCompletion } from "../inference/router.js";
import { MODEL_CATALOG, getModel } from "../inference/models.js";
import * as venice from "../inference/venice.js";
import { getBalance, deductCredits } from "../credits/balance.js";
import { estimateTokens } from "../inference/models.js";
import { tokenBucket, modelRateLimit } from "../middleware/rate-limit.js";
import { spendLimit, trackSpend } from "../middleware/spend-limit.js";
import type { OmaEnv } from "../types.js";
import { withSpan } from "../tracing.js";
import { SpanKind } from "@opentelemetry/api";

export const chatRoutes = new Hono<OmaEnv>();

function validationError(err: z.ZodError) {
  return { error: { message: `Validation error: ${err.errors.map((e) => e.message).join(", ")}`, type: "invalid_request_error" as const } };
}

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant", "tool"]),
    content: z.union([z.string(), z.array(z.any())]),
  })).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.any()).optional(),
  response_format: z.any().optional(),
});

const completionSchema = z.object({
  model: z.string().min(1),
  prompt: z.union([z.string(), z.array(z.string())]),
});

const embeddingsSchema = z.object({
  model: z.string().min(1),
  input: z.union([z.string(), z.array(z.string())]),
});

chatRoutes.use("/v1/chat/completions", bearerAuth);
chatRoutes.use("/v1/chat/completions", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
chatRoutes.use("/v1/chat/completions", modelRateLimit());
chatRoutes.use("/v1/chat/completions", spendLimit());
chatRoutes.use("/v1/completions", bearerAuth);
chatRoutes.use("/v1/completions", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
chatRoutes.use("/v1/embeddings", bearerAuth);
chatRoutes.use("/v1/embeddings", tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));
chatRoutes.use("/v1/images/generations", bearerAuth);
chatRoutes.use("/v1/images/generations", tokenBucket({ refillRate: 5, bucketSize: 10, rpmLimit: 10 }));
chatRoutes.use("/v1/audio/speech", bearerAuth);
chatRoutes.use("/v1/audio/speech", tokenBucket({ refillRate: 10, bucketSize: 20, rpmLimit: 20 }));

chatRoutes.post("/v1/chat/completions", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const correlationId = c.get("correlationId") as string | undefined;

  // Start a span for the entire request lifecycle
  return withSpan(
    "chat.completion",
    async (span) => {
      span?.setAttribute("user.id", userId);
      if (correlationId) span?.setAttribute("correlation.id", correlationId);

      const parsed = chatCompletionSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "validation_error");
        return c.json(validationError(parsed.error), 400);
      }
      const { model, messages, stream, ...rest } = parsed.data;

      span?.setAttribute("llm.model", model);
      span?.setAttribute("llm.stream", stream ?? false);
      span?.setAttribute("llm.messages_count", messages.length);

      const modelInfo = getModel(model);
      if (!modelInfo) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "model_not_found");
        return c.json({ error: { message: `Model '${model}' not found. Available: ${Object.keys(MODEL_CATALOG).join(", ")}`, type: "invalid_request_error", code: "model_not_found" } }, 400);
      }

      const bal = await getBalance(userId);
      if (Number(bal.balanceCents) <= 0) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "insufficient_credits");
        return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
      }

      const payload = { model, messages, stream: !!stream, ...rest };
      const apiKeyId = apiKey?.id ?? "unknown";

      try {
        const { response, provider, inputTokens, outputTokens } = await handleChatCompletion(userId, apiKeyId, payload);
        span?.setAttribute("llm.provider", provider);
        if (inputTokens) span?.setAttribute("llm.tokens.input", inputTokens);
        if (outputTokens) span?.setAttribute("llm.tokens.output", outputTokens);

        if (stream) {
          return new Response(response.body, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
              "x-provider": provider,
              "X-Correlation-ID": correlationId || "",
            },
          });
        }
        const json = await response.json();
        const totalCents = json.usage?.totalCents ?? Math.round(parseFloat(json.usage?.total_cost ?? "0") * 100);
        if (totalCents > 0 && apiKey) {
          trackSpend(apiKey.keyHash, Math.ceil(totalCents)).catch((err) => {
            console.error(`[spend-limit] Track failed for key ${apiKey.keyHash.slice(0, 8)}:`, err);
          });
        }
        return c.json(json, { headers: { "x-provider": provider, "X-Correlation-ID": correlationId || "" } });
      } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", (err as { type?: string }).type ?? "inference_error");
        span?.setAttribute("http.status_code", status);
        return c.json({ error: { message: (err as Error).message, type: (err as { type?: string }).type ?? "inference_error" } }, status as Parameters<typeof c.json>[1]);
      }
    },
    undefined,
    SpanKind.SERVER
  );
});

chatRoutes.post("/v1/completions", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = completionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, ...rest } = parsed.data;
  const stream = (parsed.data as { stream?: boolean }).stream;

  const modelInfo = getModel(model);
  if (!modelInfo) return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 400);

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);

  const messages = [{ role: "user" as const, content: typeof prompt === "string" ? prompt : prompt.map((p) => p).join("\n") }];
  const payload = { model, messages, stream: !!stream, ...rest };
  const apiKeyId = apiKey?.id ?? "unknown";

  try {
    const { response, provider } = await handleChatCompletion(userId, apiKeyId, payload);
    if (stream) {
      return new Response(response.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "x-provider": provider,
        },
      });
    }
    const json = await response.json();
    return c.json(json, { headers: { "x-provider": provider } });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return c.json({ error: { message: (err as Error).message, type: (err as { type?: string }).type ?? "inference_error" } }, status as Parameters<typeof c.json>[1]);
  }
});

chatRoutes.post("/v1/embeddings", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = embeddingsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, input } = parsed.data;

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  try {
    const resp = await venice.embeddings({ model, input });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Embedding failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }
    const json = await resp.json();
    const inputTokens = json.usage?.prompt_tokens ?? 0;

    await deductCredits(userId, 1, 0, 1, model, "venice", apiKey?.id ?? "unknown", inputTokens, 0);

    if (apiKey) {
      trackSpend(apiKey.keyHash, 1).catch(() => {});
    }
    return c.json(json);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    return c.json({ error: { message: (err as Error).message, type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

const imageGenerationSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  n: z.number().int().positive().optional(),
  size: z.string().optional(),
});

chatRoutes.post("/v1/images/generations", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = imageGenerationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, n, size } = parsed.data;

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  const imageCount = n ?? 1;
  const totalCents = imageCount * 5;

  try {
    const resp = await venice.imageGeneration({ model, prompt, n: imageCount, size });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Image generation failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }
    const json = await resp.json();

    await deductCredits(userId, totalCents - 1, 1, totalCents, model, "venice", apiKey?.id ?? "unknown", 0, 0);

    if (apiKey) {
      trackSpend(apiKey.keyHash, totalCents).catch(() => {});
    }
    return c.json(json);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    return c.json({ error: { message: (err as Error).message, type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

const audioSpeechSchema = z.object({
  model: z.string().min(1),
  input: z.string().min(1),
  voice: z.string().optional(),
  response_format: z.string().optional(),
});

chatRoutes.post("/v1/audio/speech", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = audioSpeechSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, input, voice, response_format } = parsed.data;

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  const inputTokens = estimateTokens(input);
  const totalCents = Math.max(1, Math.ceil(inputTokens / 1000));

  try {
    const resp = await venice.textToSpeech({ model, input, voice, response_format });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Text-to-speech failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }

    await deductCredits(userId, totalCents - 1, 1, totalCents, model, "venice", apiKey?.id ?? "unknown", inputTokens, 0);

    if (apiKey) {
      trackSpend(apiKey.keyHash, totalCents).catch(() => {});
    }

    const audioBuffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") ?? "audio/mpeg";
    return c.body(audioBuffer, 200, { "Content-Type": contentType });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    return c.json({ error: { message: (err as Error).message, type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});
