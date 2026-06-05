import { SpanKind } from "@opentelemetry/api";
import { Hono } from "hono";
import { bearerAuth } from "../../auth/middleware.js";
import { getBalance } from "../../credits/index.js";
import { handleChatCompletion } from "../../inference/router.js";
import type { ChatMessage } from "../../inference/types.js";
import { validationError } from "../../lib/validation.js";
import {
  checkIdempotencyKey,
  storeIdempotencyResult,
} from "../../middleware/idempotency.js";
import { modelRateLimit, tokenBucket } from "../../middleware/rate-limit.js";
import { spendLimit, trackSpend } from "../../middleware/spend-limit.js";
import { requestTimeout } from "../../middleware/timeout.js";
import { withSpan } from "../../tracing.js";
import type { OmaEnv } from "../../types.js";
import {
  checkRequestBodySizeLimit,
  completionSchema,
} from "./validation.js";
import { createInsufficientCreditsPayReq } from "../../credits/insufficient-credits.js";
import { getModel } from "../../inference/models.js";
import { logger } from "../../lib/logger.js";

type LegacyChoice = {
  index?: number;
  finish_reason?: string | null;
  text?: string;
  message?: { content?: unknown };
  delta?: { content?: unknown };
};

type LegacyCompletionResponse = {
  id?: string;
  object: "text_completion";
  created?: number;
  model?: string;
  choices: Array<{
    index: number;
    text: string;
    finish_reason: string | null;
    logprobs: null;
  }>;
  usage?: unknown;
};

function promptToMessages(prompt: string | string[]): ChatMessage[] {
  return [
    {
      role: "user",
      content: Array.isArray(prompt) ? prompt.join("\n") : prompt,
    },
  ];
}

function extractChoiceText(choice: LegacyChoice): string {
  if (typeof choice.text === "string") return choice.text;
  if (typeof choice.message?.content === "string") return choice.message.content;
  if (typeof choice.delta?.content === "string") return choice.delta.content;
  return "";
}

function toLegacyCompletionResponse(json: {
  id?: string;
  created?: number;
  model?: string;
  choices?: LegacyChoice[];
  usage?: unknown;
}): LegacyCompletionResponse {
  return {
    id: json.id,
    object: "text_completion",
    created: json.created,
    model: json.model,
    choices: (json.choices ?? []).map((choice, index) => ({
      index: choice.index ?? index,
      text: extractChoiceText(choice),
      finish_reason: choice.finish_reason ?? null,
      logprobs: null,
    })),
    usage: json.usage,
  };
}

function toLegacyStreamChunk(json: {
  id?: string;
  created?: number;
  model?: string;
  choices?: LegacyChoice[];
}) {
  return {
    id: json.id,
    object: "text_completion",
    created: json.created,
    model: json.model,
    choices: (json.choices ?? []).map((choice, index) => ({
      index: choice.index ?? index,
      text: extractChoiceText(choice),
      finish_reason: choice.finish_reason ?? null,
      logprobs: null,
    })),
  };
}

function transformLegacyCompletionStream(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const flushEvent = (
    event: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ) => {
    if (!event.trim()) return;
    const mappedLines = event.split("\n").map((line) => {
      if (!line.startsWith("data:")) return line;
      const data = line.slice(5).trimStart();
      if (data === "[DONE]") return "data: [DONE]";
      try {
        const parsed = JSON.parse(data) as {
          id?: string;
          created?: number;
          model?: string;
          choices?: LegacyChoice[];
        };
        return `data: ${JSON.stringify(toLegacyStreamChunk(parsed))}`;
      } catch {
        return line;
      }
    });
    controller.enqueue(encoder.encode(`${mappedLines.join("\n")}\n\n`));
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        if (buffer) flushEvent(buffer, controller);
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) flushEvent(event, controller);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

/**
 * @deprecated Use /v1/chat/completions instead.
 */
export const completionsRouter = new Hono<OmaEnv>();

completionsRouter.use("/v1/completions", bearerAuth);
completionsRouter.use("/v1/completions", requestTimeout());
completionsRouter.use(
  "/v1/completions",
  tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }),
);
completionsRouter.use("/v1/completions", modelRateLimit());
completionsRouter.use("/v1/completions", spendLimit());

completionsRouter.post("/v1/completions", async (c) => {
  logger.warn(
    "[deprecation] /v1/completions is deprecated. Use /v1/chat/completions instead.",
  );

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
    "completion.legacy",
    async (span) => {
      span?.setAttribute("user.id", userId);
      if (correlationId) span?.setAttribute("correlation.id", correlationId);

      const parsed = completionSchema.safeParse(await c.req.json());
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

      const { model, prompt, stream, ...rest } = parsed.data;
      if (Array.isArray(prompt)) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "unsupported_prompt_array");
        return c.json(
          {
            error: {
              message: "Prompt arrays are not supported on /v1/completions. Send one prompt per request.",
              type: "invalid_request_error",
              code: "unsupported_prompt_array",
            },
          },
          400,
        );
      }
      const messages = promptToMessages(prompt);

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

      const bal = await getBalance(userId);
      if (Number(bal.balanceCents) <= 0) {
        span?.setAttribute("error", true);
        span?.setAttribute("error.type", "insufficient_credits");
        return createInsufficientCreditsPayReq(c, 1, Number(bal.balanceCents));
      }

      const payload = { model, messages, stream: !!stream, ...rest };
      const apiKeyId = apiKey?.id ?? "unknown";

      try {
        const { response, provider } = await handleChatCompletion(userId, apiKeyId, payload);
        span?.setAttribute("llm.provider", provider);

        if (stream) {
          return new Response(response.body ? transformLegacyCompletionStream(response.body) : null, {
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

        const json = (await response.json()) as {
          id?: string;
          created?: number;
          model?: string;
          choices?: LegacyChoice[];
          usage?: { totalCents?: number; total_cost?: string };
        };

        const totalCents =
          json.usage?.totalCents ??
          Math.round(parseFloat(json.usage?.total_cost ?? "0") * 100);
        if (totalCents > 0 && apiKey) {
          trackSpend(apiKey.keyHash, Math.ceil(totalCents)).catch((err) => {
            logger.error(
              { err, keyPrefix: apiKey.keyHash.slice(0, 8) },
              "[spend-limit] Track failed",
            );
          });
        }

        const legacyJson = toLegacyCompletionResponse(json);
        if (idempotencyKey) {
          await storeIdempotencyResult(idempotencyKey, legacyJson);
        }

        return c.json(legacyJson, {
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
        logger.error({ err }, "[chat] /v1/completions error:");
        return c.json(
          {
            error: {
              message: "An internal error occurred",
              type: (err as { type?: string }).type ?? "inference_error",
            },
          },
          status as Parameters<typeof c.json>[1],
        );
      }
    },
    undefined,
    SpanKind.SERVER,
  );
});
