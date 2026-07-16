import { type NextRequest } from "next/server";
import { proxyRequest } from "@/lib/api/proxy";
import { readSessionToken } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

/**
 * /api/keys/:id — single-key mutations.
 *
 * DELETE — revoke (soft-delete) a key.
 * PATCH  — update rate limits / expiry.
 *
 * Forwards to Hono `/keys/:id` (not `/v1/keys/:id`). Id is taken from the
 * URL path so this works with `withRateLimit` (which only forwards `req`).
 */
export const runtime = "nodejs";

function keyIdFromRequest(request: NextRequest): string | null {
	// pathname: /api/keys/<id>
	const parts = request.nextUrl.pathname.split("/").filter(Boolean);
	const id = parts[parts.length - 1];
	if (!id || id === "keys" || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
	return id;
}

async function authedProxy(request: NextRequest) {
	const session = await readSessionToken();
	if (!session) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	const id = keyIdFromRequest(request);
	if (!id) {
		return Response.json({ error: "invalid_key_id" }, { status: 400 });
	}
	return proxyRequest(request, {
		backendPath: `/keys/${id}`,
		timeoutMs: 10_000,
	});
}

export const DELETE = withRateLimit(authedProxy, {
	limiter: generalLimiter,
	route: "/api/keys/:id",
});

export const PATCH = withRateLimit(authedProxy, {
	limiter: generalLimiter,
	route: "/api/keys/:id",
});
