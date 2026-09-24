/**
	* Demo mode guard.
	*
	* The Next.js middleware (app/src/middleware.ts) sets the HttpOnly
	* `oma-demo` cookie when an unauthenticated visitor lands on a
	* protected page with `?demo=1`. The page renders with sample data,
	* but the visitor is NOT signed in — they have no session, no API
	* key, and no credits. Without this guard, a curl/JS demo client
	* could bypass the (intentionally non-existent) client UI and POST
	* directly to mutation endpoints, minting API keys, recording fake
	* deposits, or wiping history on an unauthenticated identity.
	*
	* This middleware short-circuits any mutation (POST / PUT / PATCH /
	* DELETE) under `/v1/*` when the demo cookie is present. GETs
	* (and HEAD / OPTIONS) are allowed through so the demo UI can
	* still render data — but those endpoints will fail their own
	* auth check (401) because the demo cookie is not a Better Auth
	* session, which is the correct UX ("this action requires sign-in").
	*
	* The `oma-demo-public` cookie is the client-readable mirror set by
	* the same Next.js middleware for client-side hooks (useAuth's
	* `isDemo` flag). The server MUST NOT trust it — anything a client
	* can set, a client can forge. Only the HttpOnly `oma-demo` cookie
	* is consulted here.
	*
	* Mounted as `app.use('/v1/*', demoModeGuard)` so it covers every
	* mutation route without per-route edits, and so non-/v1 paths
	* (notably the Polar webhook at `/webhooks/polar`, which is a
	* mutation signed with the webhook secret — not a user request)
	* are unaffected.
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
			return decodeURIComponent(trimmed.slice(needle.length));
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
