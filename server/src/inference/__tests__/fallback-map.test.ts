import { describe, expect, it } from "vitest";
import { FALLBACK_MAP } from "../proxy.js";
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

	it("covers OpenBroker OMA-AI free models with oma-ai-first peers", () => {
		for (const id of ["gemini-3-flash-preview", "gemini-3-pro-preview"] as const) {
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
});
