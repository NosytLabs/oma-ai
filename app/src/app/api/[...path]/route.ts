/**
 * Catch-all API proxy — forwards requests on any /api/* path to the Hono
 * backend on DEFAULT_API_URL. This replaces the need for a per-endpoint
 * proxy route file.
 *
 * The auth client (`lib/api/auth.ts`) maps browser requests through `/api/*`
 * via the `p()` helper so that cookies (csrf_token, oma_session) live on
 * the same origin as the page. Without this catch-all, any /api/* path
 * without a dedicated route file would return 404.
 *
 * Existing dedicated routes (e.g. /api/auth/csrf-token, /api/auth/logout,
 * /api/user, /api/v1/models) take precedence because Next.js matches
 * specific routes before catch-alls.
 */
import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL } from "@/lib/config";
import { readSessionToken } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

const BACKEND = DEFAULT_API_URL;

/**
 * Paths that are safe to proxy without session auth.
 * Everything else requires `Authorization` or a valid session cookie.
 */
const PUBLIC_PATHS = new Set(["/v1/models", "/v1/health", "/health"]);

export const GET = withRateLimit(
	async (request: NextRequest) => {
		return proxy(request);
	},
	{ limiter: generalLimiter, route: "/api/*" },
);

export const POST = withRateLimit(
	async (request: NextRequest) => {
		return proxy(request);
	},
	{ limiter: generalLimiter, route: "/api/*" },
);

export const PUT = withRateLimit(
	async (request: NextRequest) => {
		return proxy(request);
	},
	{ limiter: generalLimiter, route: "/api/*" },
);

export const PATCH = withRateLimit(
	async (request: NextRequest) => {
		return proxy(request);
	},
	{ limiter: generalLimiter, route: "/api/*" },
);

export const DELETE = withRateLimit(
	async (request: NextRequest) => {
		return proxy(request);
	},
	{ limiter: generalLimiter, route: "/api/*" },
);

async function isAuthenticated(req: NextRequest): Promise<boolean> {
	const authHeader = req.headers.get("authorization");
	if (authHeader?.startsWith("Bearer ")) return true;
	// Fall back to the HttpOnly session cookie (browser requests through the
	// catch-all carry it; this resolver reads it server-side).
	const session = await readSessionToken();
	return Boolean(session);
}

async function proxy(request: NextRequest) {
	// Strip /api prefix to get the backend path
	const { pathname, search } = request.nextUrl;
	const backendPath = pathname.replace(/^\/api/, "") || "/";
	const url = `${BACKEND}${backendPath}${search}`;

	// Auth gate: only allow specific public paths through unauthenticated
	const isPublic = PUBLIC_PATHS.has(backendPath);
	if (!isPublic && !(await isAuthenticated(request))) {
		return NextResponse.json(
			{ error: { message: "Unauthorized", type: "auth_required" } },
			{ status: 401 },
		);
	}

	// Build upstream headers — forward cookies + auth headers.
	const headers: Record<string, string> = {
		accept: "application/json",
	};
	const cookie = request.headers.get("cookie");
	if (cookie) headers.cookie = cookie;
	// Prefer an Authorization header the caller already provided (e.g. a
	// service-to-service call using an API key). Fall back to the session
	// cookie below.
	const auth = request.headers.get("authorization");
	if (auth) headers.authorization = auth;
	const ctype = request.headers.get("content-type");
	if (ctype) headers["content-type"] = ctype;

	// B3 fix: forward the HttpOnly session cookie as `Authorization: Bearer
	// <jwt>`. The browser already sent the cookie with this request, but the
	// backend's `sessionAuth` middleware only honors the Authorization
	// header. Resolving the cookie here and re-attaching it as a Bearer token
	// is the canonical auth path for proxied calls.
	if (!headers.authorization) {
		const sessionToken = await readSessionToken();
		if (sessionToken) {
			headers.authorization = `Bearer ${sessionToken}`;
		}
	}

	// Read body for mutating methods
	let body: BodyInit | null = null;
	const method = request.method;
	if (method !== "GET" && method !== "HEAD") {
		try {
			body = await request.text();
		} catch {
			body = null;
		}
	}

	try {
		const upstream = await fetch(url, {
			method,
			headers,
			body: body || undefined,
			signal: AbortSignal.timeout(15_000),
			cache: "no-store",
			redirect: "manual",
		});

		const upstreamBody = await upstream.text();
		const res = new NextResponse(upstreamBody, {
			status: upstream.status,
			statusText: upstream.statusText,
			headers: {
				"content-type":
					upstream.headers.get("content-type") ?? "application/json",
				"cache-control": "no-store",
			},
		});

		// Forward Set-Cookie headers so the browser stores session/CSRF cookies
		// on the page origin.
		const setCookie = upstream.headers.get("set-cookie");
		if (setCookie) res.headers.set("set-cookie", setCookie);

		return res;
	} catch {
		return NextResponse.json(
			{
				error: { message: "Backend unreachable", type: "backend_unavailable" },
			},
			{ status: 502 },
		);
	}
}
