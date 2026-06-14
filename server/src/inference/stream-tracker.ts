import { estimateTokens } from "./models.js";
import { calculateActualCost } from "./billing-service.js";
import { recordUsage } from "./usage-service.js";
import { refundCreditsWithRetry } from "./credit-preflight.js";
import { config } from "../config.js";
import type { ModelDef } from "./models.js";
import type { ModelPricing } from "./types.js";

const DEBUG_STREAM = config.DEBUG_STREAM;
let streamParseErrors = 0;
const MAX_ERROR_COUNT = 1_000_000;

// In-memory LRU cache for estimateTokens. Short-circuits repeated identical
// content strings. Map iteration order is insertion order in JS, so the
// oldest entry is at the front and gets evicted first when the cap is hit.
const estimateCache = new Map<string, number>();
const MAX_ESTIMATE_CACHE_SIZE = 1000;

function estimateTokensCached(text: string): number {
  const cached = estimateCache.get(text);
  if (cached !== undefined) {
    // Touch: move to end to mark as most-recently-used
    estimateCache.delete(text);
    estimateCache.set(text, cached);
    return cached;
  }
  const result = estimateTokens(text);
  if (estimateCache.size >= MAX_ESTIMATE_CACHE_SIZE) {
    const firstKey = estimateCache.keys().next().value;
    if (firstKey !== undefined) estimateCache.delete(firstKey);
  }
  estimateCache.set(text, result);
  return result;
}

export function getStreamMetrics() {
  return { parseErrors: streamParseErrors };
}

export function resetStreamMetrics(): void {
  streamParseErrors = 0;
}

function logStreamDebug(message: string, data?: Record<string, unknown>) {
  if (DEBUG_STREAM) {
    console.debug(`[router:stream] ${message}`, data ?? {});
  }
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function logParseError(requestId: string, data: string, error: unknown) {
  if (streamParseErrors >= MAX_ERROR_COUNT) {
    streamParseErrors = 0;
  }
  streamParseErrors++;
  const parseError = error instanceof Error ? error.message : String(error);
  logStreamDebug("SSE parse error", {
    requestId, error: parseError, dataLength: data.length,
    dataPreview: data.length > 100 ? data.slice(0, 100) + "..." : data,
    totalErrors: streamParseErrors,
  });
}

interface StreamState {
  refundExecuted: boolean;
}

async function handleStreamEnd(
  streamState: StreamState,
  streamStartTime: number, firstTokenTime: number | undefined,
  outputTokens: number, accumulatedContent: string, usageDataReceived: boolean,
  _inputTokens: number, modelId: string, discountPercent: number,
  userId: string, apiKeyId: string, provider: string, estimatedTotalCents: string,
  requestId: string,
  onStreamingMetrics?: (ttftMs: number, totalTokens: number, durationMs: number) => Promise<void>,
) {
  if (streamState.refundExecuted) return;
  streamState.refundExecuted = true;
  const streamDuration = Date.now() - streamStartTime;
  const finalOutputTokens = usageDataReceived ? outputTokens : estimateTokensCached(accumulatedContent);
  if (firstTokenTime !== undefined && onStreamingMetrics) {
    await onStreamingMetrics(firstTokenTime, finalOutputTokens, streamDuration);
  }
  try {
    const cost = await calculateActualCost(modelId, _inputTokens, finalOutputTokens, discountPercent);
    await recordUsage({
      requestId, userId, apiKeyId, modelId, provider,
      inputTokens: _inputTokens, outputTokens: finalOutputTokens,
      costCents: cost.costCents, markupCents: cost.markupCents, totalCents: cost.totalCents,
    });
    const refund = parseInt(estimatedTotalCents, 10) - parseInt(cost.totalCents, 10);
    if (refund > 0) await refundCreditsWithRetry(userId, String(refund), requestId);
  } catch (err) {
    console.error("[stream-tracker] Error in handleStreamEnd:", err);
  }
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
  const streamState: StreamState = { refundExecuted: false };
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
                  streamState,
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

          if (controller.desiredSize !== null && controller.desiredSize <= 0) {
            await new Promise<void>((resolve) => {
              let delay = 10;
              const maxDelay = 500;
              const checkSize = () => {
                if (controller.desiredSize !== null && controller.desiredSize > 0) {
                  resolve();
                } else {
                  setTimeout(checkSize, delay);
                  delay = Math.min(delay * 1.5, maxDelay);
                }
              };
              checkSize();
            });
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
      // C6 regression: even on cancel we must finalize the usage record so
      // the user is charged for tokens the provider already produced. We
      // delegate to handleStreamEnd, which is guarded by streamState.refundExecuted
      // so it is safe to call from both here and the [DONE] path.
      if (!streamState.refundExecuted) {
        try {
          await handleStreamEnd(
            streamState,
            streamStartTime, firstTokenTime, outputTokens, accumulatedContent, usageDataReceived,
            _inputTokens, modelId, discountPercent, userId, apiKeyId, provider, estimatedTotalCents, requestId, onStreamingMetrics,
          );
        } catch (err) {
          console.error('[stream-tracker] handleStreamEnd during cancel failed:', err);
        }
      }
      try { await upstream.cancel(); } catch { /* empty */ }
    },
  });
}

// Test-only hooks for the M10.7 stream-tracker perf test. The estimate
// cache is a Map keyed by content string; the perf test wants a clean
// slate in beforeEach and visibility into cache size to assert LRU
// short-circuit behavior. Production code does not call these.
export function clearEstimateCache(): void {
  estimateCache.clear();
}

export function getEstimateCacheSize(): number {
  return estimateCache.size;
}