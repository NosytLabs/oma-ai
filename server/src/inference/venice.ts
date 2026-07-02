import { config } from "../config.js";
import type { ChatMessage, InferenceError } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { getActiveVeniceKey } from "./cheaptokens.js";
import { BaseInferenceProvider, type ProviderConfig } from "./base.js";
import { createProvider } from "./provider-factory.js";
import { reportProviderResult } from "./provider-result.js";
import { logger } from "../lib/logger.js";

const VENICE_TIMEOUT_MS = 30_000;
const VENICE_STREAM_TIMEOUT_MS = 120_000;
const VENICE_HEALTH_TIMEOUT_MS = 5_000;

export interface VeniceParameters {
  enable_web_search?: "off" | "on" | "auto";
  enable_web_scraping?: boolean;
  enable_x_search?: boolean;
  enable_web_citations?: boolean;
  strip_thinking_response?: boolean;
  disable_thinking?: boolean;
  include_venice_system_prompt?: boolean;
  private?: boolean;
}

export function buildVeniceChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  enable_web_search?: "off" | "on" | "auto";
  enable_web_scraping?: boolean;
  enable_x_search?: boolean;
  enable_web_citations?: boolean;
  strip_thinking_response?: boolean;
  disable_thinking?: boolean;
  include_venice_system_prompt?: boolean;
  private?: boolean;
  [key: string]: unknown;
}): { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown } {
  // Privacy gate: by default venice_parameters.private = true so user data is
  // never used for training. Set OMMA_ALLOW_NON_PRIVATE_VENICE=true in config
  // to let callers opt out (private:false) for non-sensitive traffic.
  const allowNonPrivate = !!config.OMMA_ALLOW_NON_PRIVATE_VENICE;
  const callerPrivate = body.private;
  const effectivePrivate: boolean =
    callerPrivate === undefined
      ? true
      : allowNonPrivate
        ? callerPrivate
        : true;

  const veniceParams: VeniceParameters = {
    enable_web_search: body.enable_web_search as VeniceParameters["enable_web_search"],
    enable_web_scraping: body.enable_web_scraping as boolean,
    enable_x_search: body.enable_x_search as boolean,
    enable_web_citations: body.enable_web_citations as boolean,
    strip_thinking_response: body.strip_thinking_response as boolean,
    disable_thinking: body.disable_thinking as boolean,
    include_venice_system_prompt: body.include_venice_system_prompt as boolean,
    private: effectivePrivate,
  };

  const {
    enable_web_search: _enable_web_search,
    enable_web_scraping: _enable_web_scraping,
    enable_x_search: _enable_x_search,
    enable_web_citations: _enable_web_citations,
    strip_thinking_response: _strip_thinking_response,
    disable_thinking: _disable_thinking,
    include_venice_system_prompt: _include_venice_system_prompt,
    private: _private,
    model,
    messages,
    stream,
    ...rest
  } = body;

  const veniceParamsFiltered = Object.fromEntries(
    Object.entries(veniceParams).filter(([, v]) => v !== undefined)
  );

  return {
    ...rest,
    model,
    messages,
    stream,
    ...(Object.keys(veniceParamsFiltered).length > 0
      ? { venice_parameters: veniceParamsFiltered }
      : {}),
  };
}

function veniceHeaders(options?: { skipContentType?: boolean }): Record<string, string> {
  // Resolves the active CheapTokens reseller key, falling back to the static
  // VENICE_API_KEY. All Venice endpoints should go through this so a cached
  // CheapTokens key (which may have a different spend quota) takes priority.
  const activeKey = getActiveVeniceKey() || config.VENICE_API_KEY;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${activeKey}`,
  };
  if (!options?.skipContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

/**
 * Log Venice-specific response headers for observability and support.
 *  - CF-RAY: Cloudflare ray ID (critical for Venice support tickets).
 *    Logged at info level on errors, debug level on success to avoid noise.
 *  - x-venice-model-deprecation-warning: signals an upcoming model deprecation
 *  - x-venice-model-deprecation-date: the deprecation effective date
 */
function logVeniceResponseHeaders(
  resp: Response,
  endpoint: string,
  model?: string,
): void {
  // Defensive: `resp.headers` is always present on a real fetch Response, but
  // guard against undefined so header-logging can never mask the downstream
  // error mapping (mapVeniceError) by throwing an opaque TypeError.
  const headers = resp.headers;
  if (!headers || typeof headers.get !== "function") return;
  const cfRay = headers.get("CF-RAY");
  const deprecationWarning = headers.get("x-venice-model-deprecation-warning");
  const deprecationDate = headers.get("x-venice-model-deprecation-date");
  if (cfRay) {
    if (!resp.ok) {
      logger.info({ cfRay, endpoint, model, status: resp.status, type: "venice_cf_ray" }, "Venice CF-RAY (error)");
    } else {
      logger.debug({ cfRay, endpoint, model, type: "venice_cf_ray" }, "Venice CF-RAY");
    }
  }
  if (deprecationWarning || deprecationDate) {
    logger.warn(
      { endpoint, model, deprecationWarning, deprecationDate, type: "venice_model_deprecated" },
      "Venice model deprecation warning",
    );
  }
}

const mapVeniceError = createVeniceErrorMapper();

/**
 * Type-safe Venice error mapper. Throws an Error decorated with `status`,
 * `code` (machine-readable identifier), `retryable` (boolean for circuit
 * breaker / retry policy), and `type` (legacy field for backward compat).
 *
 * Coverage:
 *  - 401  → venice_unauthorized         (not retryable)
 *  - 402  → venice_credits_exhausted    (not retryable)
 *  - 422  → venice_content_policy       (not retryable)
 *  - 429  → venice_rate_limited         (retryable, has retryAfter)
 *  - 500+ → venice_server_error         (retryable for 500/502/503/504; 501 not retryable)
 *  - 524  → venice_upstream_timeout     (retryable, Cloudflare-specific)
 *  - other → venice_api_error           (retryable for 5xx, not retryable for 4xx)
 */
function createVeniceErrorMapper(): (status: number, body: string) => never {
  return (status: number, body: string): never => {
    let message = `Venice error ${status}`;
    let type = "venice_api_error";
    let code = "venice_api_error";
    let retryable = status >= 500;

    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) message = parsed.error.message;
      if (parsed.error?.type) type = parsed.error.type;
    } catch {
      message = body.slice(0, 500) || message;
    }

    if (status === 401) {
      code = "venice_unauthorized";
      type = "venice_unauthorized";
      retryable = false;
    } else if (status === 402) {
      code = "venice_credits_exhausted";
      type = "venice_credits_exhausted";
      message = message || "Venice API credits exhausted";
      retryable = false;
    } else if (status === 422) {
      code = "venice_content_policy";
      type = "venice_content_policy";
      message = message || "Venice content policy violation";
      retryable = false;
    } else if (status === 429) {
      code = "venice_rate_limited";
      type = "venice_rate_limited";
      retryable = true;
    } else if (status === 524) {
      code = "venice_upstream_timeout";
      type = "venice_upstream_timeout";
      message = message || "Venice upstream timeout (Cloudflare 524)";
      retryable = true;
    } else if (status >= 500) {
      code = "venice_server_error";
      type = "venice_server_error";
      // 501 Not Implemented is a permanent failure; everything else 5xx is retryable
      retryable = status !== 501;
    } else if (status >= 400) {
      code = `venice_client_error_${status}`;
      retryable = false;
    }

    throw Object.assign(new Error(message), { status, code, retryable, type }) as InferenceError;
  };
}

function checkVeniceConfig(): void {
  if (!config.VENICE_API_KEY) {
    throw Object.assign(
      new Error("Venice API key not configured"),
      { status: 503, code: "venice_config_missing", retryable: false, type: "venice_config_missing" }
    ) as InferenceError;
  }
}

function veniceUrl(path: string): string {
  const base = config.VENICE_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

class VeniceProvider extends BaseInferenceProvider {
  protected readonly config: ProviderConfig;

  constructor(providerConfig: ProviderConfig) {
    super();
    this.config = providerConfig;
  }

  protected get spanName(): string {
    return "llm.provider.venice";
  }

  public async embeddings(body: {
    model: string;
    input: string | string[];
    [key: string]: unknown;
  }): Promise<Response> {
    const tracer = trace.getTracer(this.tracerName);

    return tracer.startActiveSpan(`${this.spanName}.embeddings`, { kind: SpanKind.CLIENT }, async (span) => {
      const start = Date.now();
      try {
        span.setAttribute("llm.provider", this.config.name);
        span.setAttribute("llm.model", body.model);
        span.setAttribute("http.method", "POST");
        span.setAttribute("http.url", this.config.getUrl("/api/v1/embeddings"));

        checkVeniceConfig();

        const resp = await fetch(this.config.getUrl("/api/v1/embeddings"), {
          method: "POST",
          headers: veniceHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(VENICE_TIMEOUT_MS),
        });

        logVeniceResponseHeaders(resp, "/embeddings", body.model);
        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          span.setAttribute("error", true);
          if (resp.status >= 500) {
            await reportProviderResult("venice", false, Date.now() - start);
          }
          mapVeniceError(resp.status, text);
        } else {
          await reportProviderResult("venice", true, Date.now() - start);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return resp;
      } catch (err) {
        await reportProviderResult("venice", false, Date.now() - start);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        if ((err as { status?: number }).status !== undefined) {
          throw err;
        }
        throw Object.assign(new Error(err instanceof Error ? err.message : String(err)), { cause: err });
      } finally {
        span.end();
      }
    });
  }

  public async imageGeneration(body: {
    model: string;
    prompt: string;
    n?: number;
    size?: string;
    [key: string]: unknown;
  }): Promise<Response> {
    const tracer = trace.getTracer(this.tracerName);

    return tracer.startActiveSpan(`${this.spanName}.image`, { kind: SpanKind.CLIENT }, async (span) => {
      const start = Date.now();
      try {
        span.setAttribute("llm.provider", this.config.name);
        span.setAttribute("llm.model", body.model);
        span.setAttribute("http.method", "POST");
        span.setAttribute("http.url", this.config.getUrl("/api/v1/image/generate"));

        checkVeniceConfig();

        const resp = await fetch(this.config.getUrl("/api/v1/image/generate"), {
          method: "POST",
          headers: veniceHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(VENICE_TIMEOUT_MS),
        });

        logVeniceResponseHeaders(resp, "/image/generate", body.model);
        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          span.setAttribute("error", true);
          if (resp.status >= 500) {
            await reportProviderResult("venice", false, Date.now() - start);
          }
          mapVeniceError(resp.status, text);
        } else {
          await reportProviderResult("venice", true, Date.now() - start);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return resp;
      } catch (err) {
        await reportProviderResult("venice", false, Date.now() - start);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        if ((err as { status?: number }).status !== undefined) {
          throw err;
        }
        throw Object.assign(new Error(err instanceof Error ? err.message : String(err)), { cause: err });
      } finally {
        span.end();
      }
    });
  }

  public async textToSpeech(body: {
    model: string;
    input: string;
    voice?: string;
    response_format?: string;
    [key: string]: unknown;
  }): Promise<Response> {
    const tracer = trace.getTracer(this.tracerName);

    return tracer.startActiveSpan(`${this.spanName}.tts`, { kind: SpanKind.CLIENT }, async (span) => {
      const start = Date.now();
      try {
        span.setAttribute("llm.provider", this.config.name);
        span.setAttribute("llm.model", body.model);
        span.setAttribute("http.method", "POST");
        span.setAttribute("http.url", this.config.getUrl("/api/v1/audio/speech"));

        checkVeniceConfig();

        const resp = await fetch(this.config.getUrl("/api/v1/audio/speech"), {
          method: "POST",
          headers: veniceHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(VENICE_TIMEOUT_MS),
        });

        logVeniceResponseHeaders(resp, "/audio/speech", body.model);
        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          span.setAttribute("error", true);
          if (resp.status >= 500) {
            await reportProviderResult("venice", false, Date.now() - start);
          }
          mapVeniceError(resp.status, text);
        } else {
          await reportProviderResult("venice", true, Date.now() - start);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return resp;
      } catch (err) {
        await reportProviderResult("venice", false, Date.now() - start);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        if ((err as { status?: number }).status !== undefined) {
          throw err;
        }
        throw Object.assign(new Error(err instanceof Error ? err.message : String(err)), { cause: err });
      } finally {
        span.end();
      }
    });
  }
}

const provider = createProvider(
  {
    name: "venice",
    apiKeyConfigPath: "VENICE_API_KEY",
    baseUrl: config.VENICE_API_URL,
    endpoints: {
      chat: "/api/v1/chat/completions",
      completion: "/api/v1/completions",
      health: "/api/v1/models",
    },
    reportHealth: false,
    defaultTimeoutMs: VENICE_TIMEOUT_MS,
    streamTimeoutMs: VENICE_STREAM_TIMEOUT_MS,
    getHeaders: veniceHeaders,
    errorMapper: mapVeniceError,
  },
  VeniceProvider
);

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  enable_web_search?: "off" | "on" | "auto";
  enable_web_scraping?: boolean;
  enable_x_search?: boolean;
  enable_web_citations?: boolean;
  strip_thinking_response?: boolean;
  disable_thinking?: boolean;
  include_venice_system_prompt?: boolean;
  [key: string]: unknown;
}, signal?: AbortSignal): Promise<Response> {
  return provider.chatCompletion(buildVeniceChatCompletion(body), signal);
}

export async function embeddings(body: {
  model: string;
  input: string | string[];
  [key: string]: unknown;
}): Promise<Response> {
  return provider.embeddings(body);
}

export async function imageGeneration(body: {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.imageGeneration(body);
}

export async function textToSpeech(body: {
  model: string;
  input: string;
  voice?: string;
  response_format?: string;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.textToSpeech(body);
}

export async function veniceModels(): Promise<unknown[]> {
  if (!config.VENICE_API_KEY) {
    throw Object.assign(
      new Error("Venice API key not configured"),
      { status: 503, code: "venice_config_missing", retryable: false, type: "venice_config_missing" }
    ) as InferenceError;
  }

  const resp = await fetch(veniceUrl("/api/v1/models"), {
    // Fix B1: route through veniceHeaders() so a cached CheapTokens key
    // (when present) is used instead of the static VENICE_API_KEY.
    headers: veniceHeaders(),
    signal: AbortSignal.timeout(10_000),
  });

  logVeniceResponseHeaders(resp, "/models");

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    mapVeniceError(resp.status, text);
  }

  const data = await resp.json();
  return data.data ?? data;
}

export async function transcription(body: {
  model: string;
  file: File;
  language?: string;
  prompt?: string;
  response_format?: string;
  temperature?: number;
}): Promise<Response> {
  checkVeniceConfig();

  const formData = new FormData();
  formData.append("model", body.model);
  formData.append("file", body.file);
  if (body.language) formData.append("language", body.language);
  if (body.prompt) formData.append("prompt", body.prompt);
  if (body.response_format) formData.append("response_format", body.response_format);
  if (body.temperature !== undefined) formData.append("temperature", String(body.temperature));

  const resp = await fetch(veniceUrl("/api/v1/audio/transcriptions"), {
    method: "POST",
    // Fix B1: route through veniceHeaders() to honor the CheapTokens reseller
    // key. skipContentType is required because FormData sets its own
    // multipart Content-Type (with boundary).
    headers: veniceHeaders({ skipContentType: true }),
    body: formData,
    signal: AbortSignal.timeout(VENICE_TIMEOUT_MS),
  });

  logVeniceResponseHeaders(resp, "/audio/transcriptions", body.model);

  return resp;
}

export async function videoQuote(body: {
  model: string;
  prompt: string;
  duration?: string;
  aspect_ratio?: string;
  resolution?: string;
  image_url?: string;
}): Promise<{ price: number; currency: string; estimated_seconds: number }> {
  const response = await fetch(veniceUrl("/api/v1/video/quote"), {
    method: "POST",
    headers: veniceHeaders(),
    body: JSON.stringify({
      model: body.model,
      prompt: body.prompt,
      duration: body.duration || "5s",
      aspect_ratio: body.aspect_ratio || "16:9",
      resolution: body.resolution || "720p",
      ...(body.image_url && { image_url: body.image_url }),
    }),
    signal: AbortSignal.timeout(VENICE_TIMEOUT_MS),
  });

  logVeniceResponseHeaders(response, "/video/quote", body.model);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    mapVeniceError(response.status, text);
  }

  const data = await response.json();
  return {
    price: data.price ?? 0,
    currency: data.currency ?? "usd",
    estimated_seconds: data.estimated_seconds ?? 0,
  };
}

export async function videoGeneration(body: {
  model: string;
  prompt: string;
  duration?: string;
  aspect_ratio?: string;
  resolution?: string;
  image_url?: string;
}): Promise<{ queueId: string; status: string }> {
  const response = await fetch(veniceUrl("/api/v1/video/queue"), {
    method: "POST",
    headers: veniceHeaders(),
    body: JSON.stringify({
      model: body.model,
      prompt: body.prompt,
      duration: body.duration || "5s",
      aspect_ratio: body.aspect_ratio || "16:9",
      resolution: body.resolution || "720p",
      ...(body.image_url && { image_url: body.image_url }),
    }),
    signal: AbortSignal.timeout(VENICE_TIMEOUT_MS),
  });

  logVeniceResponseHeaders(response, "/video/queue", body.model);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    mapVeniceError(response.status, text);
  }

  const data = await response.json();
  return { queueId: data.queue_id, status: "queued" };
}

export async function retrieveVideo(queueId: string): Promise<{
  status: string;
  video_url?: string;
  download_url?: string;
}> {
  const response = await fetch(
    veniceUrl(`/api/v1/video/retrieve?queue_id=${queueId}`),
    { headers: veniceHeaders(), signal: AbortSignal.timeout(VENICE_TIMEOUT_MS) }
  );

  logVeniceResponseHeaders(response, "/video/retrieve");

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    mapVeniceError(response.status, text);
  }

  return response.json();
}

export interface VeniceHealthResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Public health check for the Venice API. Pings the public models endpoint
 * (no auth required) with a tight 5s timeout so the operator dashboard
 * (/v1/providers/meta) can surface liveness without a slow request hanging
 * the whole response.
 *
 * Shape intentionally matches the surplus convention so the meta
 * route can be agnostic about which provider produced the result.
 */
export async function healthCheckVenice(): Promise<VeniceHealthResult> {
  const start = Date.now();
  try {
    const resp = await fetch("https://api.venice.ai/api/v1/models", {
      method: "GET",
      signal: AbortSignal.timeout(VENICE_HEALTH_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - start;
    if (!resp.ok) {
      return { ok: false, latencyMs, error: `Venice health ${resp.status}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export { chatCompletion as veniceChatCompletion };