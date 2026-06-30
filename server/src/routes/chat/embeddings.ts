import { Hono } from "hono";
import { bearerAuth } from "../../auth/middleware.js";
import { getModel, calculateCost, estimateTokens } from "../../inference/models.js";
import * as venice from "../../inference/venice.js";
import { getBalance, deductCredits } from "../../credits/index.js";
import { tokenBucket } from "../../middleware/rate-limit.js";
import { requestTimeout } from "../../middleware/timeout.js";
import { validationError } from "../../lib/validation.js";
import type { OmaEnv } from "../../types.js";
import { embeddingsSchema } from "./validation.js";
import { createInsufficientCreditsPayReq } from "../../credits/insufficient-credits.js";
import { trackApiKeySpend, inferenceErrorHandler } from "../../inference/handler-helpers.js";

export const embeddingsRouter = new Hono<OmaEnv>();

embeddingsRouter.use("/v1/embeddings", bearerAuth);
embeddingsRouter.use("/v1/embeddings", requestTimeout());
embeddingsRouter.use(
  "/v1/embeddings",
  tokenBucket({ refillRate: 10, bucketSize: 30, rpmLimit: 30 }),
);

embeddingsRouter.post("/v1/embeddings", async (c) => {
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");

  const parsed = embeddingsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { model } = parsed.data;
  const input = parsed.data.input as string | string[];

  const modelInfo = await getModel(model);
  if (!modelInfo && !model.toLowerCase().includes("embedding")) {
    return c.json(
      {
        error: {
          message: `Model '${model}' not found`,
          type: "invalid_request_error",
        },
      },
      400,
    );
  }

  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return createInsufficientCreditsPayReq(c, 1, Number(bal.balanceCents));
  }

  try {
    const resp = await venice.embeddings({ model, input });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return c.json(
        { error: { message: text || "Embedding failed", type: "inference_error" } },
        resp.status as Parameters<typeof c.json>[1],
      );
    }
    const json = await resp.json();
    const inputStr = typeof input === "string" ? input : input.join("");
    const inputTokens = json.usage?.prompt_tokens ?? estimateTokens(inputStr);
    const requestId = crypto.randomUUID();

    if (modelInfo) {
      const costDetail = await calculateCost(model, inputTokens, 0);
      const markupCents = Number(costDetail.markupCents);
      const totalCents = Number(costDetail.totalCents);
      await deductCredits(
        userId,
        Number(costDetail.costCents),
        markupCents,
        totalCents,
        model,
        "venice",
        apiKey?.id ?? "unknown",
        inputTokens,
        0,
        requestId,
      );
      trackApiKeySpend(apiKey?.keyHash, totalCents);
    }

    return c.json(json);
  } catch (err) {
    return inferenceErrorHandler(c, err, "/v1/embeddings");
  }
});
