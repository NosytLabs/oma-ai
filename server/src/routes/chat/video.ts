import { z } from "zod";
import { Hono } from "hono";
import { bearerAuth } from "../../auth/middleware.js";
import { VIDEO_MODELS } from "../../inference/models.js";
import * as venice from "../../inference/venice.js";
import { getBalance, deductCredits } from "../../credits/index.js";
import { tokenBucket } from "../../middleware/rate-limit.js";
import { requestTimeout } from "../../middleware/timeout.js";
import { trackSpend } from "../../middleware/spend-limit.js";
import { validationError } from "../../lib/validation.js";
import type { OmaEnv } from "../../types.js";
import { createInsufficientCreditsPayReq } from "./validation.js";

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
videoRouter.use("/v1/videos/retrieve", bearerAuth);
videoRouter.use("/v1/videos/retrieve", requestTimeout());
videoRouter.use("/v1/videos/retrieve", tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }));

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
    const payReq = createInsufficientCreditsPayReq(c.req.url, totalCents);
    c.header("Pay-Req", JSON.stringify(payReq));
    return c.json({ error: { message: "Insufficient credits", type: "insufficient_quota" } }, 402);
  }

  try {
    const { queueId, status } = await venice.videoGeneration({ model, prompt, duration, aspect_ratio, resolution, image_url });

    const requestId = crypto.randomUUID();
    await deductCredits(userId, totalCents - 1, 1, totalCents, model, "venice", apiKey?.id ?? "unknown", 0, 0, requestId);

    if (apiKey) trackSpend(apiKey.keyHash, totalCents).catch(() => {});

    return c.json({ id: `vid_${queueId}`, object: "video", status, queue_id: queueId });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/videos/generations error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
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
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "inference_error";
    console.error(`[chat] /v1/videos/retrieve error:`, err);
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});
