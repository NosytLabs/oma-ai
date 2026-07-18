import { config } from "../config.js";
import { Agent, request } from "undici";

export interface TinyFishFetchResult {
  url: string;
  status: number;
  content: string;
  title?: string;
  description?: string;
}

export interface TinyFishFetchResponse {
  results: TinyFishFetchResult[];
}

interface PinnedIpMap {
  [hostname: string]: string;
}

/**
 * Creates an undici Agent that resolves a specific hostname to a pinned IP.
 * This prevents DNS rebinding attacks by ensuring the connection goes to
 * the IP address that was validated during the SSRF check.
 */
function createPinnedAgent(pinnedIps: PinnedIpMap): Agent {
  return new Agent({
    connections: 10,
    pipelining: 10,
    connect: {
      // Custom DNS resolver that returns pinned IPs for known hostnames
      // For hostnames not in the map, fall back to system DNS
      resolver: {
        resolve: async (hostname: string) => {
          const pinned = pinnedIps[hostname];
          if (pinned) {
            return [{ address: pinned, family: pinned.includes(':') ? 6 : 4 }];
          }
          // Fall back to system resolver for non-pinned hostnames
          const dns = await import('node:dns/promises');
          const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
          const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
          return [
            ...v4.map((address) => ({ address, family: 4 as const })),
            ...v6.map((address) => ({ address, family: 6 as const })),
          ];
        },
      },
    },
  });
}

export async function fetchWebPages(urls: string[], pinnedIps: PinnedIpMap = {}): Promise<TinyFishFetchResponse> {
  // If we have pinned IPs, use a custom agent that forces DNS resolution to those IPs
  // Otherwise, fall back to the TinyFish API for backward compatibility
  if (Object.keys(pinnedIps).length > 0) {
    const agent = createPinnedAgent(pinnedIps);
    const results: TinyFishFetchResult[] = [];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        // Use undici's request function which accepts a dispatcher option
        const { statusCode, headers, body } = await request(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'OMA-AI-Fetch/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          dispatcher: agent,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const content = await body.text();
        results.push({
          url,
          status: statusCode,
          content: content.slice(0, 50000), // Limit content size
        });
      } catch (err) {
        results.push({
          url,
          status: 0,
          content: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return { results };
  }

  // Fallback to TinyFish API when no pinned IPs (e.g., internal fetches)
  const apiKey = config.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error('TINYFISH_API_KEY not configured');
  }

  const resp = await fetch('https://api.fetch.tinyfish.ai', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls }),
  });

  if (!resp.ok) {
    throw new Error(`TinyFish Fetch API error: ${resp.status}`);
  }

  return resp.json();
}