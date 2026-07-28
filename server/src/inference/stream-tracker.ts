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

/** Promote a short final answer out of a reasoning dump (empty-content recovery). */
function extractTrailingAnswerFromReasoning(reasoning: string): string | null {
  const text = reasoning.trim();
  if (!text) return null;
  const markers = [
    /(?:so\s+(?:the\s+)?answer\s+is[:\s]+)["']?([^\n"']{1,80})/i,
    /(?:final\s+answer[:\s]+)["']?([^\n"']{1,80})/i,
    /(?:reply(?:ing)?\s+with[:\s]+)["']?([^\n"']{1,80})/i,
    /(?:output|respond(?: with)?)[:\s]+["']?([^\n"']{1,40})["']?\s*$/i,
  ];
  for (const re of markers) {
    const m = text.match(re);
    if (m?.[1]) {
      const a = m[1].trim().replace(/^[`"']+|[`"'.]+$/g, "");
      if (a && a.length <= 80) return a;
    }
  }
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 4; i--) {
    const line = lines[i].replace(/^["'`]+|["'`]+$/g, "");
    if (line.length > 0 && line.length <= 40 && !/^(we |the |so |i |let |but |and )/i.test(line)) {
      return line;
    }
  }
  return null;
}

/**
 * Gonka's MiniMax M2.7 embeds its reasoning at the START of `content` as a
 * `<think>…</think>` block (its `reasoning` field is null). Downstream
 * clients — including our own chat UI — expect reasoning in the OpenAI-style
 * `reasoning_content` delta. This incremental splitter routes think-text to
 * `reasoning` and everything else to `content`, carrying a small tail across
 * chunk boundaries so a tag split like "<th" + "ink>" is still recognized.
 */
class ThinkSplitter {
  private mode: "scan" | "think" | "done" = "scan";
  private pending = "";

  /** Longest partial-tag suffix we might need to hold back. */
  private static TAIL = "</think>".length - 1;

  private static endsWithPartialTag(s: string): number {
    for (let n = Math.min(ThinkSplitter.TAIL, s.length); n > 0; n--) {
      const tail = s.slice(-n);
      if ("<think>".startsWith(tail) || "</think>".startsWith(tail)) return n;
    }
    return 0;
  }

  /** Feed a content delta; returns what should go to content vs reasoning. */
  push(delta: string): { content: string; reasoning: string } {
    if (this.mode === "done") return { content: delta, reasoning: "" };
    let text = this.pending + delta;
    this.pending = "";
    let content = "";
    let reasoning = "";
    while (text.length > 0) {
      if (this.mode === "scan") {
        // Only a leading <think> counts — mid-response tags pass through.
        if (text.startsWith("<think>")) {
          this.mode = "think";
          text = text.slice("<think>".length);
          continue;
        }
        if ("<think>".startsWith(text)) {
          // Entire remainder is a partial opening tag — hold it.
          this.pending = text;
          return { content, reasoning };
        }
        this.mode = "done";
        content += text;
        return { content, reasoning };
      }
      // mode === "think": route to reasoning until </think>
      const close = text.indexOf("</think>");
      if (close !== -1) {
        reasoning += text.slice(0, close);
        text = text.slice(close + "</think>".length).replace(/^\s+/, "");
        this.mode = "done";
        content += text;
        return { content, reasoning };
      }
      const hold = ThinkSplitter.endsWithPartialTag(text);
      if (hold > 0) {
        reasoning += text.slice(0, -hold);
        this.pending = text.slice(-hold);
      } else {
        reasoning += text;
      }
      return { content, reasoning };
    }
    return { content, reasoning };
  }

  /** Flush any held partial tag at end of stream. */
  flush(): { content: string; reasoning: string } {
    const p = this.pending;
    this.pending = "";
    if (!p) return { content: "", reasoning: "" };
    return this.mode === "think" ? { content: "", reasoning: p } : { content: p, reasoning: "" };
  }
}

/** Billing behavior for a tracked stream. */
export interface TrackingStreamOpts {
  /**
   * credits — preflight hold was taken; settle actual cost + refund delta.
   * free   — free-tier Gonka fallback; record usage with 0 revenue.
   * prepaid — x402 flat-rate; record usage with the settled flat price.
   */
  billingMode?: "credits" | "free" | "prepaid";
  /** Flat revenue (cents) for prepaid mode. */
  prepaidCents?: number;
  /** Called with the billed totalCents after settle — used for per-key daily
   *  spend tracking, which previously never ran on the streaming path. */
  onSettled?: (totalCents: number) => void;
  /**
   * Optional Polar usage-meter callback. Fires after the streamed
   * response settles successfully so the customer's metered usage
   * stays in sync with our internal `usage_records` table. The hook is
   * dormant unless POLAR_USAGE_METER_ID is set in .env.
   */
  onUsageRecorded?: (info: {
    totalCents: number;
    inputTokens: number;
    outputTokens: number;
    model: string;
    provider: string;
    userId: string;
  }) => void;
}

interface StreamState {
  refundExecuted: boolean;
}

export function createTrackingStream(
  upstream: ReadableStream<Uint8Array>,
  _model: ModelDef | null,
  modelId: string,
  _inputTokens: number,
  discountPercent: number,
  userId: string,
  apiKeyId: string,
  provider: string,
  estimatedTotalCents: string,
  _pricing: ModelPricing,
  requestId: string,
  onStreamingMetrics?: (ttftMs: number, totalTokens: number, durationMs: number) => Promise<void>,
  opts?: TrackingStreamOpts,
): ReadableStream<Uint8Array> {
  const billingMode = opts?.billingMode ?? "credits";
  // Running char count only — retaining the concatenated response body
  // held up to ~100KB per concurrent stream for a number we derive as len/4.
  let outputTokens = 0, buffer = "", accumulatedChars = 0;
  let usageDataReceived = false, firstTokenReceived = false;
  // Upstream's authoritative prompt count (final usage chunk). The old code
  // discarded it and billed the chars/4 estimate on every stream.
  let upstreamInputTokens: number | null = null;
  let firstTokenTime: number | undefined;
  let streamCompleted = false;
  const streamState: StreamState = { refundExecuted: false };
  const streamStartTime = Date.now();
  const publicId = `gen-${requestId}`;
  // Gonka embeds <think> reasoning inside content — split it out.
  const thinkSplitter = provider === "gonka" ? new ThinkSplitter() : null;
  // Accumulated after ThinkSplitter so we can recover empty-content streams
  // (reasoning-only MiniMax replies) by promoting a short final answer.
  let streamVisibleContent = "";
  let streamReasoningContent = "";

  async function settle(status: string): Promise<{ inputTokens: number; outputTokens: number; totalCents: number } | null> {
    if (streamState.refundExecuted) return null;
    streamState.refundExecuted = true;
    const streamDuration = Date.now() - streamStartTime;
    // chars/4 estimate — same as estimateTokens, without retaining the body.
    const finalOutputTokens = usageDataReceived ? outputTokens : Math.ceil(accumulatedChars / 4);
    const finalInputTokens = upstreamInputTokens ?? _inputTokens;
    if (firstTokenTime !== undefined && onStreamingMetrics) {
      await onStreamingMetrics(firstTokenTime, finalOutputTokens, streamDuration);
    }
    try {
      // Fix B6: a user cancel / EOF before any tokens should not trigger a
      // minimum charge. Charge 0 and log so legitimate disconnections are
      // observable in monitoring without over-billing.
      const isEmptyStream = finalOutputTokens === 0 && accumulatedChars === 0;
      let cost: { costCents: string; markupCents: string; totalCents: string };
      if (isEmptyStream) {
        logger.info(
          {
            requestId, modelId, provider, userId,
            accumulatedLength: accumulatedChars,
            type: "empty_stream_no_charge",
          },
          "[stream-tracker] empty stream (no tokens produced), charging 0",
        );
        cost = { costCents: "0", markupCents: "0", totalCents: "0" };
      } else {
        cost = await calculateActualCost(modelId, finalInputTokens, finalOutputTokens, discountPercent);
      }
      let billedTotalCents: number;
      if (billingMode === "free") {
        billedTotalCents = 0;
        await recordUsage({
          requestId, userId, apiKeyId, modelId, provider,
          inputTokens: finalInputTokens, outputTokens: finalOutputTokens,
          // costCents keeps the would-be wholesale cost visible for margin
          // dashboards; revenue (totalCents) is genuinely zero.
          costCents: cost.costCents, markupCents: "0", totalCents: "0",
          latencyMs: streamDuration, status: status === "completed" ? "free_tier" : status,
        });
      } else if (billingMode === "prepaid") {
        billedTotalCents = opts?.prepaidCents ?? 0;
        await recordUsage({
          requestId, userId, apiKeyId, modelId, provider,
          inputTokens: finalInputTokens, outputTokens: finalOutputTokens,
          costCents: cost.costCents, markupCents: "0",
          totalCents: billedTotalCents.toFixed(2),
          latencyMs: streamDuration, status: status === "completed" ? "x402" : status,
        });
      } else {
        billedTotalCents = parseFloat(cost.totalCents);
        await recordUsage({
          requestId, userId, apiKeyId, modelId, provider,
          inputTokens: finalInputTokens, outputTokens: finalOutputTokens,
          costCents: cost.costCents, markupCents: cost.markupCents, totalCents: cost.totalCents,
          latencyMs: streamDuration, status,
        });
        // Sub-cent precision: cost strings may carry decimals now, so the
        // refund delta must not go through parseInt (it floored "0.03" to 0).
        const refund = Math.round((parseFloat(estimatedTotalCents) - billedTotalCents) * 100) / 100;
        if (refund > 0) await refundCreditsWithRetry(userId, String(refund), requestId);
        opts?.onSettled?.(billedTotalCents);
        // Fire the Polar usage-meter hook AFTER billing settles so we
        // only meter paid requests (not refunded / errored ones). The
        // hook itself is dormant unless POLAR_USAGE_METER_ID is set.
        opts?.onUsageRecorded?.({
          totalCents: billedTotalCents,
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
          model: modelId,
          provider,
          userId,
        });
      }
      return { inputTokens: finalInputTokens, outputTokens: finalOutputTokens, totalCents: billedTotalCents };
    } catch (err) {
      logger.error({ err, requestId }, "[stream-tracker] Error in settle");
      return null;
    }
  }

  /** OMA terminal usage chunk — OpenRouter-style: emitted once, right before
   *  [DONE], with `choices: []` (so naive clients can't double-count) and a
   *  `cost` field in USD. Replaces the upstream usage chunk, which is held
   *  back rather than forwarded. */
  function usageChunk(inTok: number, outTok: number, totalCents: number): Uint8Array {
    const chunk = {
      id: publicId,
      object: "chat.completion.chunk",
      model: modelId,
      choices: [] as never[],
      usage: {
        prompt_tokens: inTok,
        completion_tokens: outTok,
        total_tokens: inTok + outTok,
        cost: totalCents / 100,
      },
    };
    return encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();

      const safeEnqueue = (bytes: Uint8Array) => {
        try { controller.enqueue(bytes); } catch { /* consumer gone */ }
      };

      const settleAndEmitUsage = async (status: string) => {
        const settled = await settle(status);
        if (settled) {
          safeEnqueue(usageChunk(settled.inputTokens, settled.outputTokens, settled.totalCents));
        }
      };

      // Returns the bytes to forward for one `data:` payload (or null to
      // swallow it — usage-only chunks are held and re-emitted at settle).
      const processData = async (raw: string): Promise<Uint8Array | null> => {
        const data = raw.trim();
        if (!data) return null;
        if (data === "[DONE]") {
          // Before closing: if gonka streamed only reasoning, emit a content
          // delta so OpenAI clients (and our chat bubble) are not blank.
          if (
            provider === "gonka" &&
            !streamVisibleContent.trim() &&
            streamReasoningContent.trim()
          ) {
            const promoted = extractTrailingAnswerFromReasoning(streamReasoningContent);
            if (promoted) {
              const chunk = {
                id: publicId,
                object: "chat.completion.chunk",
                model: modelId,
                choices: [{
                  index: 0,
                  delta: { content: promoted },
                  finish_reason: null,
                }],
              };
              streamVisibleContent = promoted;
              if (!streamCompleted) {
                streamCompleted = true;
                await settleAndEmitUsage("completed");
              }
              return encoder.encode(
                `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`,
              );
            }
          }
          if (!streamCompleted) {
            streamCompleted = true;
            await settleAndEmitUsage("completed");
          }
          return encoder.encode("data: [DONE]\n\n");
        }
        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          const delta = choice?.delta?.content ?? choice?.text ?? "";
          // Providers disagree on the reasoning field name: vLLM (Gonka)
          // streams `reasoning`, OpenAI-style emits `reasoning_content`.
          const reasoningDelta = choice?.delta?.reasoning_content ?? choice?.delta?.reasoning ?? "";
          const combinedDelta = delta + reasoningDelta;
          if (choice?.delta && choice.delta.reasoning != null && choice.delta.reasoning_content == null) {
            // Mirror to reasoning_content so OpenAI-compat clients (and our
            // chat UI's Thinking section) see it; keep `reasoning` for
            // OpenRouter-style consumers.
            choice.delta.reasoning_content = choice.delta.reasoning;
          }
          if (combinedDelta && !firstTokenReceived) {
            firstTokenReceived = true;
            firstTokenTime = Date.now() - streamStartTime;
          }
          if (combinedDelta) accumulatedChars += combinedDelta.length;
          if (parsed.usage != null) {
            if (parsed.usage.completion_tokens != null) {
              outputTokens = parsed.usage.completion_tokens;
              usageDataReceived = true;
            }
            if (parsed.usage.prompt_tokens != null) {
              upstreamInputTokens = parsed.usage.prompt_tokens;
            }
          }
          // Don't leak upstream internals (devshard ids, provider model
          // slugs) — clients see our request id + catalog model id, which
          // also makes GET /v1/generation?id= lookups work.
          parsed.id = publicId;
          parsed.model = modelId;
          if ("prompt_text" in parsed) delete parsed.prompt_text;
          // Route Gonka's embedded <think> block to reasoning_content.
          if (thinkSplitter && choice?.delta && typeof choice.delta.content === "string" && choice.delta.content) {
            const split = thinkSplitter.push(choice.delta.content);
            choice.delta.content = split.content;
            if (split.reasoning) {
              choice.delta.reasoning_content = (choice.delta.reasoning_content ?? "") + split.reasoning;
            }
          }
          // Track visible content vs reasoning for free-model empty-content recovery.
          if (choice?.delta?.content) streamVisibleContent += choice.delta.content;
          if (choice?.delta?.reasoning_content) streamReasoningContent += choice.delta.reasoning_content;
          // Usage-only terminal chunk from upstream: hold it back — our own
          // usage chunk (with cost, correct ids) is emitted at settle.
          const hasChoiceData = Array.isArray(parsed.choices) && parsed.choices.length > 0;
          if (parsed.usage != null && !hasChoiceData) return null;
          if (parsed.usage != null && hasChoiceData) delete parsed.usage;
          return encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`);
        } catch (err) {
          logParseError(requestId, data, err);
          // Not JSON we understand — forward verbatim so we never corrupt
          // provider-specific event framing.
          return encoder.encode(`data: ${data}\n\n`);
        }
      };

      const handleBlock = async (block: string) => {
        const parsed = parseSSEBlock(block);
        if (!parsed) return;
        for (const d of parsed.data) {
          const out = await processData(d);
          if (out) safeEnqueue(out);
        }
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
        // Flush any partial think-tag the splitter was holding.
        if (thinkSplitter) {
          const tail = thinkSplitter.flush();
          if (tail.content || tail.reasoning) {
            const chunk = {
              id: publicId,
              object: "chat.completion.chunk",
              model: modelId,
              choices: [{
                index: 0,
                delta: {
                  ...(tail.content ? { content: tail.content } : {}),
                  ...(tail.reasoning ? { reasoning_content: tail.reasoning } : {}),
                },
                finish_reason: null,
              }],
            };
            safeEnqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        }
      } catch (err) {
        try { await reader.cancel(); } catch { /* empty */ }
        controller.error(err);
      } finally {
        reader.releaseLock();
        // ponytail: streaming audit #2 — on EOF without [DONE] (proxy kill,
        // socket reset) we still owe the user a charge. settle() is
        // idempotent (guarded by streamState.refundExecuted), safe from both
        // [DONE] and this path.
        if (!streamState.refundExecuted) {
          try {
            await settleAndEmitUsage("completed");
          } catch (err) {
            logger.error({ err, requestId }, "[stream-tracker] settle at EOF failed");
          }
        }
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    async cancel() {
      // C6 regression: even on cancel we must finalize the usage record so
      // the user is charged for tokens the provider already produced. settle()
      // is guarded by streamState.refundExecuted so it is safe to call from
      // both here and the [DONE] path.
      if (!streamState.refundExecuted) {
        try {
          await settle("cancelled");
        } catch (err) {
          logger.error({ err, requestId }, "[stream-tracker] settle during cancel failed");
        }
      }
      try { await upstream.cancel(); } catch { /* empty */ }
    },
  });
}
