import { config } from "../config.js";

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
}

const TINYFISH_TIMEOUT_MS = 30_000;

export async function searchWeb(query: string): Promise<TinyFishSearchResponse> {
  if (!config.TINYFISH_API_KEY) {
    throw Object.assign(new Error("TinyFish API key not configured"), { status: 503 });
  }

  const url = `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": config.TINYFISH_API_KEY,
    },
    signal: AbortSignal.timeout(TINYFISH_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`TinyFish API error ${resp.status}: ${text.slice(0, 500)}`),
      { status: resp.status }
    );
  }

  return resp.json() as Promise<TinyFishSearchResponse>;
}