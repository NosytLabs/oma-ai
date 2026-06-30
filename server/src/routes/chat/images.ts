import { z } from "zod";
import { Hono } from "hono";
import { bearerAuth } from "../../auth/middleware.js";
import { getModel } from "../../inference/models.js";
import * as venice from "../../inference/venice.js";
import { getBalance } from "../../credits/index.js";
import { tokenBucket } from "../../middleware/rate-limit.js";
import { requestTimeout } from "../../middleware/timeout.js";
import { validationError } from "../../lib/validation.js";
import type { OmaEnv } from "../../types.js";
import { createInsufficientCreditsPayReq } from "../../credits/insufficient-credits.js";
import { chargeAndTrack, trackApiKeySpend, inferenceErrorHandler } from "../../inference/handler-helpers.js";

const imageGenerationSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  n: z.number().int().positive().max(10).optional(),
  size: z.string().optional(),
});

export const imagesRouter = new Hono<OmaEnv>();

imagesRouter.use("/v1/images/generations", bearerAuth);
imagesRouter.use("/v1/images/generations", requestTimeout());
imagesRouter.use(
  "/v1/images/generations",
  tokenBucket({ refillRate: 5, bucketSize: 10, rpmLimit: 10 }),
);

imagesRouter.post("/v1/images/generations", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = imageGenerationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, n, size } = parsed.data;

  const imageCount = n ?? 1;
  const modelDef = await getModel(model);
  const pricePerImage = modelDef?.creditsPerMillionOutput
    ? Math.ceil((modelDef.creditsPerMillionOutput / 1_000_000) * 100)
    : 10;
  const totalCents = imageCount * pricePerImage;

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return createInsufficientCreditsPayReq(c, Math.max(1, totalCents), Number(bal.balanceCents));
  }

  try {
    const resp = await venice.imageGeneration({
      model,
      prompt,
      n: imageCount,
      size,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json(
        {
          error: {
            message: text || "Image generation failed",
            type: "inference_error",
          },
        },
        resp.status as Parameters<typeof c.json>[1],
      );
    }
    const json = await resp.json();

    const _requestId = await chargeAndTrack(userId, totalCents, model, "venice", apiKey?.id ?? "unknown", 0);
    trackApiKeySpend(apiKey?.keyHash, totalCents);
    return c.json(json);
  } catch (err) {
    return inferenceErrorHandler(c, err, "/v1/images/generations");
  }
});
