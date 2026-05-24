import { reportProviderResult } from "./provider-health.js";
import type { ChatMessage } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

export interface ProviderConfig {
  name: string;
  chatCompletionPath: string;
  completionPath: string;
  healthPath: string;
  defaultTimeoutMs: number;
  streamTimeoutMs: number;
  getUrl: (path: string) => string;
  getHeaders: () => Record<string, string>;
  mapError: (status: number, body: string) => never;
  checkConfig: () => void;
  reportHealth?: boolean;
}

export abstract class BaseInferenceProvider {
  protected abstract readonly config: ProviderConfig;

  protected get timeoutMs(): number {
    return this.config.defaultTimeoutMs;
  }

  protected get streamTimeoutMs(): number {
    return this.config.streamTimeoutMs;
  }

  protected get tracerName(): string {
    return "oma-server";
  }

  protected get spanName(): string {
    return `llm.provider.${this.config.name}`;
  }

  protected async chatCompletionInternal(
    body: {
      model: string;
      messages?: ChatMessage[];
      stream?: boolean;
      [key: string]: unknown;
    },
    path?: string
  ): Promise<Response> {
    const tracer = trace.getTracer(this.tracerName);
    const endpoint = path ?? this.config.chatCompletionPath;

    return tracer.startActiveSpan(`${this.spanName}`, { kind: SpanKind.CLIENT }, async (span) => {
      try {
        span.setAttribute("llm.provider", this.config.name);
        span.setAttribute("llm.model", body.model);
        span.setAttribute("http.method", "POST");
        span.setAttribute("http.url", this.config.getUrl(endpoint));

        this.config.checkConfig();

        const timeout = body.stream ? this.streamTimeoutMs : this.timeoutMs;
        const start = Date.now();

        let resp: Response;
        try {
          resp = await fetch(this.config.getUrl(endpoint), {
            method: "POST",
            headers: this.config.getHeaders(),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout),
          });
        } catch (err) {
          if (this.config.reportHealth !== false) {
            await reportProviderResult(this.config.name as "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra", false, Date.now() - start);
          }
          span.setAttribute("error", true);
          span.setAttribute("error.type", "connection_error");
          const message = err instanceof Error ? err.message : String(err);
          throw Object.assign(
            new Error(`${this.config.name} connection failed: ${message}`),
            { status: 502 }
          );
        }

        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          if (resp.status >= 500 && this.config.reportHealth !== false) {
            await reportProviderResult(this.config.name as "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra", false, Date.now() - start);
          }
          span.setAttribute("error", true);
          this.config.mapError(resp.status, text);
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

  protected async completionInternal(
    body: {
      model: string;
      prompt?: string | Array<string>;
      input?: string | Array<string>;
      stream?: boolean;
      [key: string]: unknown;
    },
    path?: string
  ): Promise<Response> {
    const tracer = trace.getTracer(this.tracerName);
    const endpoint = path ?? this.config.completionPath;

    return tracer.startActiveSpan(`${this.spanName}`, { kind: SpanKind.CLIENT }, async (span) => {
      try {
        span.setAttribute("llm.provider", this.config.name);
        span.setAttribute("llm.model", body.model);
        span.setAttribute("llm.streaming", body.stream ?? false);
        span.setAttribute("http.method", "POST");
        span.setAttribute("http.url", this.config.getUrl(endpoint));

        this.config.checkConfig();

        const timeout = body.stream ? this.streamTimeoutMs : this.timeoutMs;
        const start = Date.now();

        let resp: Response;
        try {
          resp = await fetch(this.config.getUrl(endpoint), {
            method: "POST",
            headers: this.config.getHeaders(),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout),
          });
        } catch (err) {
          if (this.config.reportHealth !== false) {
            await reportProviderResult(this.config.name as "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra", false, Date.now() - start);
          }
          span.setAttribute("error", true);
          span.setAttribute("error.type", "connection_error");
          const message = err instanceof Error ? err.message : String(err);
          throw Object.assign(
            new Error(`${this.config.name} connection failed: ${message}`),
            { status: 502 }
          );
        }

        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          if (resp.status >= 500 && this.config.reportHealth !== false) {
            await reportProviderResult(this.config.name as "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra", false, Date.now() - start);
          }
          span.setAttribute("error", true);
          this.config.mapError(resp.status, text);
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

  public async chatCompletion(body: {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    [key: string]: unknown;
  }): Promise<Response> {
    return this.chatCompletionInternal(body);
  }

  public async completion(body: {
    model: string;
    prompt?: string | Array<string>;
    input?: string | Array<string>;
    stream?: boolean;
    [key: string]: unknown;
  }): Promise<Response> {
    return this.completionInternal(body);
  }

  public streamChatCompletion(body: {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    [key: string]: unknown;
  }): Promise<Response> {
    return this.chatCompletion({ ...body, stream: true });
  }
}

export function createErrorMapper(providerName: string) {
  return function mapError(status: number, body: string): never {
    let type = `${providerName}_api_error`;
    let message = `${providerName} error ${status}`;

    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) message = parsed.error.message;
      if (parsed.error?.type) type = parsed.error.type;
    } catch {
      message = body.slice(0, 500);
    }

    throw Object.assign(new Error(message), { status, type });
  };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryStatuses?: number[];
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, delay: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryStatuses = [429, 500, 502, 503, 504],
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    onRetry,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const errorObj = err as { status?: number; retryAfter?: number };
      const isRetryable = retryStatuses.includes(errorObj?.status ?? 0);

      if (attempt === maxRetries || !isRetryable) {
        throw err;
      }

      const retryAfter = errorObj?.retryAfter;
      let delay: number;
      if (retryAfter) {
        delay = retryAfter * 1000;
      } else {
        const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * 0.3 * exponentialDelay;
        delay = exponentialDelay + jitter;
      }

      onRetry?.(attempt + 1, delay, err instanceof Error ? err : new Error(String(err)));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry loop exited unexpectedly");
}