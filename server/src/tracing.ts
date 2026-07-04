import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { RandomIdGenerator } from "@opentelemetry/sdk-trace-base";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

const idGenerator = new RandomIdGenerator();

/**
 * Generate a unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return idGenerator.generateTraceId();
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
         ignoreIncomingRequestHook: (req) => req.url === "/health",
       },
       "@opentelemetry/instrumentation-express": { enabled: true },
     }),
   ],
 });

 if (config.NODE_ENV !== "test") sdk.start();

 process.on("SIGTERM", async () => {
  try {
    await sdk.shutdown();
    logger.info("[otel] OpenTelemetry SDK shut down successfully");
  } catch (err) {
    logger.error("[otel] Error shutting down OpenTelemetry SDK: %s", err);
  }
});

