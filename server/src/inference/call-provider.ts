import * as venice from "./venice.js";
import * as surplus from "./surplus.js";
import * as gonka from "./gonka.js";
import { reportProviderResult } from "./provider-health.js";
import { isCircuitOpen, recordProviderError, recordProviderSuccess } from "./circuit-breaker.js";
import { PROVIDER_ERROR_TYPES } from "../tracing.js";
import type { Provider } from "./provider-selector.js";
import { config } from "../config.js";
import { trace } from "@opentelemetry/api";
import { logger } from "../lib/logger.js";
import { redactPii } from "../lib/privacy.js";
import { withRetry } from "./base.js";

function getCorrelationIdFromContext(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;
  return span.spanContext().traceId;
}

export async function callProvider(
  provider: Provider,
  providerModelId: string,
  body: Record<string, unknown>,
  correlationId?: string,
  signal?: AbortSignal,
): Promise<Response> {
  const requestCorrelationId = correlationId ?? getCorrelationIdFromContext();
  const start = Date.now();
  const isStreaming = body.stream === true;
  const timeoutMs = isStreaming ? config.PROVIDER_TIMEOUT_STREAM_MS : config.PROVIDER_TIMEOUT_NON_STREAM_MS;

  if (await isCircuitOpen(provider, providerModelId)) {
    const error = Object.assign(
      new Error(`Circuit breaker open for ${provider}:${providerModelId}`),
      { status: 503, provider, type: PROVIDER_ERROR_TYPES.CIRCUIT_BREAKER },
    );
    logger.warn({ provider, modelId: providerModelId, correlationId: requestCorrelationId, type: 'circuit_breaker_open' });
    throw error;
  }

  // Fix B3: wrap each attempt in a fresh closure so a retry creates a new
  // fetch (the prior fetchPromise was already settled by the time we retry).
  // Retry once on transient 5xx/429 errors; honor the upstream Retry-After
  // header (propagated via err.retryAfter by base.ts). Keeps p99 latency
  // bounded: at most 2 attempts + 1 short delay between them.
  const performRequest = (): Promise<Response> => {
    const fp = (async () => {
      const reqBody = { ...body, model: providerModelId };
      let resp: Response;
      if (provider === "venice") {
        resp = signal !== undefined
          ? await venice.chatCompletion(reqBody as Parameters<typeof venice.chatCompletion>[0], signal)
          : await venice.chatCompletion(reqBody as Parameters<typeof venice.chatCompletion>[0]);
      } else if (provider === "surplus") {
        resp = signal !== undefined
          ? await surplus.surplusChatCompletion(reqBody as Parameters<typeof surplus.surplusChatCompletion>[0], signal)
          : await surplus.surplusChatCompletion(reqBody as Parameters<typeof surplus.surplusChatCompletion>[0]);
      } else if (provider === "gonka") {
        resp = signal !== undefined
          ? await gonka.chatCompletion(reqBody as Parameters<typeof gonka.chatCompletion>[0], signal)
          : await gonka.chatCompletion(reqBody as Parameters<typeof gonka.chatCompletion>[0]);
      } else {
        // All known providers failed — surface the source so monitoring
        // can identify an unexpected provider value at a glance.
        throw Object.assign(
          new Error(`Unknown inference provider: ${String(provider)}`),
          { status: 500, provider, type: PROVIDER_ERROR_TYPES.UNKNOWN_ERROR }
        );
      }
      return resp;
    })();

    const tp = new Promise<never>((_, reject) => {
      setTimeout(() => {
        // Fix B3: mark timeouts as retryable so withRetry can attempt a
        // fresh fetch on transient network/peer slowness.
        reject(Object.assign(
          new Error(`Provider request timed out after ${timeoutMs}ms`),
          { status: 504, provider, type: PROVIDER_ERROR_TYPES.CONNECTION_ERROR, retryable: true },
        ));
      }, timeoutMs);
    });

    return Promise.race([fp, tp]);
  };

  try {
    const resp = await withRetry(performRequest, {
      maxRetries: 1,
      // 250ms base keeps p99 bounded; when Retry-After is set on the error,
      // withRetry uses that instead of this value.
      baseDelayMs: 250,
      // Match what mapVeniceError / the surplus mapper mark retryable. The
      // `retryable` flag on the thrown error is the source of truth for
      // "should we retry" (5xx without retryable:false like 501 are skipped).
      retryStatuses: [429, 500, 502, 503, 504, 524],
    });
    await reportProviderResult(provider, true, Date.now() - start);
    await recordProviderSuccess(provider, providerModelId);
    return resp;
  } catch (err) {
    await reportProviderResult(provider, false, Date.now() - start);
    await recordProviderError(provider, providerModelId);

    // ponytail: V6 #10 — redact PII/sensitive fields from the request body
    // before attaching to the error / structured log. Stops user prompts,
    // API keys, and private-key-shaped strings from landing in error
    // monitoring. Recursive, key- and value-aware. Addresses (0x + 40 hex)
    // are kept on purpose.
    const redactedBody = redactPii(body);
    const errorWithContext = Object.assign(err instanceof Error ? err : new Error(String(err)), {
      provider,
      modelId: providerModelId,
      correlationId: requestCorrelationId,
      requestBody: redactedBody,
      type: PROVIDER_ERROR_TYPES.UNKNOWN_ERROR,
    });

    logger.error({
      provider,
      modelId: providerModelId,
      correlationId: requestCorrelationId,
      requestBody: redactedBody,
      error: err instanceof Error ? err.message : String(err),
      type: 'provider_error'
    });
    throw errorWithContext;
  }
}
