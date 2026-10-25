import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

import { PRIVACY_MANIFEST } from "@/lib/privacy-manifest";

export const GET = withRateLimit(
	async () => {
		return NextResponse.json(PRIVACY_MANIFEST, {
			headers: {
				"Cache-Control": "public, max-age=3600, must-revalidate",
			},
		});
	},
	{ limiter: generalLimiter, route: "/api/v1/privacy" },
);
