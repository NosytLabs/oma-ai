import { Hono } from "hono";
import { SpanKind } from "@opentelemetry/api";
import { bearerAuth } from "../../auth/middleware.js";
import { handleChatCompletion } from "../../inference/router.js";
import { getModel } from "../../inference/models.js";
import { getBalance } from "../../credits/index.js";
import { tokenBucket, modelRateLimit } from "../../middleware/rate-limit.js";
import { requestTimeout } from "../../middleware/timeout.js";
import { spendLimit } from "../../middleware/spend-limit.js";
import { validationError } from "../../lib/validation.js";
import {
  checkIdempotencyKey,
  storeIdempotencyResult,
} from "../../middleware/idempotency.js";
import { withSpan } from "../../tracing.js";
import type { OmaEnv } from "../../types.js";
import {
  chatCompletionSchema,
  checkRequestBodySizeLimit,
} from "./validation.js";
import { createInsufficientCreditsPayReq } from "../../credits/insufficient-credits.js";
import { trackApiKeySpend, inferenceErrorHandler } from "../../inference/handler-helpers.js";

export const chatCompletionsRouter = new Hono<OmaEnv>();

chatCompletionsRouter.use("/v1/chat/completions", bearerAuth);
chatCompletionsRouter.use("/v1/chat/completions", requestTimeout());
chatCompletionsRouter.use(
  "/v1/chat/completions",
  tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }),
);
chatCompletionsRouter.use("/v1/chat/completions", modelRateLimit());
chatCompletionsRouter.use("/v1/chat/completions", spendLimit());

chatCompletionsRouter.post("/v1/chat/completions", async (c) => {
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

  return withSpan(
    "chat.completion",
    async (span) => {
      span?.setAttribute("user.id", userId);
      if (correlationId) span?.setAttribute("correlation.id", correlationId);

      const parsed = chatCompletionSchema.safeParse(await c.req.json());
      if (!checkRequestBodySizeLimit(c)) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "request_too_large");
        return c.json(
          {
            error: {
              message: "Request body too large",
              type: "invalid_request_error",
              code: "request_too_large",
            },
          },
          413,
        );
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

      const modelInfo = await getModel(model);
      if (!modelInfo) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "model_not_found");
        return c.json(
          {
            error: {
              message: `Model '${model}' not found`,
              type: "invalid_request_error",
              code: "model_not_found",
            },
          },
          400,
        );
      }

      // ponytail: model allowlist — null/empty = no restriction.
      if (apiKey?.allowedModels && apiKey.allowedModels.length > 0) {
        if (!apiKey.allowedModels.includes(model)) {
          span?.setAttribute("error", true);
          span?.setAttribute("error.type", "model_not_allowed");
          return c.json(
            {
              error: {
                message: `Model '${model}' is not allowed for this API key`,
                type: "forbidden",
                code: "model_not_allowed",
              },
            },
            403,
          );
        }
      }

      const bal = await getBalance(userId);
      if (Number(bal.balanceCents) <= 0) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "insufficient_credits");
        return createInsufficientCreditsPayReq(c, 1, Number(bal.balanceCents));
      }

      const payload = { model, messages, stream: !!stream, ...rest };
      const apiKeyId = apiKey?.id ?? "unknown";

      try {
        const {
          response,
          provider,
          inputTokens,
          outputTokens,
        } = await handleChatCompletion(userId, apiKeyId, payload, c.req.raw.signal);
        span?.setAttribute("llm.provider", provider);
        if (inputTokens) span?.setAttribute("llm.tokens.input", inputTokens);
        if (outputTokens)
          span?.setAttribute("llm.tokens.output", outputTokens);

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
        const totalCents =
          json.usage?.totalCents ??
          Math.round(parseFloat(json.usage?.total_cost ?? "0") * 100);
        if (totalCents > 0) {
          trackApiKeySpend(apiKey?.keyHash, Math.ceil(totalCents));
        }
        if (idempotencyKey) {
          await storeIdempotencyResult(idempotencyKey, json);
        }
        return c.json(json, {
          headers: {
            "x-provider": provider,
            "X-Correlation-ID": correlationId || "",
          },
        });
      } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        span?.setAttribute("error", true);
        span?.setAttribute(
          "error.type",
          (err as { type?: string }).type ?? "inference_error",
        );
        span?.setAttribute("http.status_code", status);
        return inferenceErrorHandler(c, err, "/v1/chat/completions");
      }
    },
    undefined,
    SpanKind.SERVER,
  );
});
