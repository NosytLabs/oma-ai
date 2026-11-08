import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

/**
 * Generate a unique correlation ID for request tracing.
 *
 * Uses `node:crypto` rather than the OpenTelemetry id generator so the hot
 * request path stays free of the tracing SDK.
 */
export function generateCorrelationId(): string {
	return randomUUID();
}

/**
 * Tracing is off unless an OTLP endpoint is configured.
 *
 * The SDK lives in `tracing-sdk.ts` and is loaded with a dynamic import, so a
 * deployment that never exports traces does not pay to parse six
 * OpenTelemetry packages on every cold start (Neon functions cold-start per
 * request burst). Setting OTEL_EXPORTER_OTLP_ENDPOINT is all it takes to turn
 * tracing on.
 */
const otlpEndpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint && config.NODE_ENV !== "test") {
	void import("./tracing-sdk.js")
		.then(({ startTracing }) => startTracing(otlpEndpoint))
		.catch((err) => {
			logger.error({ err }, "[otel] failed to start the OpenTelemetry SDK");
		});
} else {
	logger.info(
		"[otel] tracing disabled (set OTEL_EXPORTER_OTLP_ENDPOINT to enable)",
	);
}
