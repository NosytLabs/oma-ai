import { Hono } from "hono";
import type { Context, Next } from "hono";
import { SpanKind } from "@opentelemetry/api";
import { bearerAuth } from "../../auth/middleware.js";
import { config } from "../../config.js";
import { paymentMiddleware } from "../../x402/facilitator.js";
import { CHAT_COMPLETIONS_BAZAAR } from "../../x402/v2.js";
import { handleChatCompletion } from "../../inference/router.js";
import { getModel } from "../../inference/models.js";
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
import { trackApiKeySpend, inferenceErrorHandler } from "../../inference/handler-helpers.js";
import {
  FREE_GUEST_USER_ID,
  isFreeGuestModel,
} from "./free-guest.js";

export const chatCompletionsRouter = new Hono<OmaEnv>();
export { isFreeGuestModel, FREE_GUEST_USER_ID, isSyntheticGuestUserId } from "./free-guest.js";

/**
 * x402 pay-per-request: when enabled (TREASURY_BASE_ADDRESS set and
 * X402_CHAT_PRICE_USD > 0), a request carrying PAYMENT-SIGNATURE settles a
 * flat-rate USDC payment instead of using an API key, and an unauthenticated
 * request receives the spec's 402 + PAYMENT-REQUIRED challenge rather than a
 * 401. Requests with normal credentials keep the existing bearerAuth path
 * untouched. Test/dev deploys without a treasury keep the legacy 401.
 */
const X402_CHAT_PRICE = Number(config.X402_CHAT_PRICE_USD);
const x402ChatEnabled =
  Boolean(config.TREASURY_BASE_ADDRESS) && X402_CHAT_PRICE > 0;
const x402ChatMiddleware = x402ChatEnabled
  ? paymentMiddleware({
      pricing: { "/v1/chat/completions": config.X402_CHAT_PRICE_USD },
      payeeAddress: config.TREASURY_BASE_ADDRESS as string,
      // Bazaar discovery: lets CDP's /discovery/resources index catalog the
      // endpoint from its own 402 challenge.
      bazaar: { "/v1/chat/completions": CHAT_COMPLETIONS_BAZAAR },
    })
  : null;

/**
 * Auth gate for chat completions. Exported for unit tests of the free-guest path.
 * Free OMA-AI (gonka) models skip bearer/x402 entirely.
 */
export async function authOrPayment(c: Context<OmaEnv>, next: Next) {
  // Free chat: OMA-AI provider models (Gonka/OpenBroker) bypass auth entirely.
  // Cheap to resell — website guests can use them without sign-in / API key.
  // Rate limiting still applies (tokenBucket below).
  // Prefer Authorization / API-key cookie when present so logged-in users keep
  // real userId attribution while still using free models.
  const hasBearer = Boolean(c.req.header("Authorization"));
  const hasKeyCookie = /(?:^|;\s*)(?:__Host-)?oma_api_key=/.test(
    c.req.header("Cookie") || "",
  );
  if (!hasBearer && !hasKeyCookie) {
    const body = await c.req.raw.clone().text().catch(() => "");
    let requestedModel = "";
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.model === "string") requestedModel = parsed.model;
    } catch {
      /* invalid JSON — fall through to auth */
    }
    if (requestedModel) {
      const modelInfo = await getModel(requestedModel);
      if (isFreeGuestModel(modelInfo)) {
        c.set("userId", FREE_GUEST_USER_ID);
        return next();
      }
    }
  }

  if (x402ChatMiddleware) {
    const hasPayment = Boolean(c.req.header("PAYMENT-SIGNATURE"));
    if (hasPayment || (!hasBearer && !hasKeyCookie)) {
      return x402ChatMiddleware(c, next);
    }
  }
  return bearerAuth(c, next);
}

chatCompletionsRouter.use("/v1/chat/completions", authOrPayment);
chatCompletionsRouter.use("/v1/chat/completions", requestTimeout());
chatCompletionsRouter.use(
  "/v1/chat/completions",
  tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }),
);
chatCompletionsRouter.use("/v1/chat/completions", modelRateLimit());
chatCompletionsRouter.use("/v1/chat/completions", spendLimit());

chatCompletionsRouter.post("/v1/chat/completions", async (c) => {
  // x402-paid requests have no user/key — payment was settled up front by
  // authOrPayment (paymentMiddleware sets c.var.payment on success).
  const payment = c.get("payment");
  const userId = c.get("userId") ?? "x402-guest";
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

      // Reject oversized bodies from the Content-Length header BEFORE reading
      // the body into memory — checking afterwards protects nothing.
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
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "invalid_json");
        return c.json(
          {
            error: {
              message: "Request body is not valid JSON",
              type: "invalid_request_error",
              code: "invalid_json",
            },
          },
          400,
        );
      }
      const parsed = chatCompletionSchema.safeParse(body);
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
          404,
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

      const payload = {
        model,
        messages: (messages ?? []).map((m) => ({
          ...m,
          content: m.content ?? "",
        })) as import("../../inference/types.js").ChatMessage[],
        stream: !!stream,
        ...rest,
      };
      const apiKeyId = apiKey?.id ?? "unknown";

      try {
        const {
          response,
          provider,
          inputTokens,
          outputTokens,
        } = await handleChatCompletion(
          userId,
          apiKeyId,
          payload,
          c.req.raw.signal,
          payment
            ? { prepaidUsd: X402_CHAT_PRICE }
            : // keyHash lets the stream tracker enforce the per-key daily
              // spend limit — streaming used to bypass it entirely.
              { keyHash: apiKey?.keyHash },
        );
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
              // Router stamps the generation id — clients use it with
              // GET /v1/generation?id= to reconcile billed cost.
              "x-request-id": response.headers.get("x-request-id") ?? "",
            },
          });
        }
        const json = await response.json();
        // Billed cost comes from the router via header — the upstream JSON
        // has no cost field (reading json.usage.totalCents was dead code
        // that left per-key daily spend limits permanently untripped).
        // parseFloat, not parseInt — cost strings are sub-cent decimals now.
        const totalCents = parseFloat(
          response.headers.get("x-oma-cost-cents") ?? "0",
        );
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
            "x-request-id": response.headers.get("x-request-id") ?? "",
            // USD cost of this completion (LiteLLM-style header) — the #1
            // thing pay-per-use clients check. Streaming responses carry
            // cost in the final usage chunk instead.
            ...(totalCents > 0
              ? { "x-oma-response-cost": (totalCents / 100).toFixed(6) }
              : {}),
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
