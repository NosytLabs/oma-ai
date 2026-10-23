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
export async function proxy(req: NextRequest, options: { websiteChat?: boolean } = {}) {
	// Polar's alternate callback already includes /api in the backend route.
	// Stripping it here sends valid deliveries to the nonexistent /webhook/polar.
	const incomingPath = req.nextUrl.pathname === "/api/webhook/polar"
		? "/api/webhook/polar"
		: req.nextUrl.pathname.replace(/^\/api/, "");
	if (options.websiteChat) {
		// The same-origin chat UI has its own cost policy. Never grant it to
		// arbitrary SDK paths or cross-origin browser requests.
		const origin = req.headers.get("Origin");
		const fetchSite = req.headers.get("Sec-Fetch-Site");
		if (incomingPath !== "/chat/completions" || origin !== req.nextUrl.origin ||
			(fetchSite && fetchSite !== "same-origin")) {
			return NextResponse.json({ error: { message: "Use chat on the OMA website", code: "website_chat_only" } }, { status: 403 });
		}
	}
	const path = options.websiteChat ? "/website/chat/completions" : incomingPath;
	// Operators use the authenticated backend directly. No operator or job
	// surface is exposed through the customer-facing website proxy.
	let normalizedPath: string;
	try { normalizedPath = decodeURIComponent(path); }
	catch { return NextResponse.json({ error: { message: "Invalid path", type: "invalid_request_error" } }, { status: 400 }); }
	if (/^\/(?:admin|v1\/admin|internal|website)(?:\/|$)/i.test(normalizedPath) && !options.websiteChat) {
		return NextResponse.json({ error: { message: "Not found", type: "not_found" } }, { status: 404 });
	}
	const url = new URL(`${API_URL}${path}${req.nextUrl.search}`);

	const headers = new Headers(req.headers);
	headers.delete("host");
	headers.delete("X-OMA-Source");
	if (options.websiteChat) headers.set("X-OMA-Source", "website");
	applyTrustedProxyHeaders(headers);

	try {
		const res = await fetch(url, {
			method: req.method,
			headers,
			redirect: "manual",
			body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
			duplex: "half",
			// Backend inference has a 240-second overall budget. Leave room to
			// forward its error, and stop upstream work when the browser cancels.
			signal: AbortSignal.any([req.signal, AbortSignal.timeout(270_000)]),
		} as RequestInit);

		return proxyResponse(res);
	} catch (err) {
		if (req.signal.aborted) {
			return NextResponse.json({ error: { message: "Request canceled", code: "request_canceled" } }, { status: 499 });
		}
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
