/**
 * Shared proxy/auth primitive for Next.js API routes.
 *
 * Both the catch-all `/api/[...path]` route and the dedicated
 * `/api/user`, `/api/auth/logout`, and other dedicated routes duplicate
 * the same forwarding + auth-cookie-to-Bearer + Set-Cookie plumbing.
 * This helper is the single source of truth for that pattern; routes
 * become thin wrappers that call `proxyRequest(req, { backendPath, ... })`.
 */
import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL } from "../config";
import { readSessionToken } from "../cookies";

export const PROXY_RUNTIME = "nodejs";

const DEFAULT_TIMEOUT_MS = 15_000;

/** Routes that don't require auth, mapped from the path *after* `/api`. */
export const PUBLIC_BACKEND_PATHS = new Set([
	// Pre-auth + public health
	"/health",
	"/ready",
	"/live",
	"/ping",
	"/version",
	"/v1/health",
	"/v1/ping",
	"/v1/models",
	// SIWE / account-number login — these MUST be reachable without a
	// session, otherwise the catch-all proxy short-circuits them to 401
	// and users can't start the auth flow at all. CSRF protection still
	// applies via the dedicated /api/auth/* routes.
	"/auth/nonce",
	"/auth/verify",
	"/auth/wallet",
]);

export interface ProxyRequestOptions {
	/**
	 * Path to forward to on the backend. Defaults to the request URL
	 * with `/api` stripped. Provide only when you need a different
	 * upstream path than the one in the URL.
	 */
	backendPath?: string;
	/** Override the upstream base URL. Defaults to DEFAULT_API_URL. */
	backendBase?: string;
	/** Timeout in ms. Default 15_000; `/api/auth/logout` uses 2_000. */
	timeoutMs?: number;
	/**
	 * If false, skip the auth-cookie-to-Bearer translation. Used by
	 * endpoints that intentionally pass through a bearer supplied by the
	 * caller (e.g. service-to-service).
	 */
	autoBearer?: boolean;
}

export interface ProxyRequestResult {
	upstream: Response;
	body: string;
}

export async function isAuthorizedRequest(
	req: NextRequest,
	backendPath: string,
): Promise<boolean> {
	if (PUBLIC_BACKEND_PATHS.has(backendPath)) return true;
	const authHeader = req.headers.get("authorization");
	if (authHeader?.startsWith("Bearer ")) return true;
	// HttpOnly session cookie path — read server-side only.
	const session = await readSessionToken();
	return Boolean(session);
}

export function buildUpstreamHeaders(req: NextRequest): Record<string, string> {
	const headers: Record<string, string> = { accept: "application/json" };
	const cookie = req.headers.get("cookie");
	if (cookie) headers.cookie = cookie;
	const auth = req.headers.get("authorization");
	if (auth) headers.authorization = auth;
	const ctype = req.headers.get("content-type");
	if (ctype) headers["content-type"] = ctype;
	const csrf = req.headers.get("x-csrf-token");
	if (csrf) headers["x-csrf-token"] = csrf;
	return headers;
}

export async function ensureBearer(
	headers: Record<string, string>,
): Promise<void> {
	if (headers.authorization) return;
	const sessionToken = await readSessionToken();
	if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
}

/**
 * Forward `request` to the Hono backend and return the proxied response.
 *
 * Behavior contract:
 * - 401 short-circuit when the request is unauthenticated and the
 *   backend path is not in PUBLIC_BACKEND_PATHS.
 * - Upstream Set-Cookie is forwarded to the browser.
 * - Upstream status/body are mirrored verbatim.
 * - On upstream network failure, returns a 502 with the standard error
 *   envelope so callers can render a coherent failure state.
 */
export async function proxyRequest(
	request: NextRequest,
	options: ProxyRequestOptions = {},
): Promise<NextResponse> {
	const {
		backendPath: explicitPath,
		backendBase,
		timeoutMs = DEFAULT_TIMEOUT_MS,
		autoBearer = true,
	} = options;

	const backendPath =
		explicitPath ?? (request.nextUrl.pathname.replace(/^\/api/, "") || "/");

	if (!(await isAuthorizedRequest(request, backendPath))) {
		return NextResponse.json(
			{ error: { message: "Unauthorized", type: "auth_required" } },
			{ status: 401 },
		);
	}

	const headers = buildUpstreamHeaders(request);
	if (autoBearer) await ensureBearer(headers);

	const url = `${backendBase ?? DEFAULT_API_URL}${backendPath}${request.nextUrl.search}`;

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
			signal: AbortSignal.timeout(timeoutMs),
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

		const setCookie = upstream.headers.get("set-cookie");
		if (setCookie) res.headers.set("set-cookie", setCookie);

		return res;
	} catch {
		return NextResponse.json(
			{
				error: {
					message: "Backend unreachable",
					type: "backend_unavailable",
				},
			},
			{ status: 502 },
		);
	}
}