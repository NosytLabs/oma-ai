/**
 * Better Auth proxy — forwards /api/auth/* from Next.js (the public
 * surface where magic-link emails point) to the Hono backend.
 *
 * Critical details:
 *
 *   - Forwards all headers both ways, including Set-Cookie. The session
 *     cookie's domain is set by the backend; we pass it through
 *     unchanged so the browser stores it on the Next.js origin
 *     (localhost:3000) and sends it back on every subsequent request.
 *
 *   - Preserves the request body via `duplex: "half"` so streaming
 *     requests (Better Auth uses these for some endpoints) work.
 *
 *   - Uses `force-dynamic` so Next.js never caches the proxy result.
 *
 * If the backend is offline the request returns 502 with a clear
 * error message — never silently fails.
 */
import { type NextRequest } from "next/server";

const BACKEND_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxyAuth(request: NextRequest): Promise<Response> {
	const url = new URL(request.url);
	const target = `${BACKEND_URL}/api/auth${url.pathname.replace(/^\/api\/auth/, "")}${url.search}`;
	const init: RequestInit = {
		method: request.method,
		headers: stripHopByHop(request.headers),
		redirect: "manual",
		// Streaming bodies (POST/PUT) need duplex half on Node fetch.
		// @ts-expect-error — `duplex` is part of the undici RequestInit
		// surface; the DOM type doesn't include it yet.
		duplex: "half",
	};
	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = await request.blob();
	}
	let upstream: Response;
	try {
		upstream = await fetch(target, init);
	} catch (err) {
		return new Response(
			JSON.stringify({
				error: {
					message: `Auth backend unreachable at ${BACKEND_URL}. Is the API server running?`,
					type: "upstream_unreachable",
				},
			}),
			{
				status: 502,
				headers: { "content-type": "application/json" },
			},
		);
	}

	// Mirror status + relevant headers + body back to the client.
	const outHeaders = new Headers();
	for (const [k, v] of upstream.headers.entries()) {
		if (HOP_BY_HOP.has(k.toLowerCase())) continue;
		outHeaders.append(k, v);
	}
	// Ensure the browser accepts Set-Cookie from the proxy response.
	outHeaders.set("access-control-allow-credentials", "true");
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: outHeaders,
	});
}

const HOP_BY_HOP = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade",
	"host",
	"content-length",
]);

function stripHopByHop(headers: Headers): Headers {
	const out = new Headers();
	for (const [k, v] of headers.entries()) {
		if (HOP_BY_HOP.has(k.toLowerCase())) continue;
		out.append(k, v);
	}
	return out;
}

export const GET = proxyAuth;
export const POST = proxyAuth;
export const PUT = proxyAuth;
export const PATCH = proxyAuth;
export const DELETE = proxyAuth;
export const OPTIONS = proxyAuth;