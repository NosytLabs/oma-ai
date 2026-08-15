import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Frontend liveness check.
 *
 * This route indicates that the Next.js app itself is alive and serving
 * traffic — NOT whether the downstream inference backend (port 3001) is
 * reachable. Backend reachability is surfaced at the actual API call sites
 * (chat completions, models, etc.) where the user has a real reason to care.
 *
 * Returning a non-200 from this endpoint paints the navbar "Reconnecting…"
 * warning indicator on every public page, which is a poor UX for marketing
 * surfaces (/, /pricing, /docs) that don't need the backend.
 *
 * Always 200. No auth. No upstream call. Cheap & cacheable.
 *
 * Note: deliberately not wrapped in `withRateLimit` — this endpoint is hit
 * every 30s by every connected browser and the limiter cost would dwarf
 * the response. If the frontend health check ever needs throttling, gate
 * it by IP at the edge (CDN / load balancer), not in this Node handler.
 */
export function GET() {
	return NextResponse.json(
		{
			status: "ok",
			service: "oma-ai-web",
			timestamp: new Date().toISOString(),
		},
		{
			headers: {
				"Cache-Control": "no-store, must-revalidate",
			},
		},
	);
}
