/**
 * OpenTelemetry SDK bootstrap.
 *
 * Split out of `tracing.ts` so the SDK is only loaded when tracing is
 * actually turned on. The server imports `generateCorrelationId` on every
 * request path, and a static import of the SDK meant every deployment —
 * including the ones that never export a single span — parsed and loaded
 * six OpenTelemetry packages on each cold start.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

/**
 * Start the SDK against an OTLP endpoint.
 *
 * The exporter endpoint is unset in production today. With the SDK running and
 * no endpoint every request built spans that were buffered and shipped to
 * http://localhost:4318 (the exporter default) where nothing listens — real
 * per-request cost for observability output that went nowhere.
 *
 * Setting OTEL_EXPORTER_OTLP_ENDPOINT is all it takes to turn tracing on; the
 * SDK, the instrumentations and the shutdown hook are all kept here.
 */
export function startTracing(endpoint: string): void {
	const traceExporter = new OTLPTraceExporter({ url: endpoint });

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
	logger.info({ endpoint }, "[otel] OpenTelemetry SDK started");

	process.on("SIGTERM", async () => {
		try {
			await sdk.shutdown();
			logger.info("[otel] OpenTelemetry SDK shut down successfully");
		} catch (err) {
			logger.error({ err }, "[otel] Error shutting down OpenTelemetry SDK");
		}
	});
}
