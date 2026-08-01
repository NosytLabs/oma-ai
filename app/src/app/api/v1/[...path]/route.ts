import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL as API_URL } from "@/lib/config";

export const runtime = "nodejs";

/**
 * Catch-all proxy for /api/v1/* — forwards any request not handled by a
 * specific route (models, privacy) straight to the Hono backend.
 *
 * The frontend API client (`@/lib/api`) rewrites every `/v1/*` call to the
 * same-origin `/api/v1/*` path, so every backend endpoint that lacks a
 * dedicated Next route used to 404 before ever reaching Hono (balance,
 * usage, export, videos, ...). This route forwards method, body, cookies
 * and preserves the rate-limit / daily-limit headers the UI reads.
 */

const PASSTHROUGH_HEADERS = [
	"content-type",
	"cache-control",
	"content-disposition",
	"x-ratelimit-limit",
	"x-ratelimit-remaining",
	"x-ratelimit-reset",
	"retry-after",
	"x-dailylimit-limit",
	"x-dailylimit-remaining",
	"x-dailylimit-reset",
	"x-request-id",
];

async function proxy(req: NextRequest) {
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

		const out = new NextResponse(res.body, { status: res.status });
		for (const header of PASSTHROUGH_HEADERS) {
			const value = res.headers.get(header);
			if (value) out.headers.set(header, value);
		}
		return out;
	} catch {
		return NextResponse.json(
			{ error: { message: "Backend unreachable" } },
			{ status: 502 },
		);
	}
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
