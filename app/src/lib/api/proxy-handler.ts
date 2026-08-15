import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL as API_URL } from "@/lib/config";
import { proxyResponse } from "@/lib/api/proxy-response";

/**
	* Shared core proxy function for catch-all API routes.
	*
	* Why: Forwards client-side calls from the Next.js frontend application layer directly to
	* the standalone Hono backend API. By piping headers, methods, query params, and body streams
	* through this gateway, we preserve the backend's core routing context (including rate-limiting headers
	* and secure authorization credentials) while circumventing browser CORS limitations and simplifying
	* frontend configuration.
	* 
	* @param req - The incoming NextRequest containing the client call details.
	* @returns A NextResponse holding the forwarded backend data stream or JSON response.
	*/
export async function proxy(req: NextRequest) {
	const path = req.nextUrl.pathname.replace(/^\/api/, "");
	const url = new URL(`${API_URL}${path}${req.nextUrl.search}`);

	const headers = new Headers(req.headers);
	headers.delete("host");

	try {
		const res = await fetch(url, {
			method: req.method,
			headers,
			body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
			duplex: "half",
			signal: AbortSignal.timeout(120_000),
		} as RequestInit);

		return proxyResponse(res);
	} catch {
		return NextResponse.json(
			{ error: { message: "Backend unreachable" } },
			{ status: 502 },
		);
	}
}
