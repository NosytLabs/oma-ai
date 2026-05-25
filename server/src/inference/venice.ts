import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { getActiveVeniceKey } from "./cheaptokens.js";
import { BaseInferenceProvider, createErrorMapper, type ProviderConfig } from "./base.js";
import { createProvider } from "./provider-factory.js";
import { reportProviderResult } from "./provider-health.js";

const VENICE_TIMEOUT_MS = 30_000;
const VENICE_STREAM_TIMEOUT_MS = 120_000;

export interface VeniceParameters {
  enable_web_search?: "off" | "on" | "auto";
  enable_web_scraping?: boolean;
  enable_x_search?: boolean;
  enable_web_citations?: boolean;
  strip_thinking_response?: boolean;
  disable_thinking?: boolean;
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
  [key: string]: unknown;
}): { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown } {
  const veniceParams: VeniceParameters = {
    enable_web_search: body.enable_web_search as VeniceParameters["enable_web_search"],
    enable_web_scraping: body.enable_web_scraping as boolean,
    enable_x_search: body.enable_x_search as boolean,
    enable_web_citations: body.enable_web_citations as boolean,
    strip_thinking_response: body.strip_thinking_response as boolean,
    disable_thinking: body.disable_thinking as boolean,
  };

  const { enable_web_search: _enable_web_search, enable_web_scraping: _enable_web_scraping, enable_x_search: _enable_x_search, enable_web_citations: _enable_web_citations, strip_thinking_response: _strip_thinking_response, disable_thinking: _disable_thinking, model, messages, stream, ...rest } = body;

  const veniceParamsFiltered = Object.fromEntries(
    Object.entries(veniceParams).filter(([, v]) => v !== undefined)
  );

  return {
    ...rest,
    model,
    messages,
    stream,
    ...(Object.keys(veniceParamsFiltered).length > 0 ? { venice_parameters: veniceParamsFiltered } : {}),
  };
}

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
  [key: string]: unknown;
}): Promise<Response> {
  return provider.chatCompletion(buildVeniceChatCompletion(body));
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
  enable_web_search?: "off" | "on" | "auto";
  enable_web_scraping?: boolean;
  enable_x_search?: boolean;
  enable_web_citations?: boolean;
  strip_thinking_response?: boolean;
  disable_thinking?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.streamChatCompletion(buildVeniceChatCompletion(body));
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
    headers: { Authorization: `Bearer ${config.VENICE_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(VENICE_TIMEOUT_MS),
  });

  return resp;
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