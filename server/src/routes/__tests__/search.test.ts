/**
 * /v1/search — web search for the chat playground.
 *
 * The route is optionalAuth so the anonymous free-chat tier can search
 * without an account (exactly like chat completions), so these tests pin:
 *   - the modest token-bucket rate limit that stops anonymous callers from
 *     burning upstream quota in a tight loop,
 *   - TinyFish primary when keyed + successful,
 *   - DuckDuckGo HTML / Instant Answer fallbacks when TinyFish is missing
 *     or fails (DNS/network/empty),
 *   - graceful empty results on total failure (never 5xx to the chat UI).
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

/** Build a minimal DDG HTML results page. */
function ddgHtmlPage(
	items: Array<{ title: string; url: string; snippet: string }>,
): string {
	return items
		.map(
			(item) => `
    <div class="result results_links">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(item.url)}">${item.title}</a>
      <a class="result__snippet" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(item.url)}">${item.snippet}</a>
    </div>`,
		)
		.join("\n");
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
		const res = await request(
			`/v1/search?query=${encodeURIComponent("a".repeat(501))}`,
		);
		expect(res.status).toBe(400);
		expect(state.fetchMock).not.toHaveBeenCalled();
	});

	it("falls back to DuckDuckGo HTML when no TinyFish key — anonymous allowed", async () => {
		state.fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("html.duckduckgo.com")) {
				return new Response(
					ddgHtmlPage([
						{
							title: "OMA",
							url: "https://oma-ai.com",
							snippet: "Open Model Access",
						},
					]),
					{ status: 200, headers: { "Content-Type": "text/html" } },
				);
			}
			return new Response("{}", { status: 200 });
		});

		const res = await request("/v1/search?query=open+model+access");
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			query: string;
			results: Array<{ title: string; url: string; snippet: string }>;
		};
		expect(json.query).toBe("open model access");
		expect(json.results).toHaveLength(1);
		expect(json.results[0]).toMatchObject({
			title: "OMA",
			url: "https://oma-ai.com",
			snippet: "Open Model Access",
			site_name: "oma-ai.com",
		});
		// Must not call TinyFish without a key.
		const urls = state.fetchMock.mock.calls.map((c) => String(c[0]));
		expect(urls.some((u) => u.includes("tinyfish"))).toBe(false);
		expect(urls.some((u) => u.includes("html.duckduckgo.com"))).toBe(true);
	});

	it("maps TinyFish results when key is set and upstream succeeds", async () => {
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
		const [, init] = state.fetchMock.mock.calls[0] as [string, RequestInit];
		expect(init.headers).toMatchObject({ "X-Api-Key": "sk_test" });
	});

	it("caps TinyFish results at 6", async () => {
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

	it("falls back to DuckDuckGo when TinyFish returns empty", async () => {
		state.tinyfishKey = "sk_test";
		state.fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("tinyfish")) {
				return new Response(JSON.stringify({ results: [] }), { status: 200 });
			}
			if (String(url).includes("html.duckduckgo.com")) {
				return new Response(
					ddgHtmlPage([
						{
							title: "Fallback",
							url: "https://example.org/f",
							snippet: "from ddg",
						},
					]),
					{ status: 200 },
				);
			}
			return new Response("{}", { status: 200 });
		});

		const res = await request("/v1/search?query=fallback");
		const json = (await res.json()) as {
			results: Array<{ title: string; url: string }>;
		};
		expect(json.results).toHaveLength(1);
		expect(json.results[0].title).toBe("Fallback");
	});

	it("falls back to DuckDuckGo when TinyFish throws / is unreachable", async () => {
		state.tinyfishKey = "sk_test";
		state.fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("tinyfish")) {
				throw new Error("getaddrinfo ENOTFOUND api.tinyfish.io");
			}
			if (String(url).includes("html.duckduckgo.com")) {
				return new Response(
					ddgHtmlPage([
						{
							title: "Live",
							url: "https://example.com/live",
							snippet: "ok",
						},
					]),
					{ status: 200 },
				);
			}
			return new Response("{}", { status: 200 });
		});

		const res = await request("/v1/search?query=down");
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			results: Array<{ title: string }>;
		};
		expect(json.results[0]?.title).toBe("Live");
	});

	it("uses Instant Answer when HTML also fails", async () => {
		state.fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("html.duckduckgo.com")) {
				throw new Error("html down");
			}
			if (String(url).includes("api.duckduckgo.com")) {
				return new Response(
					JSON.stringify({
						Heading: "OpenAI",
						AbstractText: "An AI research lab.",
						AbstractURL: "https://en.wikipedia.org/wiki/OpenAI",
						AbstractSource: "Wikipedia",
						RelatedTopics: [
							{
								Text: "GPT - large language model",
								FirstURL: "https://en.wikipedia.org/wiki/GPT",
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("{}", { status: 200 });
		});

		const res = await request("/v1/search?query=openai");
		const json = (await res.json()) as {
			results: Array<{ title: string; snippet: string }>;
		};
		expect(json.results.length).toBeGreaterThanOrEqual(1);
		expect(json.results[0].title).toBe("OpenAI");
		expect(json.results[0].snippet).toContain("AI research");
	});

	it("returns empty results when every provider fails", async () => {
		state.fetchMock.mockRejectedValue(new Error("network down"));

		const res = await request("/v1/search?query=throw");
		expect(res.status).toBe(200);
		const json = (await res.json()) as { results: unknown[] };
		expect(json.results).toEqual([]);
	});
});
