/**
 * Free-tier marketing/chat copy must only name real OMA-AI free models.
	*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/models-data";
import { FREE_CHAT_MODEL_IDS, FREE_DEFAULT_CHAT_MODEL } from "@/lib/model-utils";

// AUDIT 2026-09-27 / T-8: anchor to this file, not process.cwd().
const appRoot = resolve(import.meta.dirname, "..", "..");

function readApp(rel: string): string {
	return readFileSync(resolve(appRoot, rel), "utf8");
}

describe("free-tier copy accuracy", () => {
	it("FREE_CHAT_MODEL_IDS only names real catalog ids", () => {
		// AUDIT 2026-09-27 / T-3: pinned sorted literals broke on every catalog
		// change. Assert the invariants that actually matter: every free id is
		// a real catalog entry (no fabricated ids in marketing copy) and the
		// default free model is itself free.
		const catalogIds = new Set(MODELS.map((m) => m.id));
		for (const id of FREE_CHAT_MODEL_IDS) {
			// Model ids referenced anywhere in the app source must exist either
			// in the static fallback catalog or in the live-catalog mapping —
			// flag unknown ids rather than silently shipping dead copy.
			expect(typeof id).toBe("string");
			expect(id.length).toBeGreaterThan(0);
			expect(catalogIds.has(id)).toBe(true);
		}
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
	});

	it("pricing page states honest OMA-AI margin", () => {
		const src = readApp("app/pricing/_components/PricingPageClient.tsx");
		expect(src).toMatch(/500% markup on estimated Gonka compute costs/);
		expect(src).not.toMatch(/OMA-AI models do not\./);
	});

	it("Mercury/Inception local logo is not the Zhipu tile", () => {
		const src = readApp("components/ui/model-logo.tsx");
		expect(src).toMatch(/inceptionai:\s*"\/logos\/providers\/mercury\.svg"/);
		expect(src).not.toMatch(
			/inceptionai:\s*"\/logos\/providers\/zai\.svg"/,
		);
	});
});
