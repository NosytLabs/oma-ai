import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL } from "@/lib/config";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * /api/user — fetches the current session user (account number + linked wallets).
 *
 * Forwarded to the backend `/auth/user` endpoint. The session can come from
 * either the `Authorization: Bearer <jwt>` header OR the `oma_session` /
 * `oma_session_meta` cookies. We pass through everything the browser sent.
 */
export const GET = withRateLimit(
	async (req: NextRequest) => {
		const backend = DEFAULT_API_URL;
		const cookieHeader = req.headers.get("cookie") || "";
		const authHeader = req.headers.get("authorization") || "";

		const headers: Record<string, string> = {
			cookie: cookieHeader,
			accept: "application/json",
		};
		if (authHeader) headers.authorization = authHeader;

		try {
			const upstream = await fetch(`${backend}/user`, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(5_000),
				cache: "no-store",
			});

			const body = await upstream.text();
			const res = new NextResponse(body, {
				status: upstream.status,
				headers: {
					"content-type":
						upstream.headers.get("content-type") ?? "application/json",
					"cache-control": "no-store",
				},
			});

			// Forward any Set-Cookie from upstream (e.g. session rotation)
			const setCookie = upstream.headers.get("set-cookie");
			if (setCookie) res.headers.append("set-cookie", setCookie);

			return res;
		} catch (_err) {
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
	},
	{ limiter: generalLimiter, route: "/api/user" },
);
