import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL as API_URL } from "@/lib/config";
import { proxyResponse } from "@/lib/api/proxy-response";
import { applyTrustedProxyHeaders } from "@/lib/api/proxy-headers";

/**
 * Shared core proxy function for catch-all API routes.
 *
 * Why: Forwards client-side calls from the Next.js frontend application layer
 * directly to the standalone Hono backend API. By piping headers, methods,
 * query params, and body streams through this gateway, we preserve the
 * backend's core routing context (including rate-limiting headers and
 * secure authorization credentials) while circumventing browser CORS
 * limitations and simplifying frontend configuration.
 *
 * The proxy normalizes 502 vs 504:
 *   - `Backend unreachable` (502) — fetch itself threw (network, DNS, connect).
 *   - Upstream 4xx/5xx is forwarded as-is so the caller sees the real
 *     status code (auth issues, rate limits, validation, etc.).
 *
 * @param req - The incoming NextRequest containing the client call details.
 * @returns A NextResponse holding the forwarded backend data stream or JSON
 *          response, or a synthesized 502 if the backend is unreachable.
 */
export async function proxy(req: NextRequest) {
	const path = req.nextUrl.pathname.replace(/^\/api/, "");
	const url = new URL(`${API_URL}${path}${req.nextUrl.search}`);

	const headers = new Headers(req.headers);
	headers.delete("host");
	applyTrustedProxyHeaders(headers);

	try {
		const res = await fetch(url, {
			method: req.method,
			headers,
			redirect: "manual",
			body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
			duplex: "half",
			signal: AbortSignal.timeout(120_000),
		} as RequestInit);

		return proxyResponse(res);
	} catch (err) {
		// Differentiate timeouts from connection errors so the caller can
		// retry / show a useful message. Without this, every transport
		// failure collapsed into the same "Backend unreachable" string.
		const isTimeout =
			err instanceof Error &&
			(err.name === "TimeoutError" || /timeout/i.test(err.message));
		return NextResponse.json(
			{
				error: {
					message: isTimeout
						? "Backend request timed out"
						: "Backend unreachable",
					code: isTimeout ? "upstream_timeout" : "upstream_unreachable",
				},
			},
			{ status: isTimeout ? 504 : 502 },
		);
	}
}
