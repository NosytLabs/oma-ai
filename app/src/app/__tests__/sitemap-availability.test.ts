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

	it("fails closed in production when the catalog cannot be reached", async () => {
		// Production must NOT publish the full catalog on a fetch failure.
		// A build-time network blip would otherwise permanently advertise
		// every dark model page, which then ranks and errors for visitors —
		// strictly worse than omitting them until availability is re-confirmed.
		vi.stubEnv("NODE_ENV", "production");
		global.fetch = vi.fn(async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(urls.filter((u) => u.includes("/models/"))).toHaveLength(0);
		// Core marketing pages must survive regardless.
		expect(urls).toContain("https://www.oma-ai.com/models");
		vi.unstubAllEnvs();
	});

	it("falls back to all models in dev when the catalog cannot be reached", async () => {
		// Local dev has no dark-model SEO stakes, and a full list is the more
		// useful debugging surface. Production is the only strict case.
		vi.stubEnv("NODE_ENV", "development");
		global.fetch = vi.fn(async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(urls.filter((u) => u.includes("/models/")).length).toBe(MODELS.length);
		vi.unstubAllEnvs();
	});

	it("never hangs the build on a slow catalog", async () => {
		// A hung upstream must not stall the whole build; the AbortSignal
		// turns an indefinite wait into the same fail-closed path.
		vi.stubEnv("NODE_ENV", "production");
		global.fetch = vi.fn(
			(_url: string, init?: RequestInit) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(new Error("aborted")),
					);
				}),
		) as unknown as typeof fetch;
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(urls.filter((u) => u.includes("/models/"))).toHaveLength(0);
		vi.unstubAllEnvs();
	});

	it("advertises the canonical www host", async () => {
		mockCatalog([{ id: "minimax-m2-7", available: true }]);
		const sitemapFn = await load();
		const urls = (await sitemapFn()).map((e) => e.url);
		expect(urls.every((u) => u.startsWith("https://www.oma-ai.com"))).toBe(true);
	});
});
