import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL } from "@/lib/config";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { authLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * /api/auth/account/login — proxies to backend /auth/account/login.
 * Forwards x-csrf-token header and any incoming cookies; copies back
 * the Set-Cookie so oma_session is stored on our origin.
 */
export const POST = withRateLimit(
	async (req: NextRequest) => {
		const backend = DEFAULT_API_URL;
		const cookieHeader = req.headers.get("cookie") || "";
		const csrf = req.headers.get("x-csrf-token") || "";
		try {
			const res = await fetch(`${backend}/auth/account/login`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-csrf-token": csrf,
					cookie: cookieHeader,
				},
				body: req.body,
				// @ts-expect-error duplex is needed for streamed body in Node fetch
				duplex: "half",
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
	{ limiter: authLimiter, route: "/api/auth/account/login" },
);
