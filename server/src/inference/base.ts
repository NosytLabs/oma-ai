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