import { Hono } from "hono";
import { z } from "zod";
import { config } from "../config.js";
import { optionalAuth } from "../auth/middleware.js";
import { tokenBucket } from "../middleware/rate-limit.js";
import { logger } from "../lib/logger.js";

/**
 * /v1/search (GET ?query=…) — web search used by the chat playground when
 * "Web Search" is enabled.
 *
 * Provider order:
 *   1. TinyFish (when TINYFISH_API_KEY is set and the host is reachable)
 *   2. DuckDuckGo HTML (free, no key) — primary reliable fallback
 *   3. DuckDuckGo Instant Answer API — abstract + related topics
 *
 * Auth is OPTIONAL: the anonymous free website-chat tier (gonka models,
 * X-OMA-Source: website) must be able to search without an account, exactly
 * like chat completions.
 */

export type SearchResult = {
	title: string;
	url: string;
	snippet: string;
	site_name?: string;
	favicon?: string;
};

const querySchema = z.object({
	query: z.string().trim().min(1).max(500),
});

export const searchRoutes = new Hono();

// Modest burst/rpm so anonymous callers can't burn upstream quota in a tight
// loop (the route is optionalAuth — no account required, like free chat).
searchRoutes.use(
	"/v1/search",
	tokenBucket({ refillRate: 2, bucketSize: 10, rpmLimit: 30 }),
);

const MAX_RESULTS = 6;
const FETCH_TIMEOUT_MS = 8_000;

function hostnameOf(url: string): string | undefined {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return undefined;
	}
}

function decodeHtmlEntities(input: string): string {
	return input
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/gi, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) =>
			String.fromCharCode(parseInt(h, 16)),
		);
}

function stripTags(html: string): string {
	return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit = {},
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

/** TinyFish — optional paid/partner search. Host may be unreachable. */
export async function searchTinyFish(
	query: string,
	apiKey: string,
): Promise<SearchResult[]> {
	const resp = await fetchWithTimeout("https://api.tinyfish.io/v1/search", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Api-Key": apiKey,
		},
		body: JSON.stringify({ query, max_results: MAX_RESULTS }),
	});
	if (!resp.ok) {
		logger.warn({ status: resp.status }, "[search] tinyfish non-OK");
		return [];
	}
	const data = (await resp.json()) as {
		results?: Array<{
			title: string;
			url: string;
			snippet: string;
			site_name?: string;
			favicon?: string;
		}>;
	};
	return (data.results ?? []).slice(0, MAX_RESULTS).map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.snippet,
		...(r.site_name ? { site_name: r.site_name } : {}),
		...(r.favicon ? { favicon: r.favicon } : {}),
	}));
}

/**
 * DuckDuckGo HTML results page. No API key. Parses classic result__a /
 * result__snippet blocks used by html.duckduckgo.com.
 */
export async function searchDuckDuckGoHtml(
	query: string,
): Promise<SearchResult[]> {
	const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
	const resp = await fetchWithTimeout(url, {
		method: "GET",
		headers: {
			Accept: "text/html",
			// DDG serves a thinner HTML page to non-browser clients without a UA.
			"User-Agent": "OmaSearch/1.0 (+https://oma-ai.com; playground web search)",
		},
	});
	if (!resp.ok) {
		logger.warn({ status: resp.status }, "[search] ddg-html non-OK");
		return [];
	}
	const html = await resp.text();
	const results: SearchResult[] = [];
	// Match each result block: result__a (title+url) then optional result__snippet
	const blockRe =
		/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class="[^"]*result__a|<\/div>\s*<\/div>\s*<\/div>|$)/gi;
	let match: RegExpExecArray | null;
	while ((match = blockRe.exec(html)) !== null && results.length < MAX_RESULTS) {
		const rawHref = decodeHtmlEntities(match[1]);
		const title = stripTags(match[2]);
		const tail = match[3] ?? "";
		const snipMatch = tail.match(
			/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
		);
		const snippet = snipMatch
			? stripTags(snipMatch[1] || snipMatch[2] || "")
			: "";
		// DDG wraps outbound links as //duckduckgo.com/l/?uddg=<encoded>
		let finalUrl = rawHref;
		const uddg = rawHref.match(/[?&]uddg=([^&]+)/);
		if (uddg) {
			try {
				finalUrl = decodeURIComponent(uddg[1]);
			} catch {
				finalUrl = rawHref;
			}
		} else if (rawHref.startsWith("//")) {
			finalUrl = `https:${rawHref}`;
		}
		if (!title || !finalUrl.startsWith("http")) continue;
		const site = hostnameOf(finalUrl);
		results.push({
			title,
			url: finalUrl,
			snippet: snippet || title,
			...(site ? { site_name: site } : {}),
		});
	}
	return results;
}

/** DuckDuckGo Instant Answer — abstract + RelatedTopics (no key). */
export async function searchDuckDuckGoInstant(
	query: string,
): Promise<SearchResult[]> {
	const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
	const resp = await fetchWithTimeout(url, {
		headers: { Accept: "application/json" },
	});
	if (!resp.ok) {
		logger.warn({ status: resp.status }, "[search] ddg-instant non-OK");
		return [];
	}
	const data = (await resp.json()) as {
		AbstractText?: string;
		AbstractURL?: string;
		AbstractSource?: string;
		Heading?: string;
		RelatedTopics?: Array<
			| { Text?: string; FirstURL?: string }
			| { Topics?: Array<{ Text?: string; FirstURL?: string }> }
		>;
		Results?: Array<{ Text?: string; FirstURL?: string }>;
	};
	const out: SearchResult[] = [];
	if (data.AbstractText && data.AbstractURL) {
		out.push({
			title: data.Heading || data.AbstractSource || "Summary",
			url: data.AbstractURL,
			snippet: data.AbstractText,
			...(data.AbstractSource
				? { site_name: data.AbstractSource }
				: hostnameOf(data.AbstractURL)
					? { site_name: hostnameOf(data.AbstractURL) }
					: {}),
		});
	}
	const pushTopic = (t?: { Text?: string; FirstURL?: string }) => {
		if (!t?.Text || !t.FirstURL || out.length >= MAX_RESULTS) return;
		// Text is often "Name - description"
		const dash = t.Text.indexOf(" - ");
		const title = dash > 0 ? t.Text.slice(0, dash) : t.Text.slice(0, 80);
		const snippet = dash > 0 ? t.Text.slice(dash + 3) : t.Text;
		out.push({
			title,
			url: t.FirstURL,
			snippet,
			...(hostnameOf(t.FirstURL)
				? { site_name: hostnameOf(t.FirstURL) }
				: {}),
		});
	};
	for (const r of data.Results ?? []) pushTopic(r);
	for (const topic of data.RelatedTopics ?? []) {
		if ("Topics" in topic && Array.isArray(topic.Topics)) {
			for (const t of topic.Topics) pushTopic(t);
		} else {
			pushTopic(topic as { Text?: string; FirstURL?: string });
		}
	}
	return out.slice(0, MAX_RESULTS);
}

/**
 * Run providers in priority order until we have results.
 * Exported for unit tests with mocked fetch.
 */
export async function runWebSearch(query: string): Promise<SearchResult[]> {
	if (config.TINYFISH_API_KEY) {
		try {
			const tiny = await searchTinyFish(query, config.TINYFISH_API_KEY);
			if (tiny.length > 0) return tiny;
		} catch (err) {
			logger.warn({ err }, "[search] tinyfish failed — falling back");
		}
	}

	try {
		const html = await searchDuckDuckGoHtml(query);
		if (html.length > 0) return html;
	} catch (err) {
		logger.warn({ err }, "[search] ddg-html failed — trying instant answer");
	}

	try {
		return await searchDuckDuckGoInstant(query);
	} catch (err) {
		logger.warn({ err }, "[search] ddg-instant failed");
		return [];
	}
}

searchRoutes.get("/v1/search", optionalAuth, async (c) => {
	const parsed = querySchema.safeParse(c.req.query());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					message: "Missing or invalid `query`",
					type: "invalid_request",
				},
			},
			400,
		);
	}
	const { query } = parsed.data;

	try {
		const results = await runWebSearch(query);
		return c.json({ query, results });
	} catch (err) {
		logger.warn({ err }, "[search] unexpected failure");
		return c.json({ query, results: [] });
	}
});
