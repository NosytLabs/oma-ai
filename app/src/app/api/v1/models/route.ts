import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL as API_URL } from "@/lib/config";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
	* /api/v1/models — proxies GET to backend /v1/models.
	*
	* Returns the full model catalog (chat + image + video + tts + embedding
	* + asr + music + upscale + inpaint) as an OpenAI-compatible
	* `{"object": "list", "data": [...]}` payload. Linked from the docs
	* `/docs#available-models` section. Cache-Control from the backend is
	* preserved so we don't re-proxy on every page load.
	*/
export const dynamic = "force-dynamic";

export const GET = withRateLimit(
	async (_req: NextRequest) => {
		try {
			const res = await fetch(`${API_URL}/v1/models`, {
				method: "GET",
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(60_000),
			});
			const body = await res.text();
			const out = new NextResponse(body, {
				status: res.status,
				headers: {
					"content-type": res.headers.get("content-type") || "application/json",
				},
			});
			const cacheControl = res.headers.get("cache-control");
			if (cacheControl) out.headers.set("cache-control", cacheControl);
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
