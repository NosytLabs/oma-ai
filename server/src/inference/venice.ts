import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { getActiveVeniceKey } from "./cheaptokens.js";
import { BaseInferenceProvider, createErrorMapper, type ProviderConfig } from "./base.js";
import { createProvider } from "./provider-factory.js";

const VENICE_TIMEOUT_MS = 30_000;
const VENICE_STREAM_TIMEOUT_MS = 120_000;

function veniceHeaders(): Record<string, string> {
  const activeKey = getActiveVeniceKey() || config.VENICE_API_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${activeKey}`,
  };
}

const mapVeniceError = createErrorMapper("Venice");

function checkVeniceConfig(): void {
  if (!config.VENICE_API_KEY) {
    throw Object.assign(new Error("Venice API key not configured"), { status: 503 });
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

        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          span.setAttribute("error", true);
          mapVeniceError(resp.status, text);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return resp;
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
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

        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          span.setAttribute("error", true);
          mapVeniceError(resp.status, text);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return resp;
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
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

        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          span.setAttribute("error", true);
          mapVeniceError(resp.status, text);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return resp;
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
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
  },
  VeniceProvider
);

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.chatCompletion(body);
}

export async function completion(body: {
  model: string;
  prompt?: string | Array<string>;
  input?: string | Array<string>;
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.completion(body);
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

export function streamChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.streamChatCompletion(body);
}

export async function veniceModels(): Promise<unknown[]> {
  if (!config.VENICE_API_KEY) {
    throw Object.assign(new Error("Venice API key not configured"), { status: 503 });
  }

  const resp = await fetch(veniceUrl("/api/v1/models"), {
    headers: { Authorization: `Bearer ${config.VENICE_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`Venice models error ${resp.status}: ${text.slice(0, 500)}`),
      { status: resp.status }
    );
  }

  const data = await resp.json();
  return data.data ?? data;
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

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw Object.assign(
      new Error(`Video generation failed: ${response.status} - ${text.slice(0, 500)}`),
      { status: response.status, type: "venice_api_error" }
    );
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

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw Object.assign(
      new Error(`Video retrieval failed: ${response.status} - ${text.slice(0, 500)}`),
      { status: response.status, type: "venice_api_error" }
    );
  }

  return response.json();
}

export { chatCompletion as veniceChatCompletion };