import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock the upstream pixelrag server before importing the route under test.
// Each test flips the implementation to exercise happy path / 4xx / 5xx.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock execFile (used by /v1/pixel-shot to spawn `pixelshot`) so we never
// touch the real CLI in tests.
vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb?: any) => {
    if (cb) cb(null, { stdout: "/tmp/x.png.tiles\n", stderr: "" });
    return {} as any;
  }),
  spawn: vi.fn(() => ({ stdout: null, stderr: null, unref: () => {} })),
  promisify: () => vi.fn(async () => ({ stdout: "/tmp/x.png.tiles\n", stderr: "" })),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: vi.fn(async () => ({ isDirectory: () => true })),
      writeFile: vi.fn(async () => {}),
    },
    createWriteStream: () => ({ pipe: () => ({}) }),
  };
});

// Passthrough auth so handlers run as an authed user.
vi.mock("../../auth/middleware.js", () => ({
  bearerAuth: (c: any, next: any) => {
    c.set("userId", "u1");
    c.set("apiKey", { id: "k1", keyHash: "h1" });
    return next();
  },
}));

vi.mock("../../middleware/rate-limit.js", () => ({
  tokenBucket: () => async (_c: any, next: any) => next(),
  modelRateLimit: () => async (_c: any, next: any) => next(),
}));

vi.mock("../../middleware/spend-limit.js", () => ({
  spendLimit: () => async (_c: any, next: any) => next(),
}));

vi.mock("../../credits/index.js", () => ({
  getBalance: vi.fn(async () => ({ balanceCents: "100" })),
  deductCredits: vi.fn(async () => {}),
}));

vi.mock("../../credits/insufficient-credits.js", () => ({
  createInsufficientCreditsPayReq: vi.fn(() =>
    new Response(JSON.stringify({ error: "insufficient_credits" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    }),
  ),
}));

vi.mock("../../inference/handler-helpers.js", () => ({
  trackApiKeySpend: vi.fn(),
}));

import { pixelSearchRoutes } from "../pixel-search.js";

const app = new Hono();
app.route("/", pixelSearchRoutes);

describe("pixel-search routes", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("GET /v1/pixel-search/health", () => {
    it("returns ok with index stats when upstream is up", async () => {
      mockFetch
        .mockResolvedValueOnce(new Response("ok", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              total_vectors: 1234,
              dimension: 2048,
              model: "Qwen/Qwen3-VL-Embedding-2B",
              index_built_at: "2026-07-29T00:00:00Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );

      const res = await app.request("/v1/pixel-search/health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe("ok");
      expect((body.index as Record<string, unknown>).vectors).toBe(1234);
    });

    it("returns 502 when upstream unreachable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const res = await app.request("/v1/pixel-search/health");
      expect(res.status).toBe(502);
    });
  });

  describe("POST /v1/pixel-search", () => {
    it("rejects empty queries", async () => {
      const res = await app.request("/v1/pixel-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: [] }),
      });
      expect(res.status).toBe(400);
    });

    it("proxies a text query and returns scored hits", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                hits: [
                  {
                    article_id: "Python",
                    url: "https://en.wikipedia.org/wiki/Python",
                    tile_index: 0,
                    chunk_index: 3,
                    score: 0.92,
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const res = await app.request("/v1/pixel-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: [{ text: "dynamic typing" }],
          n_docs: 5,
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      // PIXELRAG_MODEL is the Qwen3-VL embedder id; route exposes it under
      // body.index.model. We don't assert "pixelrag" prefix — just that the
      // route successfully proxied the upstream response shape.
      const index = body.index as Record<string, unknown>;
      expect(typeof index.model).toBe("string");
      expect((index.model as string).length).toBeGreaterThan(0);
      expect(typeof index.base).toBe("string");
      const results = body.results as Array<{ hits: Array<{ score: number }> }>;
      expect(results[0].hits[0].score).toBeCloseTo(0.92, 2);
      expect(body.cost_cents).toBe(3);
    });

    it("returns 402 when balance insufficient", async () => {
      // Override balance for this test only.
      const { getBalance } = await import("../../credits/index.js");
      (getBalance as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balanceCents: "0",
      });

      const res = await app.request("/v1/pixel-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: [{ text: "x" }] }),
      });
      expect(res.status).toBe(402);
    });

    it("returns 502 when upstream errors", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("upstream broken", { status: 503 }),
      );
      const res = await app.request("/v1/pixel-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: [{ text: "x" }] }),
      });
      expect(res.status).toBe(502);
    });
  });

  describe("POST /v1/pixel-shot", () => {
    it("renders a URL and returns tile paths", async () => {
      const res = await app.request("/v1/pixel-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: ["https://example.com"],
          quality: 70,
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.tool).toBe("pixelshot");
      // outputs is an array of tile-dir paths parsed from pixelshot stdout
      expect(Array.isArray(body.outputs)).toBe(true);
      expect((body.outputs as string[]).length).toBeGreaterThanOrEqual(1);
      expect(typeof body.output_dir).toBe("string");
    });

    it("rejects empty urls list", async () => {
      const res = await app.request("/v1/pixel-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [] }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /v1/pixel-index", () => {
    it("enqueues an index build over a local directory", async () => {
      const res = await app.request("/v1/pixel-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_path: "/tmp/corpus" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe("started");
      expect(typeof body.job_id).toBe("string");
      expect(body.cost_cents).toBe(10);
    });

    it("returns 404 when source path is missing", async () => {
      const { promises: fs } = await import("node:fs");
      (fs.stat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("ENOENT"),
      );
      const res = await app.request("/v1/pixel-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_path: "/nonexistent" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /v1/pixel-search/tile/:a/:t/:c", () => {
    it("proxies a tile JPEG from upstream", async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic
      mockFetch.mockResolvedValueOnce(
        new Response(jpegBytes, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      );

      const res = await app.request(
        "/v1/pixel-search/tile/Python_(programming_language)/0/3",
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    });

    it("URL-encodes article_id containing slashes and parens", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(new Uint8Array([0xff, 0xd8]), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
      // Use a slashed form so we exercise the encode path; parens survive
      // encodeURIComponent as literal chars (RFC 3986 unreserved).
      const res = await app.request(
        "/v1/pixel-search/tile/foo%2Fbar/0/0",
      );
      expect(res.status).toBe(200);
      const callArgs = mockFetch.mock.calls[0][0] as string;
      // The upstream URL must contain the encoded slash so the path-segment
      // boundary is preserved when proxying to pixelrag serve.
      expect(callArgs).toContain("foo%2Fbar");
    });
  });
});
