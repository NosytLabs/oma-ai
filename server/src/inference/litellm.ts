import { config } from "../config.js";
import { reportProviderResult } from "./circuit-breaker.js";
import type { ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

const LITELLM_TIMEOUT_MS = 30_000;
const LITELLM_STREAM_TIMEOUT_MS = 120_000;

function litellmUrl(path: string): string {
  const base = config.LITELLM_PROXY_URL?.replace(/\/+$/, "") ?? "";
  if (!base) throw Object.assign(new Error("LiteLLM not configured"), { status: 503 });
  return `${base}${path}`;
}

function litellmHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.LITELLM_API_KEY) {
    headers["Authorization"] = `Bearer ${config.LITELLM_API_KEY}`;
  }
  return headers;
}

function mapLitellmError(status: number, body: string): never {
  let type = "litellm_api_error";
  let message = `LiteLLM error ${status}`;

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

  return tracer.startActiveSpan("llm.provider.litellm", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      span.setAttribute("llm.provider", "litellm");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", litellmUrl("/v1/chat/completions"));

      if (!config.LITELLM_PROXY_URL) {
        span.setAttribute("error", true);
        span.setAttribute("error.type", "configuration_error");
        throw Object.assign(new Error("LiteLLM not configured"), { status: 503 });
      }

      const timeout = body.stream ? LITELLM_STREAM_TIMEOUT_MS : LITELLM_TIMEOUT_MS;
      const start = Date.now();

      let resp: Response;
      try {
        resp = await fetch(litellmUrl("/v1/chat/completions"), {
          method: "POST",
          headers: litellmHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (err) {
        await reportProviderResult("litellm", false, Date.now() - start);
        span.setAttribute("error", true);
        span.setAttribute("error.type", "connection_error");
        const message = err instanceof Error ? err.message : String(err);
        throw Object.assign(
          new Error(`LiteLLM connection failed: ${message}`),
          { status: 502 }
        );
      }

      span.setAttribute("http.status_code", resp.status);

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        if (resp.status >= 500) {
          await reportProviderResult("litellm", false, Date.now() - start);
        }
        span.setAttribute("error", true);
        mapLitellmError(resp.status, text);
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
  if (!config.LITELLM_PROXY_URL) {
    throw Object.assign(new Error("LiteLLM not configured"), { status: 503 });
  }

  const timeout = body.stream ? LITELLM_STREAM_TIMEOUT_MS : LITELLM_TIMEOUT_MS;
  const start = Date.now();

  let resp: Response;
  try {
    resp = await fetch(litellmUrl("/v1/completions"), {
      method: "POST",
      headers: litellmHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    await reportProviderResult("litellm", false, Date.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    throw Object.assign(
      new Error(`LiteLLM connection failed: ${message}`),
      { status: 502 }
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status >= 500) {
      await reportProviderResult("litellm", false, Date.now() - start);
    }
    mapLitellmError(resp.status, text);
  }

  return resp;
}

export function streamChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return chatCompletion({ ...body, stream: true });
}

export async function litellmHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs: number;
}> {
  if (!config.LITELLM_PROXY_URL) {
    return { isUp: false, latencyMs: -1 };
  }

  const start = Date.now();

  try {
    const resp = await fetch(litellmUrl("/health"), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    return { isUp: resp.ok, latencyMs };
  } catch {
    return { isUp: false, latencyMs: Date.now() - start };
  }
}

export { chatCompletion as litellmChatCompletion };
