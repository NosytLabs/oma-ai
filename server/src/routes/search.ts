import { Hono } from "hono";
import { z } from "zod";
import { config } from "../config.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { logger } from "../lib/logger.js";

/**
 * /v1/search — web search used by the chat playground when "Web Search" is
 * enabled. Tries TinyFish's search endpoint if TINYFISH_API_KEY is set;
 * otherwise returns an empty result set so the UI can show a friendly
 * "search not configured" toast instead of hard-404ing the chat flow.
 *
 * The frontend already handles 404 with a `toast.info("Web search is not yet
 * available on this deployment")`. This implementation upgrades that path
 * to a graceful empty result with proper auth, so paying users don't see a
 * perpetual "not available" toast when the deployment is fully configured.
 */

const querySchema = z.object({
	query: z.string().trim().min(1).max(500),
});

export const searchRoutes = new Hono();

searchRoutes.get("/v1/search", sessionOrBearerAuth, async (c) => {
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
