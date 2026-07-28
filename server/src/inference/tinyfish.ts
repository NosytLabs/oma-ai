import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export interface TinyFishSearchResult {
  position: number;
  site_name: string;
  title: string;
  snippet: string;
  url: string;
}

export interface TinyFishSearchResponse {
  query: string;
  results: TinyFishSearchResult[];
  total_results: number;
  page: number;
  /** Present when results came from the free fallback (no TinyFish key). */
  provider?: "tinyfish" | "duckduckgo";
}

const TINYFISH_TIMEOUT_MS = 30_000;
const FALLBACK_TIMEOUT_MS = 12_000;

async function searchTinyFish(query: string): Promise<TinyFishSearchResponse> {
  const url = `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": config.TINYFISH_API_KEY as string,
    },
    signal: AbortSignal.timeout(TINYFISH_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`TinyFish API error ${resp.status}: ${text.slice(0, 500)}`),
      { status: resp.status },
    );
  }

  const data = (await resp.json()) as TinyFishSearchResponse;
  return { ...data, provider: "tinyfish" };
}

/**
 * Wikipedia OpenSearch is keyword-oriented. Chat prompts like
 * "What is OMA AI? One short sentence." return zero hits — strip question
 * fluff and cap length so free web-search produces real sources.
 */
export function normalizeSearchQuery(raw: string): string {
  let q = raw.trim().replace(/\s+/g, " ");
  if (!q) return q;
  // First sentence / clause only
  q = q.split(/[.!?\n]/)[0]?.trim() || q;
  q = q
    .replace(
      /^(what is|what are|who is|who are|where is|where are|when is|how does|how do|how to|why is|why are|tell me about|explain|search for|look up|define)\s+/i,
      "",
    )
    .replace(/[“”"']/g, "")
    .trim();
  // Drop leading articles for multi-word keyword queries so Wikipedia
  // OpenSearch prefers "capital of France" over "The Capital of the World".
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && /^(the|a|an)$/i.test(words[0])) {
    q = words.slice(1).join(" ");
  } else if (words.length > 8) {
    q = words.slice(0, 8).join(" ");
  }
  return q || raw.trim().slice(0, 80);
}

async function wikiOpenSearch(search: string): Promise<TinyFishSearchResult[]> {
  const wikiUrl =
    `https://en.wikipedia.org/w/api.php?action=opensearch` +
    `&search=${encodeURIComponent(search)}&limit=8&namespace=0&format=json` +
    `&origin=*`;
  const resp = await fetch(wikiUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "OMA-AI/1.0 (+https://oma-ai.com; web-search-fallback)",
    },
    signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw Object.assign(
      new Error(`Wikipedia search fallback error ${resp.status}`),
      { status: 502 },
    );
  }
  const text = await resp.text();
  if (!text.trim()) {
    throw Object.assign(new Error("Wikipedia search returned empty body"), {
      status: 502,
    });
  }
  // OpenSearch JSON: [query, titles[], descriptions[], urls[]]
  let data: [string, string[], string[], string[]];
  try {
    data = JSON.parse(text) as [string, string[], string[], string[]];
  } catch {
    throw Object.assign(new Error("Wikipedia search returned invalid JSON"), {
      status: 502,
    });
  }
  const titles = data[1] ?? [];
  const snippets = data[2] ?? [];
  const urls = data[3] ?? [];
  const results: TinyFishSearchResult[] = [];
  for (let i = 0; i < titles.length; i++) {
    const url = urls[i];
    if (!url) continue;
    results.push({
      position: i + 1,
      site_name: "wikipedia.org",
      title: titles[i] || `Result ${i + 1}`,
      snippet: (snippets[i] || titles[i] || "").slice(0, 400),
      url,
    });
  }
  return results;
}

/**
 * Keyless fallback for website free chat when TINYFISH_API_KEY is unset.
 * Wikipedia OpenSearch (stable, no key). Query is normalized so chat-style
 * prompts still yield sources.
 */
export async function searchDuckDuckGoFallback(
  query: string,
): Promise<TinyFishSearchResponse> {
  const primary = normalizeSearchQuery(query);
  let results = await wikiOpenSearch(primary);

  // Progressive shortening if the full phrase is too specific for OpenSearch
  if (results.length === 0 && primary.includes(" ")) {
    const words = primary.split(/\s+/);
    for (const n of [5, 3, 2, 1]) {
      if (words.length <= n) continue;
      results = await wikiOpenSearch(words.slice(0, n).join(" "));
      if (results.length > 0) break;
    }
  }

  return {
    query: primary || query,
    results,
    total_results: results.length,
    page: 1,
    // Keep provider tag stable for existing clients/tests; this is the
    // free keyless path used when TinyFish is unavailable.
    provider: "duckduckgo",
  };
}

/**
 * Web search for chat tools. Prefers TinyFish when configured; otherwise
 * uses a keyless DuckDuckGo Instant Answer fallback so free website chat
 * web-search does not hard-fail with 503.
 */
export async function searchWeb(query: string): Promise<TinyFishSearchResponse> {
  if (config.TINYFISH_API_KEY) {
    try {
      return await searchTinyFish(query);
    } catch (err) {
      // If TinyFish is configured but fails, try free fallback rather than
      // breaking chat web-search entirely.
      logger.warn({ err }, "[search] TinyFish failed; trying DuckDuckGo fallback");
      try {
        return await searchDuckDuckGoFallback(query);
      } catch {
        throw err;
      }
    }
  }

  logger.info("[search] TINYFISH_API_KEY unset — using DuckDuckGo fallback");
  return searchDuckDuckGoFallback(query);
}
