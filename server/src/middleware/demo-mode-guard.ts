/**
 * Read-only demo UX guard for mutations under /v1/* and /website/*.
 * app/src/proxy.ts sets oma-demo when entering the demo view. HttpOnly
 * restricts script access, but does not authenticate a client-supplied cookie.
 * Downstream session/API-key checks still own authorization. Ignore malformed
 * demo values so this auxiliary flag cannot crash unrelated account requests.
 */
import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { logger } from "../lib/logger.js";
import { extractClientIpOrNull } from "./rate-limit/utils.js";

const DEMO_COOKIE_NAME = "oma-demo";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(header: string | undefined, name: string): string | null {
	if (!header) return null;
	const needle = `${name}=`;
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		if (trimmed.startsWith(needle)) {
			try { return decodeURIComponent(trimmed.slice(needle.length)); }
			catch { return null; }
		}
	}
	return null;
}

export async function demoModeGuard(c: Context<OmaEnv>, next: Next) {
	const method = c.req.method.toUpperCase();
	if (!MUTATION_METHODS.has(method)) {
		return next();
	}

	const cookieHeader = c.req.header("Cookie") ?? c.req.header("cookie");
	const demoFlag = readCookie(cookieHeader, DEMO_COOKIE_NAME);
	if (demoFlag !== "1") {
		return next();
	}

	const correlationId = c.get("correlationId");
	logger.warn(
		{
			event: "demo_mutation_blocked",
			method,
			path: c.req.path,
			correlationId,
			remoteAddress:
				extractClientIpOrNull(c),
			userAgent: c.req.header("user-agent") ?? null,
		},
		"[demo-guard] mutation blocked for demo session",
	);

	return c.json(
		{
			error: {
				message: "Demo mode is read-only",
				type: "forbidden",
				code: "demo_mode_read_only",
			},
		},
		403,
	);
}
