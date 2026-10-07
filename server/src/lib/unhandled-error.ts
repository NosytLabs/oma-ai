import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { OmaEnv } from "../types.js";
import { ProviderError } from "../inference/provider-route.js";
import { logger } from "./logger.js";

export const handleUnhandledError: ErrorHandler<OmaEnv> = (err, c) => {
	if (err instanceof HTTPException) return err.getResponse();
	const correlationId = c.get("correlationId");
	logger.error({ correlationId, err }, "[OMA] Unhandled error");
	// Only ProviderError messages are authored for clients. Ordinary errors
	// can contain database queries, credentials, or runtime implementation details.
	const publicError = err instanceof ProviderError && err.status >= 400 && err.status <= 599;
	const status = publicError ? err.status as ContentfulStatusCode : 500;
	return c.json({ error: {
		message: publicError ? err.message : "Internal server error",
		type: status >= 500 ? "server_error" : "client_error",
		correlationId,
	} }, status);
};
