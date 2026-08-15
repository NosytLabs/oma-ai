import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL } from "@/lib/config";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
	* /api/auth/csrf-token — proxies to backend /auth/csrf-token.
	* The CSRF cookie is set by the backend in the Set-Cookie response;
	* we forward it to the browser under our own origin so subsequent
	* same-origin requests (like the account login POST) include it.
	*
	* Uses generalLimiter (not authLimiter): every settings/login page
	* pre-fetches CSRF, and 5/15min was starving real SPA navigation with 429s.
	*/
export const GET = withRateLimit(
	async (_req: NextRequest) => {
		const backend = DEFAULT_API_URL;
		try {
			const res = await fetch(`${backend}/auth/csrf-token`, {
				method: "GET",
				credentials: "include",
				signal: AbortSignal.timeout(60_000),
			});
			const body = await res.text();
			const out = new NextResponse(body, {
				status: res.status,
				headers: {
					"content-type": res.headers.get("content-type") || "application/json",
					"cache-control": "no-store",
				},
			});
			// Forward Set-Cookie so the browser stores csrf_token on our origin.
			const setCookie = res.headers.get("set-cookie");
			if (setCookie) out.headers.set("set-cookie", setCookie);
			return out;
		} catch (_e) {
			return NextResponse.json(
				{ error: { message: "Backend unreachable" } },
				{ status: 502 },
			);
		}
	},
	{ limiter: generalLimiter, route: "/api/auth/csrf-token" },
);
