import * as venice from "./venice.js";
import * as antseed from "./antseed.js";
import * as litellm from "./litellm.js";
import * as openrouter from "./openrouter.js";
import * as together from "./together.js";
import * as deepinfra from "./deepinfra.js";
import * as surplus from "./surplus.js";
import * as morpheus from "./morpheus.js";
import * as claude from "./claude.js";
import * as gemini from "./gemini.js";
import { reportProviderResult } from "./provider-result.js";
import { isCircuitOpen, recordProviderError, recordProviderSuccess } from "./circuit-breaker.js";
import { PROVIDER_ERROR_TYPES } from "../tracing.js";
import type { Provider } from "./provider-selector.js";
import { config } from "../config.js";
import { trace } from "@opentelemetry/api";
import { logger } from "../lib/logger.js";

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

  const fetchPromise = (async () => {
    const reqBody = { ...body, model: providerModelId };
    let resp: Response;
    if (provider === "venice") {
      resp = signal !== undefined
        ? await venice.chatCompletion(reqBody as Parameters<typeof venice.chatCompletion>[0], signal)
        : await venice.chatCompletion(reqBody as Parameters<typeof venice.chatCompletion>[0]);
    } else if (provider === "antseed") {
      resp = signal !== undefined
        ? await antseed.chatCompletion(reqBody as Parameters<typeof antseed.chatCompletion>[0], signal)
        : await antseed.chatCompletion(reqBody as Parameters<typeof antseed.chatCompletion>[0]);
    } else if (provider === "openrouter") {
      resp = signal !== undefined
        ? await openrouter.chatCompletion(reqBody as Parameters<typeof openrouter.chatCompletion>[0], signal)
        : await openrouter.chatCompletion(reqBody as Parameters<typeof openrouter.chatCompletion>[0]);
    } else if (provider === "together") {
      resp = signal !== undefined
        ? await together.chatCompletion(reqBody as Parameters<typeof together.chatCompletion>[0], signal)
        : await together.chatCompletion(reqBody as Parameters<typeof together.chatCompletion>[0]);
    } else if (provider === "deepinfra") {
      resp = signal !== undefined
        ? await deepinfra.chatCompletion(reqBody as Parameters<typeof deepinfra.chatCompletion>[0], signal)
        : await deepinfra.chatCompletion(reqBody as Parameters<typeof deepinfra.chatCompletion>[0]);
    } else if (provider === "morpheus") {
      resp = signal !== undefined
        ? await morpheus.chatCompletion(reqBody as Parameters<typeof morpheus.chatCompletion>[0], signal)
        : await morpheus.chatCompletion(reqBody as Parameters<typeof morpheus.chatCompletion>[0]);
    } else if (provider === "surplus") {
      resp = signal !== undefined
        ? await surplus.surplusChatCompletion(reqBody as Parameters<typeof surplus.surplusChatCompletion>[0], signal)
        : await surplus.surplusChatCompletion(reqBody as Parameters<typeof surplus.surplusChatCompletion>[0]);
    } else if (provider === "claude") {
      resp = signal !== undefined
        ? await claude.chatCompletion(reqBody as Parameters<typeof claude.chatCompletion>[0], signal)
        : await claude.chatCompletion(reqBody as Parameters<typeof claude.chatCompletion>[0]);
    } else if (provider === "gemini") {
      resp = signal !== undefined
        ? await gemini.chatCompletion(reqBody as Parameters<typeof gemini.chatCompletion>[0], signal)
        : await gemini.chatCompletion(reqBody as Parameters<typeof gemini.chatCompletion>[0]);
    } else {
      resp = signal !== undefined
        ? await litellm.chatCompletion(reqBody as Parameters<typeof litellm.chatCompletion>[0], signal)
        : await litellm.chatCompletion(reqBody as Parameters<typeof litellm.chatCompletion>[0]);
    }
    return resp;
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(Object.assign(
        new Error(`Provider request timed out after ${timeoutMs}ms`),
        { status: 504, provider, type: PROVIDER_ERROR_TYPES.CONNECTION_ERROR },
      ));
    }, timeoutMs);
  });

  try {
    const resp = await Promise.race([fetchPromise, timeoutPromise]);
    await reportProviderResult(provider, true, Date.now() - start);
    await recordProviderSuccess(provider, providerModelId);
    return resp;
  } catch (err) {
    await reportProviderResult(provider, false, Date.now() - start);
    await recordProviderError(provider, providerModelId);

    const requestBody = body;
    const errorWithContext = Object.assign(err instanceof Error ? err : new Error(String(err)), {
      provider,
      modelId: providerModelId,
      correlationId: requestCorrelationId,
      requestBody,
      type: PROVIDER_ERROR_TYPES.UNKNOWN_ERROR,
    });

    logger.error({
      provider,
      modelId: providerModelId,
      correlationId: requestCorrelationId,
      requestBody,
      error: err instanceof Error ? err.message : String(err),
      type: 'provider_error'
    });
    throw errorWithContext;
  }
}