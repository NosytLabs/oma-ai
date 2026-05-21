import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { getActiveVeniceKey } from "./cheaptokens.js";

const VENICE_TIMEOUT_MS = 30_000;
const VENICE_STREAM_TIMEOUT_MS = 120_000;

function veniceUrl(path: string): string {
  const base = config.VENICE_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function veniceHeaders(): Record<string, string> {
  const activeKey = getActiveVeniceKey() || config.VENICE_API_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${activeKey}`,
  };
}

function mapVeniceError(status: number, body: string): never {
  let type = "venice_api_error";
  let message = `Venice API error ${status}`;

  try {
    const parsed = JSON.parse(body);
    if (parsed.error?.message) message = parsed.error.message;
    if (parsed.error?.type) type = parsed.error.type;
  } catch {
    message = body.slice(0, 500);
  }

  throw Object.assign(new Error(message), { status, type });
}

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  const tracer = trace.getTracer("oma-server");

  return tracer.startActiveSpan("llm.provider.venice", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "venice");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", veniceUrl("/api/v1/chat/completions"));

      if (!config.VENICE_API_KEY) {
        span.setAttribute("error", true);
        span.setAttribute("error.type", "configuration_error");
        throw Object.assign(new Error("Venice API key not configured"), { status: 503 });
      }

      const timeout = body.stream ? VENICE_STREAM_TIMEOUT_MS : VENICE_TIMEOUT_MS;
      const resp = await fetch(veniceUrl("/api/v1/chat/completions"), {
        method: "POST",
        headers: veniceHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
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

export async function completion(body: {
  model: string;
  prompt?: string | Array<string>;
  input?: string | Array<string>;
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  const tracer = trace.getTracer("oma-server");

  return tracer.startActiveSpan("llm.provider.venice.completion", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "venice");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", veniceUrl("/api/v1/completions"));

      if (!config.VENICE_API_KEY) {
        span.setAttribute("error", true);
        span.setAttribute("error.type", "configuration_error");
        throw Object.assign(new Error("Venice API key not configured"), { status: 503 });
      }

      const timeout = body.stream ? VENICE_STREAM_TIMEOUT_MS : VENICE_TIMEOUT_MS;
      const resp = await fetch(veniceUrl("/api/v1/completions"), {
        method: "POST",
        headers: veniceHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
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

export async function embeddings(body: {
  model: string;
  input: string | string[];
  [key: string]: unknown;
}): Promise<Response> {
  const tracer = trace.getTracer("oma-server");

  return tracer.startActiveSpan("llm.provider.venice.embeddings", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "venice");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", veniceUrl("/api/v1/embeddings"));

      if (!config.VENICE_API_KEY) {
        span.setAttribute("error", true);
        span.setAttribute("error.type", "configuration_error");
        throw Object.assign(new Error("Venice API key not configured"), { status: 503 });
      }

      const resp = await fetch(veniceUrl("/api/v1/embeddings"), {
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

export async function imageGeneration(body: {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  [key: string]: unknown;
}): Promise<Response> {
  const tracer = trace.getTracer("oma-server");

  return tracer.startActiveSpan("llm.provider.venice.image", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "venice");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", veniceUrl("/api/v1/image/generate"));

      if (!config.VENICE_API_KEY) {
        span.setAttribute("error", true);
        span.setAttribute("error.type", "configuration_error");
        throw Object.assign(new Error("Venice API key not configured"), { status: 503 });
      }

      const resp = await fetch(veniceUrl("/api/v1/image/generate"), {
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

export async function textToSpeech(body: {
  model: string;
  input: string;
  voice?: string;
  response_format?: string;
  [key: string]: unknown;
}): Promise<Response> {
  const tracer = trace.getTracer("oma-server");

  return tracer.startActiveSpan("llm.provider.venice.tts", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "venice");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", veniceUrl("/api/v1/audio/speech"));

      if (!config.VENICE_API_KEY) {
        span.setAttribute("error", true);
        span.setAttribute("error.type", "configuration_error");
        throw Object.assign(new Error("Venice API key not configured"), { status: 503 });
      }

      const resp = await fetch(veniceUrl("/api/v1/audio/speech"), {
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

export function streamChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return chatCompletion({ ...body, stream: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function veniceModels(): Promise<any[]> {
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

export { chatCompletion as veniceChatCompletion };
