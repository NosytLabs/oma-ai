import { z } from "zod";
import { Hono } from "hono";
import { bearerAuth } from "../auth/middleware.js";
import { handleChatCompletion } from "../inference/router.js";
import { getModel, VIDEO_MODELS, calculateCost, WHISPER_MODEL } from "../inference/models.js";
import * as venice from "../inference/venice.js";
import { getBalance, deductCredits } from "../credits/balance.js";
import { estimateTokens } from "../inference/models.js";
import { tokenBucket, modelRateLimit } from "../middleware/rate-limit.js";
import { requestTimeout } from "../middleware/timeout.js";
import { spendLimit, trackSpend } from "../middleware/spend-limit.js";
import { validationError } from "../lib/validation.js";
import { checkIdempotencyKey, storeIdempotencyResult } from "../middleware/idempotency.js";
import type { OmaEnv } from "../types.js";
import { withSpan } from "../tracing.js";
import { SpanKind } from "@opentelemetry/api";
import { config } from "../config.js";
import { USDC_BASE } from "../constants.js";

/**
 * x402 PAYMENT ARCHITECTURE NOTE (for Overseer's records):
 * =======================================================
 * x402 middleware uses FIXED/FLAT pricing per route. This is incompatible
 * with inference routes which have VARIABLE costs based on actual token usage.
 *
 * The inference system already handles dynamic pricing via the credit system:
 *   1. Preflight deduction based on estimated tokens (router.ts:171)
 *   2. Actual cost calculation after response (router.ts:217-229)
 *   3. Automatic refund of overestimated costs (router.ts:237-238)
 *
 * Applying x402 flat-fee to inference routes would either:
 *   A) Overcharge users (flat fee > actual cost), OR
 *   B) Undercharge and lose money (flat fee < actual cost)
 *
 * The x402 payment layer is correctly positioned as a CREDIT TOP-UP mechanism:
 * - Users without credits cannot pay for inference
 * - x402 provides onchain USDC payments to add credits via /x402/deposit
 * - The credit system then handles the variable inference costs
 *
 * If true x402-native inference (without credits) is desired, the implementation
 * would require:
 *   1. Pre-authorize with estimated max cost
 *   2. Store authorization in settlement cache
 *   3. After inference, calculate actual cost and settle delta onchain
 *   This is a significant architectural change and is not currently planned.
 *
 * Current design: Credits-only for inference, x402 for deposits only.
 */

export const chatRoutes = new Hono<OmaEnv>();

const MAX_MESSAGE_CONTENT_BYTES = 100_000; // 100KB per message content
const MAX_MESSAGES = 100;
const MAX_TOTAL_BYTES = 1_000_000; // 1MB total for all messages combined
const MAX_REQUEST_BODY_SIZE = 10_000_000; // 10MB max request body

function checkRequestBodySizeLimit(c: import("hono").Context): boolean {
  const contentLength = c.req.header("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_REQUEST_BODY_SIZE) {
      return false;
    }
  }
  return true;
}

function createInsufficientCreditsPayReq(returnToUrl: string, amountCents: number = 1) {
  const now = Math.floor(Date.now() / 1000);
  const paymentURL = `https://pay.oma-ai.com/x402/deposit?network=base&asset=USDC&return_to=${encodeURIComponent(returnToUrl)}`;
  return {
    x402Version: "1" as const,
    scheme: "evm" as const,
    networkId: "base",
    asset: USDC_BASE,
    amount: (amountCents / 100).toFixed(2),
    payee: config.HOUDINI_ADDRESS_TO || "0x0000000000000000000000000000000000000000",
    maxAmountRequired: (amountCents / 100).toFixed(2),
    validBefore: now + 3600,
    validAfter: now,
    "payment-URL": paymentURL,
  };
}

function validateMessageContent(content: unknown): boolean {
  if (typeof content === "string") {
    return new TextEncoder().encode(content).length <= MAX_MESSAGE_CONTENT_BYTES;
  }
  if (Array.isArray(content)) {
    return content.every(part => {
      if (part && typeof part === "object" && "type" in part && "text" in (part as object)) {
        if (typeof (part as { text?: unknown }).text === "string") {
          return new TextEncoder().encode((part as { text: string }).text).length <= MAX_MESSAGE_CONTENT_BYTES;
        }
      }
      return true;
    });
  }
  return true;
}

function validateMessages(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0 || messages.length > MAX_MESSAGES) return false;

  let totalBytes = 0;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") return false;
    const m = msg as { role?: unknown; content?: unknown };
    if (!m.role || !m.content) return false;

    if (typeof m.content === "string") {
      totalBytes += new TextEncoder().encode(m.content).length;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part && typeof part === "object" && "text" in part) {
          if (typeof (part as { text?: unknown }).text === "string") {
            totalBytes += new TextEncoder().encode((part as { text: string }).text).length;
          }
        }
      }
    }

    if (totalBytes > MAX_TOTAL_BYTES) return false;
  }

  return messages.every(m => validateMessageContent((m as { content?: unknown }).content));
}

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.any())]),
}).refine(validateMessageContent, {
  message: `Message content exceeds maximum size of ${MAX_MESSAGE_CONTENT_BYTES} bytes`
});

const chatCompletionSchema = z.object({
  model: z.string().min(1).max(100),
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES)
    .refine(validateMessages, {
      message: `Total message content exceeds maximum size of ${MAX_TOTAL_BYTES} bytes or more than ${MAX_MESSAGES} messages`
    }),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.any()).optional(),
  response_format: z.any().optional(),
});

const completionSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.union([z.string(), z.array(z.string())]),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().positive().max(10).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().optional(),
  logprobs: z.number().int().optional(),
  echo: z.boolean().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  best_of: z.number().int().positive().optional(),
});

const embeddingsSchema = z.object({
  model: z.string().min(1).max(100),
  input: z.union([z.string().max(50000), z.array(z.string().max(50000))]),
});

chatRoutes.use("/v1/chat/completions", bearerAuth);
chatRoutes.use("/v1/chat/completions", requestTimeout());
chatRoutes.use("/v1/chat/completions", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
chatRoutes.use("/v1/chat/completions", modelRateLimit());
chatRoutes.use("/v1/chat/completions", spendLimit());
chatRoutes.use("/v1/completions", bearerAuth);
chatRoutes.use("/v1/completions", requestTimeout());
chatRoutes.use("/v1/completions", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
chatRoutes.use("/v1/embeddings", bearerAuth);
chatRoutes.use("/v1/embeddings", requestTimeout());
chatRoutes.use("/v1/embeddings", tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));
chatRoutes.use("/v1/images/generations", bearerAuth);
chatRoutes.use("/v1/images/generations", requestTimeout());
chatRoutes.use("/v1/images/generations", tokenBucket({ refillRate: 5, bucketSize: 10, rpmLimit: 10 }));
chatRoutes.use("/v1/audio/speech", bearerAuth);
chatRoutes.use("/v1/audio/speech", requestTimeout());
chatRoutes.use("/v1/audio/speech", tokenBucket({ refillRate: 10, bucketSize: 20, rpmLimit: 20 }));
chatRoutes.use("/v1/audio/transcriptions", bearerAuth);
chatRoutes.use("/v1/audio/transcriptions", requestTimeout());
chatRoutes.use("/v1/audio/transcriptions", tokenBucket({ refillRate: 10, bucketSize: 20, rpmLimit: 20 }));
chatRoutes.use("/v1/videos/generations", bearerAuth);
chatRoutes.use("/v1/videos/generations", requestTimeout());
chatRoutes.use("/v1/videos/generations", tokenBucket({ refillRate: 2, bucketSize: 5, rpmLimit: 5 }));
chatRoutes.use("/v1/videos/retrieve", bearerAuth);
chatRoutes.use("/v1/videos/retrieve", requestTimeout());
chatRoutes.use("/v1/videos/retrieve", tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));

chatRoutes.post("/v1/chat/completions", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const correlationId = c.get("correlationId") as string | undefined;

  const idempotencyKey = c.req.header("Idempotency-Key");
  if (idempotencyKey) {
    const idemCheck = await checkIdempotencyKey(idempotencyKey);
    if (idemCheck && !idemCheck.isNew && idemCheck.existingResponse) {
      return c.json(idemCheck.existingResponse);
    }
  }

  // Start a span for the entire request lifecycle
  return withSpan(
    "chat.completion",
    async (span) => {
      span?.setAttribute("user.id", userId);
      if (correlationId) span?.setAttribute("correlation.id", correlationId);

      const parsed = chatCompletionSchema.safeParse(await c.req.json());
      if (!checkRequestBodySizeLimit(c)) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "request_too_large");
        return c.json({ error: { message: "Request body too large", type: "invalid_request_error", code: "request_too_large" } }, 413);
      }
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
        return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error", code: "model_not_found" } }, 400);
      }

      const bal = await getBalance(userId);
      if (Number(bal.balanceCents) <= 0) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "insufficient_credits");
        const payReq = createInsufficientCreditsPayReq(c.req.url, 1);
        c.header("Pay-Req", JSON.stringify(payReq));
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
        if (idempotencyKey) {
          await storeIdempotencyResult(idempotencyKey, json);
        }
        return c.json(json, { headers: { "x-provider": provider, "X-Correlation-ID": correlationId || "" } });
      } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", (err as { type?: string }).type ?? "inference_error");
        span?.setAttribute("http.status_code", status);
        console.error(`[chat] /v1/chat/completions error:`, err);
        return c.json({ error: { message: "An internal error occurred", type: (err as { type?: string }).type ?? "inference_error" } }, status as Parameters<typeof c.json>[1]);
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
  if (!checkRequestBodySizeLimit(c)) {
    return c.json({ error: { message: "Request body too large", type: "invalid_request_error", code: "request_too_large" } }, 413);
  }
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, ...rest } = parsed.data;
  const stream = (parsed.data as { stream?: boolean }).stream;

  const modelInfo = getModel(model);
  if (!modelInfo) return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 400);

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    const payReq = createInsufficientCreditsPayReq(c.req.url, 1);
    c.header("Pay-Req", JSON.stringify(payReq));
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

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
    console.error(`[chat] /v1/completions error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: (err as { type?: string }).type ?? "inference_error" } }, status as Parameters<typeof c.json>[1]);
  }
});

chatRoutes.post("/v1/embeddings", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = embeddingsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model } = parsed.data;
  const input = parsed.data.input as string | string[];

  const modelInfo = getModel(model);
  if (!modelInfo && !model.toLowerCase().includes('embedding')) {
    return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 400);
  }

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    const payReq = createInsufficientCreditsPayReq(c.req.url, 1);
    c.header("Pay-Req", JSON.stringify(payReq));
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  try {
    const resp = await venice.embeddings({ model, input });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Embedding failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }
    const json = await resp.json();
    const inputStr = typeof input === 'string' ? input : input.join('');
    const inputTokens = json.usage?.prompt_tokens ?? estimateTokens(inputStr);
    const requestId = crypto.randomUUID();

    if (modelInfo) {
      const costDetail = calculateCost(model, inputTokens, 0);
      const markupCents = Number(costDetail.markupCents);
      const totalCents = Number(costDetail.totalCents);
      await deductCredits(userId, Number(costDetail.costCents), markupCents, totalCents, model, "venice", apiKey?.id ?? "unknown", inputTokens, 0, requestId);
      if (apiKey) {
        trackSpend(apiKey.keyHash, totalCents).catch(() => {});
      }
    }

    return c.json(json);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/embeddings error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

const imageGenerationSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  n: z.number().int().positive().max(10).optional(),
  size: z.string().optional(),
});

chatRoutes.post("/v1/images/generations", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

const parsed = imageGenerationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, n, size } = parsed.data;

  const imageCount = n ?? 1;
  const modelDef = getModel(model);
  const pricePerImage = modelDef?.creditsPerMillionOutput 
    ? Math.ceil((modelDef.creditsPerMillionOutput / 1_000_000) * 100) 
    : 10;
  const totalCents = imageCount * pricePerImage;

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    const payReq = createInsufficientCreditsPayReq(c.req.url, Math.max(1, totalCents));
    c.header("Pay-Req", JSON.stringify(payReq));
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  try {
    const resp = await venice.imageGeneration({ model, prompt, n: imageCount, size });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Image generation failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }
    const json = await resp.json();

    const requestId = crypto.randomUUID();
    await deductCredits(userId, totalCents - 1, 1, totalCents, model, "venice", apiKey?.id ?? "unknown", 0, 0, requestId);

    if (apiKey) {
      trackSpend(apiKey.keyHash, totalCents).catch(() => {});
    }
    return c.json(json);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/images/generations error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

const audioSpeechSchema = z.object({
  model: z.string().min(1).max(100),
  input: z.string().min(1).max(10000),
  voice: z.string().optional(),
  response_format: z.string().optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
});

chatRoutes.post("/v1/audio/speech", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = audioSpeechSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, input, voice, response_format, speed } = parsed.data;

  const inputTokens = estimateTokens(input);
  const totalCents = Math.max(1, Math.ceil(inputTokens / 1000));

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    const payReq = createInsufficientCreditsPayReq(c.req.url, totalCents);
    c.header("Pay-Req", JSON.stringify(payReq));
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

    try {
    const resp = await venice.textToSpeech({ model, input, voice, response_format, speed });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Text-to-speech failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }

    const requestId = crypto.randomUUID();
    await deductCredits(userId, totalCents - 1, 1, totalCents, model, "venice", apiKey?.id ?? "unknown", inputTokens, 0, requestId);

    if (apiKey) {
      trackSpend(apiKey.keyHash, totalCents).catch(() => {});
    }

    const audioBuffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") ?? "audio/mpeg";
    return c.body(audioBuffer, 200, { "Content-Type": contentType });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/audio/speech error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

chatRoutes.post("/v1/audio/transcriptions", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const formData = await c.req.formData();
  const model = formData.get("model") as string;
  const file = formData.get("file") as File | null;
  const language = formData.get("language") as string | null;
  const prompt = formData.get("prompt") as string | null;
  const response_format = formData.get("response_format") as string | null;
  const temperature = formData.get("temperature") as string | null;

  if (!model) {
    return c.json({ error: { message: "model is required", type: "invalid_request_error" } }, 400);
  }

  if (!file) {
    return c.json({ error: { message: "file is required", type: "invalid_request_error" } }, 400);
  }

  const modelDef = getModel(model);
  if (!modelDef && model !== WHISPER_MODEL) {
    return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 400);
  }

  const transcriptionCost = 1;
  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    const payReq = createInsufficientCreditsPayReq(c.req.url, transcriptionCost);
    c.header("Pay-Req", JSON.stringify(payReq));
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  try {
    const resp = await venice.transcription({
      model,
      file,
      language: language ?? undefined,
      prompt: prompt ?? undefined,
      response_format: response_format ?? undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Transcription failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }

    const json = await resp.json();

    const requestId = crypto.randomUUID();
    await deductCredits(userId, transcriptionCost - 1, 1, transcriptionCost, model, "venice", apiKey?.id ?? "unknown", 0, 0, requestId);

    if (apiKey) {
      trackSpend(apiKey.keyHash, transcriptionCost).catch(() => {});
    }

    return c.json(json);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/audio/transcriptions error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

const videoGenerationSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  duration: z.string().optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.string().optional(),
  image_url: z.string().url().optional(),
});

chatRoutes.post("/v1/videos/generations", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = videoGenerationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, duration, aspect_ratio, resolution, image_url } = parsed.data;

  const videoModel = VIDEO_MODELS[model];
  if (!videoModel) {
    return c.json({ error: { message: `Invalid video model '${model}'. Available: ${Object.keys(VIDEO_MODELS).join(", ")}`, type: "invalid_request_error" } }, 400);
  }

  const totalCents = Math.round(videoModel.price * 100);

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    const payReq = createInsufficientCreditsPayReq(c.req.url, totalCents);
    c.header("Pay-Req", JSON.stringify(payReq));
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  try {
    const { queueId, status } = await venice.videoGeneration({
      model,
      prompt,
      duration,
      aspect_ratio,
      resolution,
      image_url,
    });

    const requestId = crypto.randomUUID();
    await deductCredits(userId, totalCents - 1, 1, totalCents, model, "venice", apiKey?.id ?? "unknown", 0, 0, requestId);

    if (apiKey) {
      trackSpend(apiKey.keyHash, totalCents).catch(() => {});
    }

    return c.json({
      id: `vid_${queueId}`,
      object: "video",
      status,
      queue_id: queueId,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/videos/generations error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

chatRoutes.get("/v1/videos/retrieve", bearerAuth, async (c) => {
  const queueId = c.req.query("queue_id");
  if (!queueId) {
    return c.json({ error: { message: "queue_id required", type: "invalid_request_error" } }, 400);
  }

  try {
    const result = await venice.retrieveVideo(queueId);
    return c.json({
      id: `vid_${queueId}`,
      object: "video",
      status: result.status === "COMPLETED" ? "completed" : "processing",
      video_url: result.video_url || result.download_url,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/videos/retrieve error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});
