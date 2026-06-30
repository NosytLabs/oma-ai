import { z } from "zod";
import { Hono } from "hono";
import { bearerAuth } from "../../auth/middleware.js";
import { getModel, WHISPER_MODEL, estimateTokens } from "../../inference/models.js";
import * as venice from "../../inference/venice.js";
import { getBalance } from "../../credits/index.js";
import { tokenBucket } from "../../middleware/rate-limit.js";
import { requestTimeout } from "../../middleware/timeout.js";
import { spendLimit } from "../../middleware/spend-limit.js";
import { validationError } from "../../lib/validation.js";
import type { OmaEnv } from "../../types.js";
import { createInsufficientCreditsPayReq } from "../../credits/insufficient-credits.js";
import { chargeAndTrack, trackApiKeySpend, inferenceErrorHandler } from "../../inference/handler-helpers.js";

const audioSpeechSchema = z.object({
  model: z.string().min(1).max(100),
  input: z.string().min(1).max(10000),
  voice: z.string().optional(),
  response_format: z.string().optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
});

export const audioRouter = new Hono<OmaEnv>();

audioRouter.use("/v1/audio/speech", bearerAuth);
audioRouter.use("/v1/audio/speech", requestTimeout());
audioRouter.use("/v1/audio/speech", tokenBucket({ refillRate: 10, bucketSize: 20, rpmLimit: 20 }));
// H4: per-API-key daily spend cap. Audio transcription can be abused
// by repeatedly submitting large files; gate the same way as chat.
audioRouter.use("/v1/audio/speech", spendLimit());
audioRouter.use("/v1/audio/transcriptions", bearerAuth);
audioRouter.use("/v1/audio/transcriptions", requestTimeout());
audioRouter.use("/v1/audio/transcriptions", tokenBucket({ refillRate: 10, bucketSize: 20, rpmLimit: 20 }));
audioRouter.use("/v1/audio/transcriptions", spendLimit());

audioRouter.post("/v1/audio/speech", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = audioSpeechSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, input, voice, response_format, speed } = parsed.data;

  const inputTokens = estimateTokens(input);
  const totalCents = Math.max(1, Math.ceil(inputTokens / 1000));

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return createInsufficientCreditsPayReq(c, totalCents, Number(bal.balanceCents));
  }

  try {
    const resp = await venice.textToSpeech({ model, input, voice, response_format, speed });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Text-to-speech failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }

    const _requestId = await chargeAndTrack(userId, totalCents, model, "venice", apiKey?.id ?? "unknown", inputTokens);
    trackApiKeySpend(apiKey?.keyHash, totalCents);

    const audioBuffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") ?? "audio/mpeg";
    return c.body(audioBuffer, 200, { "Content-Type": contentType });
  } catch (err) {
    return inferenceErrorHandler(c, err, "/v1/audio/speech");
  }
});

audioRouter.post("/v1/audio/transcriptions", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const formData = await c.req.formData();
  const model = formData.get("model") as string;
  const file = formData.get("file") as File | null;
  const language = formData.get("language") as string | null;
  const prompt = formData.get("prompt") as string | null;
  const rfmt = formData.get("response_format") as string | null;
  const temperature = formData.get("temperature") as string | null;

  if (!model) return c.json({ error: { message: "model is required", type: "invalid_request_error" } }, 400);
  if (!file) return c.json({ error: { message: "file is required", type: "invalid_request_error" } }, 400);

  const modelDef = await getModel(model);
  if (!modelDef && model !== WHISPER_MODEL) {
    return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 400);
  }

  const transcriptionCost = 1;
  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return createInsufficientCreditsPayReq(c, transcriptionCost, Number(bal.balanceCents));
  }

  try {
    const resp = await venice.transcription({
      model, file,
      language: language ?? undefined,
      prompt: prompt ?? undefined,
      response_format: rfmt ?? undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json({ error: { message: text || "Transcription failed", type: "inference_error" } }, resp.status as Parameters<typeof c.json>[1]);
    }

    const json = await resp.json();
    const _requestId = await chargeAndTrack(userId, transcriptionCost, model, "venice", apiKey?.id ?? "unknown", 0);
    trackApiKeySpend(apiKey?.keyHash, transcriptionCost);
    return c.json(json);
  } catch (err) {
    return inferenceErrorHandler(c, err, "/v1/audio/transcriptions");
  }
});
