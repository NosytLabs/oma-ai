import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL as API_URL } from "@/lib/config";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/** Public chat-model catalog. Preserve the backend's cache policy. */
export const dynamic = "force-dynamic";

export const GET = withRateLimit(
	async (_req: NextRequest) => {
		try {
			const res = await fetch(`${API_URL}/v1/models`, {
				method: "GET",
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(60_000),
				// The catalog changes rarely; cache the upstream response so
				// repeat requests do not each pay the backend's full latency.
				next: { revalidate: 60 },
			});
			const body = await res.text();
			const out = new NextResponse(body, {
				status: res.status,
				headers: {
					"content-type": res.headers.get("content-type") || "application/json",
				},
			});
			const cacheControl = res.headers.get("cache-control");
			if (cacheControl) {
				out.headers.set("cache-control", cacheControl);
			} else if (res.ok) {
				out.headers.set(
					"cache-control",
					"public, max-age=60, s-maxage=60, stale-while-revalidate=300",
				);
			}
			return out;
		} catch {
			return NextResponse.json(
				{ error: { message: "Backend unreachable" } },
				{ status: 502 },
			);
		}
	},
	{ limiter: generalLimiter, route: "/api/v1/models" },
);
