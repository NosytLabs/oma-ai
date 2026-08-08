import { Hono } from "hono";
import { z } from "zod";
import { optionalAuth } from "../auth/middleware.js";
import { tokenBucket } from "../middleware/rate-limit.js";
import { logger } from "../lib/logger.js";

/**
 * /v1/search (GET ?query=…) — web search for the chat playground when WEB
 * is enabled.
 *
 * Provider: DuckDuckGo only (no API key).
 *   1. HTML results page (html.duckduckgo.com) — best coverage
 *   2. Instant Answer API — abstract + related topics if HTML is empty
 *
 * Auth is OPTIONAL so anonymous free website chat can search without an
 * account, same as free chat completions.
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

// Modest anonymous budget so DDG isn't hammered from a single IP.
searchRoutes.use(
	"/v1/search",
	tokenBucket({ refillRate: 2, bucketSize: 10, rpmLimit: 30 }),
);

const MAX_RESULTS = 6;
const FETCH_TIMEOUT_MS = 8_000;
const DDG_UA =
	"OmaSearch/1.0 (+https://oma-ai.com; playground web search; DuckDuckGo)";

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
	return decodeHtmlEntities(
		html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
	);
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

/** Deduplicate by normalized URL, keep order, cap at MAX_RESULTS. */
export function dedupeResults(results: SearchResult[]): SearchResult[] {
	const seen = new Set<string>();
	const out: SearchResult[] = [];
	for (const r of results) {
		let key = r.url;
		try {
			const u = new URL(r.url);
			key = `${u.hostname}${u.pathname}`.replace(/\/$/, "").toLowerCase();
		} catch {
			key = r.url.toLowerCase();
		}
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(r);
		if (out.length >= MAX_RESULTS) break;
	}
	return out;
}

/**
 * DuckDuckGo HTML results. No API key.
 * Parses classic result__a / result__snippet blocks.
 */
async function searchDuckDuckGoHtml(
	query: string,
): Promise<SearchResult[]> {
	const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
	const resp = await fetchWithTimeout(url, {
		method: "GET",
		headers: {
			Accept: "text/html",
			"User-Agent": DDG_UA,
		},
	});
	if (!resp.ok) {
		logger.warn({ status: resp.status }, "[search] ddg-html non-OK");
		return [];
	}
	const html = await resp.text();
	const results: SearchResult[] = [];
	const blockRe =
		/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class="[^"]*result__a|<\/div>\s*<\/div>\s*<\/div>|$)/gi;
	let match: RegExpExecArray | null;
	while (
		(match = blockRe.exec(html)) !== null &&
		results.length < MAX_RESULTS * 2
	) {
		const rawHref = decodeHtmlEntities(match[1]);
		const title = stripTags(match[2]);
		const tail = match[3] ?? "";
		const snipMatch = tail.match(
			/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
		);
		const snippet = snipMatch
			? stripTags(snipMatch[1] || snipMatch[2] || "")
			: "";
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
	return dedupeResults(results);
}

/** DuckDuckGo Instant Answer API (no key) — abstract + RelatedTopics. */
async function searchDuckDuckGoInstant(
	query: string,
): Promise<SearchResult[]> {
	const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
	const resp = await fetchWithTimeout(url, {
		headers: { Accept: "application/json", "User-Agent": DDG_UA },
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
		if (!t?.Text || !t.FirstURL || out.length >= MAX_RESULTS * 2) return;
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
	return dedupeResults(out);
}

/**
 * DuckDuckGo-only search. HTML first, Instant Answer if empty.
 * Exported for unit tests with mocked fetch.
 */
async function runWebSearch(query: string): Promise<{
	results: SearchResult[];
	provider: "duckduckgo";
}> {
	try {
		const html = await searchDuckDuckGoHtml(query);
		if (html.length > 0) {
			return { results: html, provider: "duckduckgo" };
		}
	} catch (err) {
		logger.warn({ err }, "[search] ddg-html failed — trying instant answer");
	}

	try {
		const instant = await searchDuckDuckGoInstant(query);
		return { results: instant, provider: "duckduckgo" };
	} catch (err) {
		logger.warn({ err }, "[search] ddg-instant failed");
		return { results: [], provider: "duckduckgo" };
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
		const { results, provider } = await runWebSearch(query);
		c.header("X-Search-Provider", provider);
		return c.json({ query, results, provider });
	} catch (err) {
		logger.warn({ err }, "[search] unexpected failure");
		c.header("X-Search-Provider", "duckduckgo");
		return c.json({ query, results: [], provider: "duckduckgo" as const });
	}
});
