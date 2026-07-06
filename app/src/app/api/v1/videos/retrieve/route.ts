import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL as API_URL } from "@/lib/config";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASSTHROUGH_REQUEST_HEADERS = [
	"authorization",
	"accept",
	"user-agent",
] as const;

const PASSTHROUGH_RESPONSE_HEADERS = ["content-type"] as const;

export const GET = withRateLimit(
	async (request: NextRequest) => {
		// --- Auth gate (runs on the server, cookies are HttpOnly) ---
		const authHeader = request.headers.get("authorization");
		const cookieStore = await cookies();
		const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
		if (!authHeader && !sessionCookie) {
			return NextResponse.json(
				{ error: { message: "Unauthorized", type: "auth_required" } },
				{ status: 401 },
			);
		}

		const { searchParams } = new URL(request.url);
		const queueId = searchParams.get("queue_id");
		if (!queueId) {
			return NextResponse.json(
				{
					error: {
						message: "Missing queue_id query parameter",
						type: "invalid_request_error",
					},
				},
				{ status: 400 },
			);
		}

		const requestHeaders = new Headers();
		for (const name of PASSTHROUGH_REQUEST_HEADERS) {
			const value = request.headers.get(name);
			if (value) requestHeaders.set(name, value);
		}

		// B4 fix: forward the JWT as Authorization. The session cookie is
		// HttpOnly, so the browser does not include the token in any
		// client-side Authorization header. Resolve the cookie server-side
		// and attach it as a Bearer token on the upstream request.
		if (!requestHeaders.has("authorization") && sessionCookie) {
			requestHeaders.set("authorization", `Bearer ${sessionCookie}`);
		}

		let upstream: Response;
		try {
			upstream = await fetch(
				`${API_URL}/v1/videos/retrieve?queue_id=${encodeURIComponent(queueId)}`,
				{
					method: "GET",
					headers: requestHeaders,
					cache: "no-store",
					signal: AbortSignal.timeout(60_000),
				},
			);
		} catch (err) {
			log.error("[video-proxy] /v1/videos/retrieve error:", err);
			return NextResponse.json(
				{
					error: {
						message: "Failed to reach upstream API",
						type: "proxy_error",
					},
				},
				{ status: 502 },
			);
		}

		const responseHeaders = new Headers();
		for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
			const value = upstream.headers.get(name);
			if (value) responseHeaders.set(name, value);
		}

		let payload: unknown;
		try {
			payload = await upstream.json();
		} catch {
			payload = {
				error: {
					message: "Upstream returned invalid JSON",
					type: "proxy_error",
				},
			};
		}
		return NextResponse.json(payload, {
			status: upstream.status,
			headers: responseHeaders,
		});
	},
	{ limiter: generalLimiter, route: "/api/v1/videos/retrieve" },
);
