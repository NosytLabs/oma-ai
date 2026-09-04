import { describe, expect, it } from "vitest";
import { FALLBACK_MAP, buildFallbackChain } from "../fallback.js";
import { getModelById } from "../models.js";

/**
	* Inference router FALLBACK_MAP must only reference models that exist
	* in the curated catalog, and every OMA-AI free model must have a chain.
	*/
describe("FALLBACK_MAP (inference router)", () => {
	it("every target and fallback id resolves in the catalog", () => {
		for (const [primary, fallbacks] of Object.entries(FALLBACK_MAP)) {
			expect(getModelById(primary), `missing primary ${primary}`).toBeTruthy();
			for (const fb of fallbacks) {
				expect(getModelById(fb), `missing fallback ${fb} for ${primary}`).toBeTruthy();
			}
		}
	});

	it("covers OMA-AI resale models with oma-ai-first peers", () => {
		for (const id of ["deepseek-v4-flash-0731-openbroker", "minimax-m2-7"] as const) {
			const chain = FALLBACK_MAP[id];
			expect(chain, `no FALLBACK_MAP entry for ${id}`).toBeTruthy();
			expect(chain!.length).toBeGreaterThan(0);
			// Prefer another OMA-AI id before Venice budget when possible
			const peers = chain!.filter((f) => {
				const m = getModelById(f);
				return m?.provider === "oma-ai";
			});
			expect(peers.length, `${id} should prefer OMA-AI peers`).toBeGreaterThan(0);
		}
	});

	it("does not include self as a fallback entry", () => {
		for (const [primary, fallbacks] of Object.entries(FALLBACK_MAP)) {
			expect(fallbacks).not.toContain(primary);
		}
	});

	it("covers every live catalog id so failover is never empty", () => {
		const live = [
			"claude-opus-5",
			"claude-sonnet-4-6",
			"deepseek-v4-flash-0731",
			"deepseek-v4-flash-0731-openbroker",
			"deepseek-v4-pro",
			"gemini-3-6-flash",
			"google-gemma-4-31b-it",
			"grok-4-5",
			"hermes-3-llama-3.1-405b",
			"kimi-k2-6",
			"kimi-k3",
			"llama-3.3-70b",
			"minimax-m2-7",
			"mistral-small-2603",
			"openai-gpt-56-sol",
			"qwen-3-7-plus",
			"qwen-3-8-max",
			"venice-uncensored-1-2",
			"xiaomi-mimo-v2-5",
			"zai-org-glm-5-1",
			"zai-org-glm-5-2",
		];
		for (const id of live) {
			expect(getModelById(id), `catalog missing ${id}`).toBeTruthy();
			expect(FALLBACK_MAP[id], `no FALLBACK_MAP for ${id}`).toBeTruthy();
			expect(FALLBACK_MAP[id]!.length).toBeGreaterThan(0);
		}
	});
});

describe("buildFallbackChain", () => {
	it("orders primary → client models[] → server map and dedupes", () => {
		const chain = buildFallbackChain(
			"deepseek-v4-flash-0731-openbroker",
			["minimax-m2-7", "deepseek-v4-flash-0731-openbroker", "not-a-real-model"],
			false,
		);
		expect(chain[0]).toBe("deepseek-v4-flash-0731-openbroker");
		expect(chain[1]).toBe("minimax-m2-7");
		expect(chain).not.toContain("not-a-real-model");
		// primary appears only once
		expect(chain.filter((id) => id === "deepseek-v4-flash-0731-openbroker")).toHaveLength(1);
		// server peers still present after client list
		expect(chain.length).toBeGreaterThan(2);
	});

	it("freeOnly drops Venice/paid peers so guest chat stays free", () => {
		const chain = buildFallbackChain(
			"deepseek-v4-flash-0731-openbroker",
			["llama-3.3-70b", "minimax-m2-7", "gpt-4o"],
			true,
		);
		expect(chain[0]).toBe("deepseek-v4-flash-0731-openbroker");
		expect(chain).toContain("minimax-m2-7");
		expect(chain).not.toContain("llama-3.3-70b");
		expect(chain).not.toContain("gpt-4o");
		for (const id of chain) {
			const m = getModelById(id);
			expect(m?.upstream, `${id} must be Gonka/openbroker for free chat`).toBe(
				"openbroker",
			);
		}
	});

	it("returns primary alone when freeOnly and primary has no free peers", () => {
		// Venice primary + freeOnly → only primary if it were oma-ai; for a
		// Venice id freeOnly filters everything — still return [primary]
		// so callProvider can produce a real 401/404 rather than empty chain.
		const chain = buildFallbackChain("llama-3.3-70b", [], true);
		expect(chain).toEqual(["llama-3.3-70b"]);
	});

	it("lets a Venice free-list model fail over to Gonka peers", () => {
		const chain = buildFallbackChain("mistral-small-2603", [], true);
		expect(chain[0]).toBe("mistral-small-2603");
		const gonka = chain.filter((id) => getModelById(id)?.upstream === "openbroker");
		expect(gonka.length).toBeGreaterThan(0);
	});
});
