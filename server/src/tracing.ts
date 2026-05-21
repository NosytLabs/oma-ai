import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
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

  span.setAttribute("llm.tokens.input", inputTokens);
  span.setAttribute("llm.tokens.output", outputTokens);
  span.setAttribute("llm.tokens.total", inputTokens + outputTokens);
  span.setAttribute("llm.user_id", userId);
  span.setAttribute("llm.model", model);
  span.setAttribute("llm.provider", provider);
}

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