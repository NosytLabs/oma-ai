/**
 * /v1/search — web search for the chat playground.
 *
 * The route is optionalAuth so the anonymous free-chat tier can search
 * without an account (exactly like chat completions), so these tests pin:
 *   - the modest token-bucket rate limit that stops anonymous callers from
 *     burning Tinyfish quota in a tight loop,
 *   - the empty-results fallback when no upstream key is configured,
 *   - upstream result mapping + the 6-result cap,
 *   - graceful empty results on upstream errors (never 5xx to the chat UI).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  tinyfishKey: "",
  fetchMock: vi.fn(),
  tokenBucketOpts: undefined as unknown,
}));

// Mock config so module-load env validation is skipped and the upstream-key
// gate can be flipped per test via the hoisted getter.
vi.mock("../../config.js", () => ({
  config: {
    get TINYFISH_API_KEY() {
      return state.tinyfishKey;
    },
  },
}));

// Auth is covered by its own suite — make it a pass-through here so tests
// exercise routing + upstream behavior only.
vi.mock("../../auth/middleware.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../auth/middleware.js")>();
  return {
    ...mod,
    optionalAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  };
});

vi.mock("../../middleware/rate-limit.js", () => ({
  tokenBucket: vi.fn((opts: unknown) => {
    state.tokenBucketOpts = opts;
    return async (_c: unknown, next: () => Promise<void>) => next();
  }),
}));

import { searchRoutes } from "../search.js";

function request(path: string) {
  const app = new Hono();
  app.route("/", searchRoutes);
  return app.request(`http://localhost${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tinyfishKey = "";
  vi.stubGlobal("fetch", state.fetchMock);
});

describe("/v1/search", () => {
  it("is rate-limited with a modest anonymous budget", () => {
    expect(state.tokenBucketOpts).toEqual({
      refillRate: 2,
      bucketSize: 10,
      rpmLimit: 30,
    });
  });

  it("rejects a missing query with 400", async () => {
    const res = await request("/v1/search");
    expect(res.status).toBe(400);
    expect(state.fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only query with 400", async () => {
    const res = await request("/v1/search?query=%20%20%20");
    expect(res.status).toBe(400);
    expect(state.fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a query over 500 chars with 400", async () => {
    const res = await request(`/v1/search?query=${encodeURIComponent("a".repeat(501))}`);
    expect(res.status).toBe(400);
    expect(state.fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty results with no upstream key — anonymous is allowed", async () => {
    const res = await request("/v1/search?query=open+model+access");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { query: string; results: unknown[] };
    expect(json.query).toBe("open model access");
    expect(json.results).toEqual([]);
    expect(state.fetchMock).not.toHaveBeenCalled();
  });

  it("maps upstream results when TINYFISH_API_KEY is set", async () => {
    state.tinyfishKey = "sk_test";
    state.fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "T1",
              url: "https://example.com/1",
              snippet: "S1",
              site_name: "Ex",
              favicon: "https://example.com/f.ico",
            },
            { title: "T2", url: "https://example.com/2", snippet: "S2" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await request("/v1/search?query=hello");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      query: string;
      results: Array<{
        title: string;
        url: string;
        snippet: string;
        site_name?: string;
        favicon?: string;
      }>;
    };
    expect(json.results).toHaveLength(2);
    expect(json.results[0]).toMatchObject({
      title: "T1",
      url: "https://example.com/1",
      snippet: "S1",
      site_name: "Ex",
      favicon: "https://example.com/f.ico",
    });
    // Upstream is called with the server-held key, never a client key.
    const [, init] = state.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "X-Api-Key": "sk_test" });
  });

  it("caps upstream results at 6", async () => {
    state.tinyfishKey = "sk_test";
    state.fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: Array.from({ length: 12 }, (_, i) => ({
            title: `T${i}`,
            url: `https://example.com/${i}`,
            snippet: `S${i}`,
          })),
        }),
        { status: 200 },
      ),
    );

    const res = await request("/v1/search?query=cap");
    const json = (await res.json()) as { results: unknown[] };
    expect(json.results).toHaveLength(6);
  });

  it("returns empty results when the upstream responds non-OK", async () => {
    state.tinyfishKey = "sk_test";
    state.fetchMock.mockResolvedValue(new Response("boom", { status: 502 }));

    const res = await request("/v1/search?query=down");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { results: unknown[] };
    expect(json.results).toEqual([]);
  });

  it("returns empty results when the upstream throws", async () => {
    state.tinyfishKey = "sk_test";
    state.fetchMock.mockRejectedValue(new Error("network down"));

    const res = await request("/v1/search?query=throw");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { results: unknown[] };
    expect(json.results).toEqual([]);
  });
});
