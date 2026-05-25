import { estimateTokens } from "./models.js";
import { calculateActualCost } from "./billing-service.js";
import { recordUsage } from "./usage-service.js";
import { refundCreditsWithRetry } from "./credit-preflight.js";
import { config } from "../config.js";
import type { ModelDef } from "./models.js";
import type { ModelPricing } from "./types.js";

const DEBUG_STREAM = config.DEBUG_STREAM;
let streamParseErrors = 0;

export function getStreamMetrics() {
  return { parseErrors: streamParseErrors };
}

function logStreamDebug(message: string, data?: Record<string, unknown>) {
  if (DEBUG_STREAM) {
    console.debug(`[router:stream] ${message}`, data ?? {});
  }
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function logParseError(requestId: string, data: string, error: unknown) {
  streamParseErrors++;
  const parseError = error instanceof Error ? error.message : String(error);
  logStreamDebug("SSE parse error", {
    requestId, error: parseError, dataLength: data.length,
    dataPreview: data.length > 100 ? data.slice(0, 100) + "..." : data,
    totalErrors: streamParseErrors,
  });
}

async function handleStreamEnd(
  streamStartTime: number, firstTokenTime: number | undefined,
  outputTokens: number, accumulatedContent: string, usageDataReceived: boolean,
  _inputTokens: number, modelId: string, discountPercent: number,
  userId: string, apiKeyId: string, provider: string, estimatedTotalCents: string,
  requestId: string,
  onStreamingMetrics?: (ttftMs: number, totalTokens: number, durationMs: number) => Promise<void>,
) {
  const streamDuration = Date.now() - streamStartTime;
  const finalOutputTokens = usageDataReceived ? outputTokens : estimateTokens(accumulatedContent);
  if (firstTokenTime !== undefined && onStreamingMetrics) {
    await onStreamingMetrics(firstTokenTime, finalOutputTokens, streamDuration);
  }
  const cost = await calculateActualCost(modelId, _inputTokens, finalOutputTokens, discountPercent);
  await recordUsage({
    requestId, userId, apiKeyId, modelId, provider,
    inputTokens: _inputTokens, outputTokens: finalOutputTokens,
    costCents: cost.costCents, markupCents: cost.markupCents, totalCents: cost.totalCents,
  });
  const refund = parseInt(estimatedTotalCents, 10) - parseInt(cost.totalCents, 10);
  if (refund > 0) await refundCreditsWithRetry(userId, String(refund));
}

export function createTrackingStream(
  upstream: ReadableStream<Uint8Array>,
  model: ModelDef | null,
  modelId: string,
  _inputTokens: number,
  discountPercent: number,
  userId: string,
  apiKeyId: string,
  provider: string,
  estimatedTotalCents: string,
  pricing: ModelPricing,
  requestId: string,
  onStreamingMetrics?: (ttftMs: number, totalTokens: number, durationMs: number) => Promise<void>
): ReadableStream<Uint8Array> {
  let outputTokens = 0, buffer = "", accumulatedContent = "";
  let usageDataReceived = false, firstTokenReceived = false;
  let firstTokenTime: number | undefined;
  let streamCompleted = false;
  const streamStartTime = Date.now();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]" && !streamCompleted) {
                streamCompleted = true;
                await handleStreamEnd(
                  streamStartTime, firstTokenTime, outputTokens, accumulatedContent, usageDataReceived,
                  _inputTokens, modelId, discountPercent, userId, apiKeyId, provider, estimatedTotalCents, requestId, onStreamingMetrics,
                );
              } else {
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text ?? "";
                  if (delta && !firstTokenReceived) {
                    firstTokenReceived = true;
                    firstTokenTime = Date.now() - streamStartTime;
                  }
                  if (delta) accumulatedContent += delta;
                  if (parsed.usage?.completion_tokens) {
                    outputTokens = parsed.usage.completion_tokens;
                    usageDataReceived = true;
                  }
                } catch (err) {
                  logParseError(requestId, data, err);
                }
              }
            }
            controller.enqueue(encoder.encode(line + "\n"));
          }
        }
      } catch (err) {
        try { await reader.cancel(); } catch { /* empty */ }
        controller.error(err);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
    async cancel() {
      if (!streamCompleted) {
        try { await refundCreditsWithRetry(userId, estimatedTotalCents); } catch (err) {
          console.error('[router] Refund failed during cancel:', err);
        }
      }
      await upstream.cancel();
    },
  });
}
