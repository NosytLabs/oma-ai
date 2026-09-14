/**
 * Free-tier marketing/chat copy must only name real OMA-AI free models.
	*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FREE_CHAT_MODEL_IDS, FREE_DEFAULT_CHAT_MODEL } from "@/lib/model-utils";

const appRoot = resolve(process.cwd(), "src");

function readApp(rel: string): string {
	return readFileSync(resolve(appRoot, rel), "utf8");
}

describe("free-tier copy accuracy", () => {
	it("FREE_CHAT_MODEL_IDS contains all OMA-AI / Gonka.AI models", () => {
		expect([...FREE_CHAT_MODEL_IDS].sort()).toEqual(
			[
				"deepseek-v4-flash-0731-openbroker",
				"minimax-m2-7",
			].sort(),
		);
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
	});

	it("pricing page states honest OMA-AI margin", () => {
		const src = readApp("app/pricing/page.tsx");
		expect(src).toMatch(/OMA-AI models are priced at 2x Gonka wholesale\./);
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
