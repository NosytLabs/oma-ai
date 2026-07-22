import { config } from "../config.js";
import { Agent, request } from "undici";
import * as dns from "node:dns";

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

/** Default body cap for pinned fetches — prevents large/hostile pages from OOM'ing the process. */
export const DEFAULT_MAX_RESPONSE_BYTES = 50_000;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Read at most `maxBytes` from an async-iterable body (undici response body,
 * Node readable, or test generators). Stops consuming once the cap is hit so
 * a multi-GB response never fully buffers in process memory.
 *
 * Remaining stream data is discarded via undici's `body.dump()` when available
 * so the socket is released promptly without accumulating the rest of the body.
 */
export async function readBodyLimited(
  body: AsyncIterable<Uint8Array | Buffer | string>,
  maxBytes: number,
): Promise<string> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return "";

  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;

  try {
    for await (const chunk of body) {
      const buf =
        typeof chunk === "string"
          ? Buffer.from(chunk)
          : Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk);

      const remaining = maxBytes - total;
      if (remaining <= 0) {
        truncated = true;
        break;
      }

      if (buf.length <= remaining) {
        chunks.push(buf);
        total += buf.length;
      } else {
        chunks.push(buf.subarray(0, remaining));
        total = maxBytes;
        truncated = true;
        break;
      }
    }
  } finally {
    if (truncated) {
      const dump = (body as { dump?: () => Promise<unknown> }).dump;
      if (typeof dump === "function") {
        try {
          await dump.call(body);
        } catch {
          // Best-effort drain; ignore abort/destroy races.
        }
      }
    }
  }

  return Buffer.concat(chunks, total).toString("utf8");
}

/**
 * Build an undici Agent that pins hostnames to vetted public IPs.
 *
 * DNS rebinding is closed by `connect.lookup` returning the pre-validated IP
 * for any hostname in `pinnedIps` (the SSRF guard already resolved and checked
 * the IP earlier). Unpinned hostnames fall back to system DNS for compatibility
 * with internal callers; the `/v1/fetch` route always supplies pinned maps.
 *
 * Redirects are disabled (`maxRedirections: 0`) so a 3xx cannot bounce to a
 * private IP after the initial URL passed the SSRF check.
 */
function createPinnedAgent(pinnedIps: PinnedIpMap): Agent {
  return new Agent({
    bodyTimeout: 15_000,
    headersTimeout: 10_000,
    connect: {
      lookup: (
        hostname: string,
        options: dns.LookupOneOptions | dns.LookupAllOptions | dns.LookupOptions,
        callback: (
          err: NodeJS.ErrnoException | null,
          address: string | dns.LookupAddress[],
          family: number,
        ) => void,
      ) => {
        const pinned = pinnedIps[hostname];
        if (pinned) {
          callback(null, pinned, pinned.includes(":") ? 6 : 4);
          return;
        }
        dns.lookup(hostname, options, callback);
      },
      autoSelectFamily: false,
    },
  });
}

interface FetchOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
}

async function pinnedFetch(
  url: string,
  pinnedIps: PinnedIpMap,
  options: FetchOptions = {},
): Promise<TinyFishFetchResult> {
  const agent = createPinnedAgent(pinnedIps);
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // undici `request` does not follow redirects by default (maxRedirections=0),
    // so a 302 cannot bounce to a private IP after the initial SSRF pin.
    const { statusCode, body } = await request(url, {
      method: "GET",
      headers: {
        "User-Agent": "OMA-AI-Fetch/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      dispatcher: agent,
      signal: controller.signal,
    });

    // Stream-cap the body: never `body.text()` then slice (that buffers all
    // bytes first and can OOM on hostile multi-MB/GB pages).
    const content = await readBodyLimited(
      body as AsyncIterable<Uint8Array>,
      maxResponseBytes,
    );

    return { url, status: statusCode, content };
  } finally {
    clearTimeout(timer);
    await agent.close();
  }
}

export async function fetchWebPages(
  urls: string[],
  pinnedIps: PinnedIpMap = {},
  options: FetchOptions = {},
): Promise<TinyFishFetchResponse> {
  // Pinned path: caller has already run `isWebhookUrlSafe` and supplied
  // the validated IPs. Use the undici dispatcher above; do NOT fall back
  // to the TinyFish proxy, which would re-resolve the hostname and
  // re-introduce the SSRF window.
  if (Object.keys(pinnedIps).length > 0) {
    const results: TinyFishFetchResult[] = [];
    for (const url of urls) {
      try {
        const result = await pinnedFetch(url, pinnedIps, options);
        results.push(result);
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

  // No pinned IPs — must NOT fetch user-supplied URLs. This branch is
  // kept only for internal server-side fetches that go to the TinyFish
  // proxy with a server-controlled URL.
  const apiKey = config.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY not configured and no pinned IPs provided");
  }

  const resp = await fetch("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ urls }),
  });

  if (!resp.ok) {
    throw new Error(`TinyFish Fetch API error: ${resp.status}`);
  }

  return (await resp.json()) as TinyFishFetchResponse;
}
