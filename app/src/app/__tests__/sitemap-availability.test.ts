import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const MODELS = [
	{ id: "minimax-m2-7" },
	{ id: "deepseek-v4-flash-0731-openbroker" },
	{ id: "claude-opus-5" },
	{ id: "kimi-k3" },
];

vi.mock("@/lib/models-data", () => ({ MODELS }));

const originalFetch = global.fetch;

function mockCatalog(entries: { id: string; available?: boolean }[]) {
	global.fetch = vi.fn(async () =>
		new Response(JSON.stringify({ data: entries }), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	) as unknown as typeof fetch;
}

async function load() {
	const mod = await import("../sitemap");
	return mod.default;
}

describe("sitemap model availability filtering", () => {
	beforeEach(() => {
		process.env.NEXT_PUBLIC_APP_URL = "https://www.oma-ai.com";
	});
	afterEach(() => {
		global.fetch = originalFetch;
		vi.resetModules();
	});

	it("only advertises model pages that are actually available", async () => {
		// 18 of 20 models are currently dark (Venice key is a placeholder).
		// Advertising them invites Google to index pages that error when a
		// visitor tries the model.
		mockCatalog([
			{ id: "minimax-m2-7", available: true },
			{ id: "deepseek-v4-flash-0731-openbroker", available: true },
			{ id: "claude-opus-5", available: false },
			{ id: "kimi-k3", available: false },
		]);
		const sitemapFn = await load();
		const sitemap = await sitemapFn();
		const urls = sitemap.map((e) => e.url);
		expect(urls).toContain("https://www.oma-ai.com/models/minimax-m2-7");
		expect(urls).toContain(
			"https://www.oma-ai.com/models/deepseek-v4-flash-0731-openbroker",
		);
		expect(urls).not.toContain("https://www.oma-ai.com/models/claude-opus-5");
		expect(urls).not.toContain("https://www.oma-ai.com/models/kimi-k3");
	});

	it("keeps the core marketing pages regardless of model availability", async () => {
		mockCatalog([{ id: "minimax-m2-7", available: true }]);
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		for (const p of ["/", "/models", "/pricing", "/docs", "/chat", "/getting-started"]) {
			expect(urls).toContain(p === "/" ? "https://www.oma-ai.com" : `https://www.oma-ai.com${p}`);
		}
	});

	it("falls back to all models when the catalog cannot be reached", async () => {
		// A sitemap that silently drops every model page because the API had a
		// blip would be worse than a slightly-stale one. Never lose the pages.
		global.fetch = vi.fn(async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(urls.filter((u) => u.includes("/models/")).length).toBe(MODELS.length);
	});

	it("advertises the canonical www host", async () => {
		mockCatalog([{ id: "minimax-m2-7", available: true }]);
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(urls.every((u) => u.startsWith("https://www.oma-ai.com"))).toBe(true);
	});
});
