import { z } from "zod";
import { Hono } from "hono";
import { bearerAuth } from "../../auth/middleware.js";
import { VIDEO_MODELS } from "../../inference/models.js";
import * as venice from "../../inference/venice.js";
import { getBalance } from "../../credits/index.js";
import { tokenBucket } from "../../middleware/rate-limit.js";
import { requestTimeout } from "../../middleware/timeout.js";
import { spendLimit } from "../../middleware/spend-limit.js";
import { validationError } from "../../lib/validation.js";
import type { OmaEnv } from "../../types.js";
import { createInsufficientCreditsPayReq } from "../../credits/insufficient-credits.js";
import { chargeAndTrack, trackApiKeySpend, inferenceErrorHandler } from "../../inference/handler-helpers.js";

const videoGenerationSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  duration: z.string().optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.string().optional(),
  image_url: z.string().url().optional(),
});

export const videoRouter = new Hono<OmaEnv>();

videoRouter.use("/v1/videos/generations", bearerAuth);
videoRouter.use("/v1/videos/generations", requestTimeout());
videoRouter.use("/v1/videos/generations", tokenBucket({ refillRate: 2, bucketSize: 5, rpmLimit: 5 }));
// H4: per-API-key daily spend cap. Video endpoints can drain a user's
// allowance quickly (each generation is ~$0.90+), so apply the same
// spendLimit() gate as chat/completions to cap daily spend.
videoRouter.use("/v1/videos/generations", spendLimit());
videoRouter.use("/v1/videos/quote", bearerAuth);
videoRouter.use("/v1/videos/quote", requestTimeout());
videoRouter.use("/v1/videos/quote", tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));
videoRouter.use("/v1/videos/retrieve", bearerAuth);
videoRouter.use("/v1/videos/retrieve", requestTimeout());
videoRouter.use("/v1/videos/retrieve", tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));

videoRouter.post("/v1/videos/quote", async (c) => {
  const parsed = videoGenerationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, duration, aspect_ratio, resolution, image_url } = parsed.data;

  const videoModel = VIDEO_MODELS[model];
  if (!videoModel) {
    return c.json({ error: { message: `Invalid video model '${model}'. Available: ${Object.keys(VIDEO_MODELS).join(", ")}`, type: "invalid_request_error" } }, 400);
  }

  try {
    const quote = await venice.videoQuote({ model, prompt, duration, aspect_ratio, resolution, image_url });
    return c.json({
      object: "video.quote",
      model,
      // OMA price is what the user will actually be charged (includes markup)
      price: videoModel.price,
      currency: "usd",
      estimated_seconds: quote.estimated_seconds,
      // Raw Venice cost for transparency
      provider_price: quote.price,
      provider_currency: quote.currency,
    });
  } catch (err) {
    return inferenceErrorHandler(c, err, "/v1/videos/quote");
  }
});

videoRouter.post("/v1/videos/generations", async (c) => {
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
    return createInsufficientCreditsPayReq(c, totalCents, Number(bal.balanceCents));
  }

  try {
    const { queueId, status } = await venice.videoGeneration({ model, prompt, duration, aspect_ratio, resolution, image_url });

    const _requestId = await chargeAndTrack(userId, totalCents, model, "venice", apiKey?.id ?? "unknown", 0);
    trackApiKeySpend(apiKey?.keyHash, totalCents);

    return c.json({ id: `vid_${queueId}`, object: "video", status, queue_id: queueId });
  } catch (err) {
    return inferenceErrorHandler(c, err, "/v1/videos/generations");
  }
});

videoRouter.get("/v1/videos/retrieve", bearerAuth, async (c) => {
  const queueId = c.req.query("queue_id");
  if (!queueId) return c.json({ error: { message: "queue_id required", type: "invalid_request_error" } }, 400);

  try {
    const result = await venice.retrieveVideo(queueId);
    return c.json({
      id: `vid_${queueId}`,
      object: "video",
      status: result.status === "COMPLETED" ? "completed" : "processing",
      video_url: result.video_url || result.download_url,
    });
  } catch (err) {
    return inferenceErrorHandler(c, err, "/v1/videos/retrieve");
  }
});
