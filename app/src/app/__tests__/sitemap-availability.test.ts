import { describe, expect, it, vi, afterEach } from "vitest";

const MODELS = [
	{ id: "minimax-m2-7" },
	{ id: "deepseek-v4-flash-0731-openbroker" },
	{ id: "claude-opus-5" },
	{ id: "kimi-k3" },
];

vi.mock("@/lib/models-data", () => ({ MODELS }));

async function load() {
	const mod = await import("../sitemap");
	return mod.default;
}

/**
 * The sitemap deliberately does NOT filter model pages by live availability.
 *
 * An earlier revision made the sitemap fetch /v1/models and drop URLs for any
 * model not currently accepting requests. That was reverted by design (see the
 * comment at the top of sitemap.ts): a temporary provider key rotation,
 * rate-limit or outage would yank dozens of useful catalog pages out of the
 * crawl graph at once, and a build-time network blip would drop them from a
 * release entirely. Model availability is still reported live on the model
 * detail pages, llms.txt, agent-card.json and /docs — but the crawl graph
 * itself stays stable. These tests lock in that current, intended behavior.
 */
describe("sitemap model coverage", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("lists every catalog model regardless of availability", async () => {
		const sitemap = await (await load())();
		const urls = sitemap.map((e) => e.url);
		for (const id of MODELS.map((m) => m.id)) {
			expect(urls).toContain(`https://www.oma-ai.com/models/${id}`);
		}
	});

	it("keeps the core marketing pages alongside the model pages", async () => {
		const urls = (await (await load())()).map((e) => e.url);
		for (const p of ["/", "/models", "/pricing", "/docs", "/chat", "/getting-started"]) {
			expect(urls).toContain(p === "/" ? "https://www.oma-ai.com" : `https://www.oma-ai.com${p}`);
		}
	});

	it("advertises the canonical www host", async () => {
		const urls = (await (await load())()).map((e) => e.url);
		expect(urls.every((u) => u.startsWith("https://www.oma-ai.com"))).toBe(true);
	});

	it("is a pure function of the curated registry and never touches the network", async () => {
		const fn = vi.fn();
		global.fetch = fn as unknown as typeof fetch;
		await (await load())();
		expect(fn).not.toHaveBeenCalled();
	});
});
