import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const MODELS = [
	{ id: "minimax-m2-7" },
	{ id: "deepseek-v4-flash-0731-openbroker" },
	{ id: "claude-opus-5" },
	{ id: "kimi-k3" },
];

vi.mock("@/lib/models-data", () => ({ MODELS }));

const originalFetch = global.fetch;

async function load() {
	const mod = await import("../sitemap");
	return mod.default;
}

/**
 * The sitemap is a STATIC, build-time catalog by design.
 *
 * It used to fetch live availability and drop dark models, which meant the
 * crawl graph changed whenever a provider blipped — and a network failure at
 * build time silently published either the whole catalog or none of it. The
 * current contract (see the comment block in sitemap.ts) is: every model in
 * MODELS is always listed, because the model pages are real catalog pages that
 * are `noindex`ed individually when the model is unavailable.
 *
 * These tests therefore pin the static contract, and assert that the sitemap
 * makes NO network call at all — the property that makes it deterministic.
 */
describe("sitemap model catalog", () => {
	beforeEach(() => {
		process.env.NEXT_PUBLIC_APP_URL = "https://www.oma-ai.com";
		// Any fetch here is a bug: the sitemap must be build-time pure.
		global.fetch = vi.fn(async () => {
			throw new Error("sitemap must not perform network I/O");
		}) as unknown as typeof fetch;
	});
	afterEach(() => {
		global.fetch = originalFetch;
		vi.resetModules();
	});

	it("lists every model in the catalog regardless of runtime availability", async () => {
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		for (const m of MODELS) {
			expect(urls).toContain(`https://www.oma-ai.com/models/${m.id}`);
		}
	});

	it("performs no network I/O, so a provider outage cannot alter the crawl graph", async () => {
		const sitemapFn = await load();
		sitemapFn();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("keeps the core marketing pages", async () => {
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		for (const p of ["/", "/models", "/pricing", "/docs", "/chat", "/getting-started"]) {
			expect(urls).toContain(p === "/" ? "https://www.oma-ai.com" : `https://www.oma-ai.com${p}`);
		}
	});

	it("never emits duplicate URLs", async () => {
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("advertises the canonical www host", async () => {
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(urls.every((u) => u.startsWith("https://www.oma-ai.com"))).toBe(true);
	});
});
