import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode, SpanKind, context, propagation } from "@opentelemetry/api";
import { RandomIdGenerator } from "@opentelemetry/sdk-trace-base";
import { config } from "./config.js";

// Correlation ID generator
const idGenerator = new RandomIdGenerator();

/**
 * Generate a unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return idGenerator.generateTraceId();
}

/**
 * Get the current trace context as a correlation ID
 */
export function getCorrelationId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;
  return span.spanContext().traceId;
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  Object.entries(attributes).forEach(([key, value]) => {
    span.setAttribute(key, value);
  });
}

/**
 * Create a child span under the current context
 */
export async function withSpan<T>(
  name: string,
  fn: (span?: ReturnType<typeof trace.getActiveSpan>) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
  kind?: SpanKind
): Promise<T> {
  const tracer = trace.getTracer("oma-server");
  return tracer.startActiveSpan(name, { kind: kind ?? SpanKind.INTERNAL }, async (span) => {
    try {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
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

/**
 * LLM-specific span attribute keys following OpenTelemetry semantic conventions
 */
export const LLM_ATTRS = {
  MODEL: "llm.model",
  PROVIDER: "llm.provider",
  USER_ID: "llm.user_id",
  API_KEY_ID: "llm.api_key_id",
  REQUEST_ID: "llm.request_id",
  TOKENS_INPUT: "llm.tokens.input",
  TOKENS_OUTPUT: "llm.tokens.output",
  TOKENS_TOTAL: "llm.tokens.total",
  STREAMING: "llm.streaming",
  TIME_TO_FIRST_TOKEN_MS: "llm.time_to_first_token_ms",
  TOKEN_THROUGHPUT_PER_SEC: "llm.token_throughput_per_sec",
  ERROR: "error",
  ERROR_TYPE: "error.type",
  ERROR_MESSAGE: "error.message",
} as const;

/**
 * Provider error types for categorization
 */
export const PROVIDER_ERROR_TYPES = {
  CONNECTION_ERROR: "connection_error",
  TIMEOUT_ERROR: "timeout_error",
  RATE_LIMIT_ERROR: "rate_limit_error",
  AUTHENTICATION_ERROR: "authentication_error",
  PERMISSION_ERROR: "permission_error",
  INVALID_REQUEST_ERROR: "invalid_request_error",
  NOT_FOUND_ERROR: "not_found_error",
  PAYMENT_REQUIRED_ERROR: "payment_required_error",
  INTERNAL_ERROR: "internal_error",
  SERVER_ERROR: "server_error",
  CIRCUIT_BREAKER: "circuit_breaker",
  UNKNOWN_ERROR: "unknown_error",
} as const;

/**
 * Record metrics for token usage
 */
export function recordTokenMetrics(
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  userId: string
): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttribute(LLM_ATTRS.TOKENS_INPUT, inputTokens);
  span.setAttribute(LLM_ATTRS.TOKENS_OUTPUT, outputTokens);
  span.setAttribute(LLM_ATTRS.TOKENS_TOTAL, inputTokens + outputTokens);
  span.setAttribute(LLM_ATTRS.USER_ID, userId);
  span.setAttribute(LLM_ATTRS.MODEL, model);
  span.setAttribute(LLM_ATTRS.PROVIDER, provider);
}

/**
 * Record streaming-specific metrics
 */
export function recordStreamingMetrics(
  timeToFirstTokenMs: number,
  totalTokens: number,
  durationMs: number
): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttribute(LLM_ATTRS.TIME_TO_FIRST_TOKEN_MS, timeToFirstTokenMs);
  span.setAttribute(LLM_ATTRS.TOKEN_THROUGHPUT_PER_SEC, totalTokens / (durationMs / 1000));
  span.setAttribute("llm.streaming_duration_ms", durationMs);
}

/**
 * Set LLM span attributes for model, provider, user, and apiKey
 */
export function setLlmSpanAttributes(params: {
  model?: string;
  provider?: string;
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
  streaming?: boolean;
  inputTokens?: number;
  outputTokens?: number;
}): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  const { model, provider, userId, apiKeyId, requestId, streaming, inputTokens, outputTokens } = params;

  if (model) span.setAttribute(LLM_ATTRS.MODEL, model);
  if (provider) span.setAttribute(LLM_ATTRS.PROVIDER, provider);
  if (userId) span.setAttribute(LLM_ATTRS.USER_ID, userId);
  if (apiKeyId) span.setAttribute(LLM_ATTRS.API_KEY_ID, apiKeyId);
  if (requestId) span.setAttribute(LLM_ATTRS.REQUEST_ID, requestId);
  if (streaming !== undefined) span.setAttribute(LLM_ATTRS.STREAMING, streaming);
  if (inputTokens !== undefined) span.setAttribute(LLM_ATTRS.TOKENS_INPUT, inputTokens);
  if (outputTokens !== undefined) span.setAttribute(LLM_ATTRS.TOKENS_OUTPUT, outputTokens);
}

/**
 * Set error attributes with provider-specific categorization
 */
export function setErrorAttributes(
  errorType: string,
  message: string,
  provider?: string
): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  span.setAttribute(LLM_ATTRS.ERROR, true);
  span.setAttribute(LLM_ATTRS.ERROR_TYPE, errorType);
  span.setAttribute(LLM_ATTRS.ERROR_MESSAGE, message);

  if (provider) {
    span.setAttribute("llm.error.provider", provider);
  }
}

/**
 * Get trace context for propagation to external services
 */
export function getTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/**
 * Extract trace context from carrier (for incoming requests)
 */
export function extractTraceContext(carrier: Record<string, string>) {
  return propagation.extract(context.active(), carrier);
}

/**
 * Run callback with extracted trace context
 */
export async function withTraceContext<T>(
  carrier: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const extractedContext = extractTraceContext(carrier);
  return context.with(extractedContext, fn);
}

// Span kinds for LLM operations
export const LLM_SPAN_KINDS = {
  INTERNAL: SpanKind.INTERNAL,
  SERVER: SpanKind.SERVER,
  CLIENT: SpanKind.CLIENT,
  PRODUCER: SpanKind.PRODUCER,
  CONSUMER: SpanKind.CONSUMER,
} as const;

// Trace exporter (OTLP HTTP)
const traceExporter = new OTLPTraceExporter({
  url: config.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
});

// Initialize SDK before other imports
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "oma-server",
    [ATTR_SERVICE_VERSION]: "0.1.0",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.NODE_ENV,
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-http": {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          return req.url === "/health";
        },
      },
      "@opentelemetry/instrumentation-express": { enabled: true },
    }),
  ],
});

// Start the SDK
if (config.NODE_ENV !== "test") {
  sdk.start();
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  try {
    await sdk.shutdown();
    console.log("[otel] OpenTelemetry SDK shut down successfully");
  } catch (err) {
    console.error("[otel] Error shutting down OpenTelemetry SDK:", err);
  }
});

export { sdk };