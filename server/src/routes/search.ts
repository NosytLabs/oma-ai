import { Hono } from "hono";
import { z } from "zod";
import { config } from "../config.js";
import { optionalAuth } from "../auth/middleware.js";
import { tokenBucket } from "../middleware/rate-limit.js";
import { logger } from "../lib/logger.js";

/**
 * /v1/search (GET ?query=…) — web search used by the chat playground when
 * "Web Search" is enabled. Tries TinyFish's search endpoint if
 * TINYFISH_API_KEY is set; otherwise returns an empty result set so the UI
 * can attach nothing and proceed without search context.
 *
 * Auth is OPTIONAL: the anonymous free website-chat tier (gonka models,
 * X-OMA-Source: website) must be able to search without an account, exactly
 * like chat completions. Signed-in users get the same empty-or-results
 * response; attribution is not needed for billing here.
 */

const querySchema = z.object({
	query: z.string().trim().min(1).max(500),
});

export const searchRoutes = new Hono();

// Modest burst/rpm so anonymous callers can't burn Tinyfish quota in a tight
// loop (the route is optionalAuth — no account required, like free chat).
searchRoutes.use(
  "/v1/search",
  tokenBucket({ refillRate: 2, bucketSize: 10, rpmLimit: 30 }),
);

searchRoutes.get("/v1/search", optionalAuth, async (c) => {
	const parsed = querySchema.safeParse(c.req.query());
	if (!parsed.success) {
		return c.json(
			{ error: { message: "Missing or invalid `query`", type: "invalid_request" } },
			400,
		);
	}
	const { query } = parsed.data;

	if (!config.TINYFISH_API_KEY) {
		// No upstream configured — return empty results. The chat client treats
		// 0 results as "nothing to attach" and proceeds without search context.
		return c.json({ query, results: [] });
	}

	try {
		const resp = await fetch("https://api.tinyfish.io/v1/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Api-Key": config.TINYFISH_API_KEY,
			},
			body: JSON.stringify({ query, max_results: 6 }),
		});
		if (!resp.ok) {
			logger.warn({ status: resp.status }, "[search] upstream non-OK");
			return c.json({ query, results: [] });
		}
		const data = (await resp.json()) as {
			results?: Array<{ title: string; url: string; snippet: string; site_name?: string; favicon?: string }>;
		};
		const results = (data.results ?? []).slice(0, 6).map((r) => ({
			title: r.title,
			url: r.url,
			snippet: r.snippet,
			...(r.site_name ? { site_name: r.site_name } : {}),
			...(r.favicon ? { favicon: r.favicon } : {}),
		}));
		return c.json({ query, results });
	} catch (err) {
		logger.warn({ err }, "[search] upstream fetch failed");
		return c.json({ query, results: [] });
	}
});
