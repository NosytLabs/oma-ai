import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODEL_RATE_OVERRIDES } from "../shared";

/**
 * Docs rate-limit table must match server MODEL_LIMITS
 * (server/src/middleware/rate-limit/utils.ts). Parses the server source so
 * this fails if either side drifts.
 */
function parseServerModelLimits(): Record<string, { rpm: number; tpm: number }> {
	const utilsPath = resolve(
		process.cwd(),
		"../server/src/middleware/rate-limit/utils.ts",
	);
	const src = readFileSync(utilsPath, "utf8");
	const block = src.match(
		/export const MODEL_LIMITS[^=]*=\s*\{([\s\S]*?)\n\};/,
	)?.[1];
	if (!block) throw new Error("Could not parse MODEL_LIMITS from server utils");
	const out: Record<string, { rpm: number; tpm: number }> = {};
	const re =
		/"([^"]+)":\s*\{\s*rpm:\s*(\d+),\s*tpm:\s*(\d+)\s*\}/g;
	for (const m of block.matchAll(re)) {
		out[m[1]] = { rpm: Number(m[2]), tpm: Number(m[3]) };
	}
	return out;
}

describe("MODEL_RATE_OVERRIDES mirrors server MODEL_LIMITS", () => {
	it("includes every server MODEL_LIMITS entry with identical rpm/tpm", () => {
		const server = parseServerModelLimits();
		expect(Object.keys(server).length).toBeGreaterThan(0);

		const docs = Object.fromEntries(
			MODEL_RATE_OVERRIDES.map((r) => [r.model, { rpm: r.rpm, tpm: r.tpm }]),
		);

		for (const [model, limits] of Object.entries(server)) {
			expect(docs[model], `docs missing ${model}`).toEqual(limits);
		}
	});

	it("pins llama-3.3-70b to 60 rpm / 120000 tpm (not the 3.2-3b row)", () => {
		const row = MODEL_RATE_OVERRIDES.find((r) => r.model === "llama-3.3-70b");
		expect(row).toEqual({ model: "llama-3.3-70b", rpm: 60, tpm: 120000 });
	});
});
