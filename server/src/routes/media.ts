/**
 * Media generation routes — /v1/images/generations + /v1/videos/*
 *
 * Restored from the pre-`d6289ec` images.ts/video.ts routers, re-based
 * on the current stack: bearerAuth, tokenBucket, requestTimeout from the
 * current middleware, and flat-rate credit billing through
 * creditBalances (media has no token pricing, so recordUsage's token
 * math does not apply).
 */
import { z } from "zod";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { eq, sql } from "drizzle-orm";
import { bearerAuth } from "../auth/middleware.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { creditBalances, usageRecords } from "../db/schema.js";
import { tokenBucket } from "../middleware/rate-limit.js";
import { requestTimeout } from "../middleware/timeout.js";
import { validationError } from "../lib/validation.js";
import { logger } from "../lib/logger.js";
import type { Context } from "hono";
import type { OmaEnv } from "../types.js";
import {
  imageGeneration,
  videoQuote,
  videoGeneration,
  retrieveVideo,
} from "../inference/media.js";

const imageGenerationSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  n: z.number().int().positive().max(10).optional(),
  size: z.string().optional(),
});

const videoGenerationSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  duration: z.string().optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.string().optional(),
  image_url: z.string().url().optional(),
});

// Flat user-facing prices (USD, cents). Venice's /video/quote endpoint
// can quote exact prices; images are billed per-image at a flat rate.
const IMAGE_PRICE_CENTS = 10;
const VIDEO_PRICE_CENTS = 92;

function errStatus(err: unknown): ContentfulStatusCode {
  const s = (err as { status?: number }).status;
  return (typeof s === "number" && s >= 400 && s < 600 ? s : 502) as ContentfulStatusCode;
}

export const mediaRouter = new Hono<OmaEnv>();

// Apply bearerAuth and requestTimeout automatically to all media endpoints.
mediaRouter.use("/v1/images/*", bearerAuth, requestTimeout());
mediaRouter.use("/v1/videos/*", bearerAuth, requestTimeout());

mediaRouter.use(
  "/v1/images/generations",
  tokenBucket({ refillRate: 5, bucketSize: 10, rpmLimit: 10 }),
);

mediaRouter.use(
  "/v1/videos/quote",
  tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }),
);

mediaRouter.use(
  "/v1/videos/generations",
  tokenBucket({ refillRate: 2, bucketSize: 5, rpmLimit: 5 }),
);

mediaRouter.use(
  "/v1/videos/retrieve",
  tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }),
);

/**
 * Charge a flat media cost against the user's credit balance and record
 * a usage row. Returns a 402 payment-required response when the user has
 * no balance.
 */
async function chargeFlat(
  c: Context<OmaEnv>,
  userId: string,
  apiKeyId: string,
  model: string,
  costCents: number,
  kind: "image" | "video",
): Promise<{ ok: true; requestId: string } | { ok: false; response: Response }> {
  const rows = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);
  const balance = Number(rows[0]?.balanceCents ?? 0);
  if (balance < costCents) {
    return {
      ok: false,
      response: c.json(
        {
          error: {
            message: "Insufficient credits. Add credits to continue.",
            type: "insufficient_quota",
          },
        },
        402,
      ),
    };
  }

  const requestId = `${kind}-${crypto.randomUUID()}`;
  await db.transaction(async (tx) => {
    await tx
      .update(creditBalances)
      .set({
        balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric - ${costCents}::numeric, 0)`,
        totalUsedCents: sql`${creditBalances.totalUsedCents}::numeric + ${costCents}::numeric`,
        lastActivityAt: sql`NOW()`,
      })
      .where(eq(creditBalances.userId, userId));

    await tx.insert(usageRecords).values({
      requestId,
      userId,
      model,
      provider: "venice",
      inputTokens: 0,
      outputTokens: 0,
      costCents: costCents.toFixed(4),
      markupCents: "0",
      totalCents: costCents.toFixed(4),
      status: "completed",
      apiKeyId: apiKeyId === "unknown" ? null : apiKeyId,
    });
  });

  return { ok: true, requestId };
}

/**
 * Refund a previously-charged media cost. Reverses the balance update and
 * marks the recorded usage row as refunded. Used when the upstream call
 * fails after a successful charge — we never want to bill for a generation
 * the user didn't receive.
 */
async function refundFlat(
  userId: string,
  requestId: string,
  refundCents: number,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(creditBalances)
        .set({
          balanceCents: sql`${creditBalances.balanceCents}::numeric + ${refundCents}::numeric`,
          totalUsedCents: sql`GREATEST(${creditBalances.totalUsedCents}::numeric - ${refundCents}::numeric, 0)`,
        })
        .where(eq(creditBalances.userId, userId));
      await tx
        .update(usageRecords)
        .set({ status: "refunded" })
        .where(eq(usageRecords.requestId, requestId));
    });
  } catch (err) {
    logger.error(
      { err, userId, requestId, refundCents },
      "[media] refund failed — credit may need manual reconciliation",
    );
  }
}

mediaRouter.post("/v1/images/generations", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = imageGenerationSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, n, size } = parsed.data;
  const imageCount = n ?? 1;
  const totalCents = imageCount * IMAGE_PRICE_CENTS;

  const charged = await chargeFlat(
    c,
    userId,
    apiKey?.id ?? "unknown",
    model,
    totalCents,
    "image",
  );
  if (!charged.ok) return charged.response;

  try {
    // Venice generates one image per call and rejects an `n` param,
    // so loop n times and collect URLs.
    const urls: string[] = [];
    for (let i = 0; i < imageCount; i++) {
      const json = await imageGeneration({ model, prompt, size });
      const img = json.images?.[0]?.url;
      if (img) urls.push(img);
    }
    // OpenAI-compatible shape the frontend expects: { data: [{ url }] }
    return c.json({
      object: "images.response",
      data: urls.map((url) => ({ url })),
    });
  } catch (err) {
    logger.error(
      { model, userId, error: (err as Error).message },
      "[media] image generation failed after charge",
    );
    await refundFlat(userId, charged.requestId, totalCents);
    return c.json(
      {
        error: {
          message:
            (err as Error).message || "Image generation failed",
          type: "inference_error",
        },
      },
      errStatus(err),
    );
  }
});

mediaRouter.post("/v1/videos/quote", async (c) => {
  const parsed = videoGenerationSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, duration, aspect_ratio, resolution, image_url } =
    parsed.data;

  try {
    const quote = await videoQuote({
      model,
      prompt,
      duration,
      aspect_ratio,
      resolution,
      image_url,
    });
    return c.json({
      object: "video.quote",
      model,
      price: VIDEO_PRICE_CENTS / 100,
      currency: "usd",
      estimated_seconds: quote.estimated_seconds,
      provider_price: quote.price,
      provider_currency: quote.currency,
    });
  } catch (err) {
    return c.json(
      {
        error: {
          message: (err as Error).message || "Quote failed",
          type: "inference_error",
        },
      },
      errStatus(err),
    );
  }
});

mediaRouter.post("/v1/videos/generations", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = videoGenerationSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model, prompt, duration, aspect_ratio, resolution, image_url } =
    parsed.data;

  const charged = await chargeFlat(
    c,
    userId,
    apiKey?.id ?? "unknown",
    model,
    VIDEO_PRICE_CENTS,
    "video",
  );
  if (!charged.ok) return charged.response;

  try {
    const { queueId } = await videoGeneration({
      model,
      prompt,
      duration,
      aspect_ratio,
      resolution,
      image_url,
    });
    return c.json({
      id: `vid_${queueId}`,
      object: "video",
      status: "queued",
      queue_id: queueId,
    });
  } catch (err) {
    logger.error(
      { model, userId, error: (err as Error).message },
      "[media] video queue failed after charge",
    );
    await refundFlat(userId, charged.requestId, VIDEO_PRICE_CENTS);
    return c.json(
      {
        error: {
          message: (err as Error).message || "Video generation failed",
          type: "inference_error",
        },
      },
      errStatus(err),
    );
  }
});

const videoRetrieveQuerySchema = z.object({
  queue_id: z.string().min(1).max(512),
  model: z.string().trim().min(1).max(128).optional(),
});

mediaRouter.get("/v1/videos/retrieve", async (c) => {
  const parsed = videoRetrieveQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid queue_id",
          type: "invalid_request_error",
        },
      },
      400,
    );
  }
  const { queue_id: queueId, model } = parsed.data;

  try {
    const result = await retrieveVideo(queueId, model || undefined);
    return c.json({
      id: `vid_${queueId}`,
      object: "video",
      status: result.status === "COMPLETED" ? "completed" : "processing",
      video_url: result.video_url || result.download_url,
    });
  } catch (err) {
    return c.json(
      {
        error: {
          message: (err as Error).message || "Video retrieval failed",
          type: "inference_error",
        },
      },
      errStatus(err),
    );
  }
});

// Keep config referenced so TS doesn't prune the import if envs change.
void config;
