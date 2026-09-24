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
const LLM_ATTRS = {
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

/**
 * Trace exporter endpoint.
 *
 * Unset in production today. The SDK auto-instruments http + express, so with
 * the SDK running and no endpoint every request built spans that were buffered
 * and shipped to http://localhost:4318 (the exporter default) where nothing
 * listens -- real per-request cost for observability output that went nowhere.
 *
 * Setting OTEL_EXPORTER_OTLP_ENDPOINT is all it takes to turn tracing on; the
 * SDK, the instrumentations and the shutdown hook are all kept below.
 */
const otlpEndpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint && config.NODE_ENV !== "test") {
	const traceExporter = new OTLPTraceExporter({ url: otlpEndpoint });

	// Initialize SDK before other imports
	const sdk = new NodeSDK({
		resource: resourceFromAttributes({
			[ATTR_SERVICE_NAME]: config.OTEL_SERVICE_NAME ?? "oma-server",
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

	sdk.start();
	logger.info(
		{ endpoint: otlpEndpoint },
		"[otel] OpenTelemetry SDK started",
	);

	process.on("SIGTERM", async () => {
		try {
			await sdk.shutdown();
			logger.info("[otel] OpenTelemetry SDK shut down successfully");
		} catch (err) {
			logger.error({ err }, "[otel] Error shutting down OpenTelemetry SDK");
		}
	});
} else {
	// generateCorrelationId() below is still used for request correlation, so
	// the module stays imported; only the exporter machinery is skipped.
	logger.info(
		"[otel] tracing disabled (set OTEL_EXPORTER_OTLP_ENDPOINT to enable)",
	);
}

