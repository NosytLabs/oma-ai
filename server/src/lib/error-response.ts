import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Standardized JSON error response shape used across all OMA server routes.
 *
 * Matches the OpenAI REST API error convention so SDK clients (and our own
 * `@/lib/api` browser wrapper) can rely on a single parser:
 *
 *   { error: { message: string, type: ErrorType, code?: string } }
 *
 * Use `errorResponse(c, message, status, type?, code?)` for all error responses
 * so the wire format stays consistent. Existing call sites using bare
 * `{ error: "string" }` should migrate to this helper.
 *
 * `type` defaults to the OpenAI-compatible "api_error" for 5xx and
 * "invalid_request_error" for 4xx — both well-known values SDK clients handle.
 */
export type ErrorType =
	| "invalid_request_error"
	| "authentication_error"
	| "permission_error"
	| "not_found_error"
	| "rate_limit_error"
	| "api_error"
	| "service_unavailable"
	| "not_configured";

const STATUS_TO_DEFAULT_TYPE: Record<number, ErrorType> = {
	400: "invalid_request_error",
	401: "authentication_error",
	403: "permission_error",
	404: "not_found_error",
	409: "invalid_request_error",
	413: "invalid_request_error",
	415: "invalid_request_error",
	429: "rate_limit_error",
	500: "api_error",
	502: "api_error",
	503: "service_unavailable",
	504: "api_error",
};

export function errorResponse(
	c: Context,
	message: string,
	status: ContentfulStatusCode,
	opts?: { type?: ErrorType; code?: string },
) {
	const type = opts?.type ?? STATUS_TO_DEFAULT_TYPE[status] ?? "api_error";
	const body: { error: { message: string; type: ErrorType; code?: string } } = {
		error: { message, type },
	};
	if (opts?.code) body.error.code = opts.code;
	return c.json(body, status);
}
