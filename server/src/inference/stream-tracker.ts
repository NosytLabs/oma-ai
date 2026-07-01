import { estimateTokens } from "./models.js";
import { calculateActualCost } from "./billing-service.js";
import { recordUsage } from "./usage-service.js";
import { refundCreditsWithRetry } from "./credit-preflight.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
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

function logStreamDebug(message: string, data?: Record<string, unknown>) {
  if (DEBUG_STREAM) {
    logger.debug(data ?? {}, `[router:stream] ${message}`);
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

// ponytail: SSE events end with \n\n. A single event can have multiple
// `data:` lines that must be concatenated. Per the SSE spec, ignore lines
// starting with `:` (comment). A bare `data:` line is treated as the string
// "data: ". The event ends at the first blank line.
function parseSSEBlock(block: string): { event?: string; data: string[]; id?: string } | null {
  if (!block || block.trim() === "") return null;
  const lines = block.split("\n");
  const data: string[] = [];
  let event: string | undefined;
  let id: string | undefined;
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "data") data.push(value);
    else if (field === "event") event = value;
    else if (field === "id") id = value;
  }
  if (data.length === 0 && !event && !id) return null;
  return { event, data, id };
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
    // Fix B6: a user cancel / EOF before any tokens should not trigger the
    // 1-cent floor in calculateActualCost. Charge 0 and log so legitimate
    // disconnections are observable in monitoring without over-billing.
    const isEmptyStream =
      finalOutputTokens === 0 &&
      (!accumulatedContent || accumulatedContent.length === 0);
    let cost: { costCents: string; markupCents: string; totalCents: string };
    if (isEmptyStream) {
      logger.info(
        {
          requestId, modelId, provider, userId,
          accumulatedLength: accumulatedContent.length,
          type: "empty_stream_no_charge",
        },
        "[stream-tracker] empty stream (no tokens produced), charging 0",
      );
      cost = { costCents: "0", markupCents: "0", totalCents: "0" };
    } else {
      cost = await calculateActualCost(modelId, _inputTokens, finalOutputTokens, discountPercent);
    }
    await recordUsage({
      requestId, userId, apiKeyId, modelId, provider,
      inputTokens: _inputTokens, outputTokens: finalOutputTokens,
      costCents: cost.costCents, markupCents: cost.markupCents, totalCents: cost.totalCents,
    });
    const refund = parseInt(estimatedTotalCents, 10) - parseInt(cost.totalCents, 10);
    if (refund > 0) await refundCreditsWithRetry(userId, String(refund), requestId);
  } catch (err) {
    logger.error({ err, requestId }, "[stream-tracker] Error in handleStreamEnd");
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
      const processData = async (raw: string) => {
        const data = raw.trim();
        if (!data) return;
        if (data === "[DONE]" && !streamCompleted) {
          streamCompleted = true;
          await handleStreamEnd(
            streamState,
            streamStartTime, firstTokenTime, outputTokens, accumulatedContent, usageDataReceived,
            _inputTokens, modelId, discountPercent, userId, apiKeyId, provider, estimatedTotalCents, requestId, onStreamingMetrics,
          );
          return;
        }
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
      };
      const handleBlock = async (block: string) => {
        const parsed = parseSSEBlock(block);
        if (!parsed) return;
        for (const d of parsed.data) {
          await processData(d);
        }
        controller.enqueue(encoder.encode(block + "\n\n"));
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // ponytail: SSE event boundary is \n\n. Some providers (Venice) emit
          // \n only — in that case treat each \n-terminated line as its own
          // event. The trailing partial is held in `buffer` for the next read.
          let blocks: string[];
          if (buffer.includes("\n\n")) {
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";
            blocks = parts;
          } else if (buffer.includes("\n")) {
            const parts = buffer.split("\n");
            buffer = parts.pop() ?? "";
            blocks = parts;
          } else {
            continue;
          }

          for (const block of blocks) {
            await handleBlock(block);
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
        // ponytail: flush any trailing partial event left in the buffer at EOF
        if (buffer.trim()) {
          await handleBlock(buffer);
          buffer = "";
        }
      } catch (err) {
        try { await reader.cancel(); } catch { /* empty */ }
        controller.error(err);
      } finally {
        reader.releaseLock();
        // ponytail: streaming audit #2 — on EOF without [DONE] (proxy kill,
        // socket reset) we still owe the user a charge. handleStreamEnd is
        // idempotent (guarded by streamState.refundExecuted), safe from both
        // [DONE] and this path.
        if (!streamState.refundExecuted) {
          try {
            await handleStreamEnd(
              streamState,
              streamStartTime, firstTokenTime, outputTokens, accumulatedContent, usageDataReceived,
              _inputTokens, modelId, discountPercent, userId, apiKeyId, provider, estimatedTotalCents, requestId, onStreamingMetrics,
            );
          } catch (err) {
            logger.error({ err, requestId }, "[stream-tracker] handleStreamEnd at EOF failed");
          }
        }
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
          logger.error({ err, requestId }, "[stream-tracker] handleStreamEnd during cancel failed");
        }
      }
      try { await upstream.cancel(); } catch { /* empty */ }
    },
  });
}
