/**
	* /v1/search — DuckDuckGo web search for the chat playground.
	*
	* optionalAuth so anonymous free-chat can search without an account.
	* Pins rate-limit budget, HTML + Instant Answer paths, caps, and
	* graceful empty results (never 5xx to the chat UI).
	*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
	fetchMock: vi.fn(),
	tokenBucketOpts: undefined as unknown,
}));

vi.mock("../../config.js", () => ({
	config: {},
}));

// Mock only the middleware this route consumes. Importing the original module
// here eagerly constructs Better Auth and its Drizzle adapter, coupling this
// isolated route test to a real DATABASE_URL before the test body even runs.
vi.mock("../../auth/middleware.js", () => ({
	optionalAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("../../middleware/rate-limit.js", () => ({
	tokenBucket: vi.fn((opts: unknown) => {
		state.tokenBucketOpts = opts;
		return async (_c: unknown, next: () => Promise<void>) => next();
	}),
}));

import { dedupeResults, searchRoutes } from "../search.js";

function request(path: string) {
	const app = new Hono();
	app.route("/", searchRoutes);
	return app.request(`http://localhost${path}`);
}

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
	vi.stubGlobal("fetch", state.fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("/v1/search", () => {
	it.each(["html", "instant"])("bounds a stalled %s response body instead of hanging web search", async stalled => {
		vi.useFakeTimers();
		let abortBody!: () => void;
		state.fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
			const isHtml = String(url).includes("html.duckduckgo.com");
			if ((stalled === "html") === isHtml) {
				return new Response(new ReadableStream({ start(controller) {
					abortBody = () => controller.error(new Error("test cleanup"));
					init.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
				} }), { status: 200 });
			}
			return new Response(isHtml ? "" : JSON.stringify({ AbstractText: "Fallback answer", AbstractURL: "https://example.test", Heading: "Fallback" }), { status: 200 });
		});
		let response: Response | undefined;
		const pending = Promise.resolve(request("/v1/search?query=test")).then(res => { response = res; });
		await vi.advanceTimersByTimeAsync(8000);
		try {
			expect(response?.status).toBe(200);
			const body = await response!.json();
			expect(body.results).toHaveLength(stalled === "html" ? 1 : 0);
		} finally { if (!response) abortBody(); await pending; }
	});

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
	});

	it("rejects a query over 500 chars with 400", async () => {
		const res = await request(
			`/v1/search?query=${encodeURIComponent("a".repeat(501))}`,
		);
		expect(res.status).toBe(400);
	});

	it("returns DuckDuckGo HTML results for anonymous callers", async () => {
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
		expect(res.headers.get("X-Search-Provider")).toBe("duckduckgo");
		const json = (await res.json()) as {
			query: string;
			provider: string;
			results: Array<{ title: string; url: string; snippet: string }>;
		};
		expect(json.query).toBe("open model access");
		expect(json.provider).toBe("duckduckgo");
		expect(json.results).toHaveLength(1);
		expect(json.results[0]).toMatchObject({
			title: "OMA",
			url: "https://oma-ai.com",
			snippet: "Open Model Access",
			site_name: "oma-ai.com",
		});
		const urls = state.fetchMock.mock.calls.map((c) => String(c[0]));
		expect(urls.some((u) => u.includes("html.duckduckgo.com"))).toBe(true);
		expect(urls.some((u) => u.includes("tinyfish"))).toBe(false);
	});

	it("caps HTML results at 6", async () => {
		state.fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("html.duckduckgo.com")) {
				return new Response(
					ddgHtmlPage(
						Array.from({ length: 12 }, (_, i) => ({
							title: `T${i}`,
							url: `https://example.com/${i}`,
							snippet: `S${i}`,
						})),
					),
					{ status: 200 },
				);
			}
			return new Response("{}", { status: 200 });
		});

		const res = await request("/v1/search?query=cap");
		const json = (await res.json()) as { results: unknown[] };
		expect(json.results).toHaveLength(6);
	});

	it("dedupes identical URLs", () => {
		const d = dedupeResults([
			{ title: "A", url: "https://ex.com/a/", snippet: "1" },
			{ title: "A2", url: "https://ex.com/a", snippet: "2" },
			{ title: "B", url: "https://ex.com/b", snippet: "3" },
		]);
		expect(d).toHaveLength(2);
		expect(d[0].title).toBe("A");
		expect(d[1].title).toBe("B");
	});

	it("uses Instant Answer when HTML is empty", async () => {
		state.fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("html.duckduckgo.com")) {
				return new Response("<html></html>", { status: 200 });
			}
			if (String(url).includes("api.duckduckgo.com")) {
				return new Response(
					JSON.stringify({
						Heading: "OpenAI",
						AbstractText: "An AI research lab.",
						AbstractURL: "https://en.wikipedia.org/wiki/OpenAI",
						AbstractSource: "Wikipedia",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("{}", { status: 200 });
		});

		const res = await request("/v1/search?query=openai");
		const json = (await res.json()) as {
			results: Array<{ title: string; snippet: string }>;
			provider: string;
		};
		expect(json.provider).toBe("duckduckgo");
		expect(json.results[0]?.title).toBe("OpenAI");
		expect(json.results[0]?.snippet).toContain("AI research");
	});

	it("returns empty results when every DDG path fails", async () => {
		// Silence the expected console.error logs for this test
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		state.fetchMock.mockRejectedValue(new Error("network down"));

		const res = await request("/v1/search?query=throw");
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			results: unknown[];
			provider: string;
		};
		expect(json.results).toEqual([]);
		expect(json.provider).toBe("duckduckgo");
		consoleSpy.mockRestore();
	});

	it("never calls tinyfish hosts", async () => {
		state.fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("tinyfish")) {
				throw new Error("tinyfish must not be called");
			}
			if (String(url).includes("html.duckduckgo.com")) {
				return new Response(ddgHtmlPage([]), { status: 200 });
			}
			if (String(url).includes("api.duckduckgo.com")) {
				return new Response(JSON.stringify({}), { status: 200 });
			}
			return new Response("{}", { status: 200 });
		});
		const res = await request("/v1/search?query=x");
		expect(res.status).toBe(200);
		const urls = state.fetchMock.mock.calls.map((c) => String(c[0]));
		expect(urls.every((u) => !u.includes("tinyfish"))).toBe(true);
	});
});
