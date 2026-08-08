/**
 * Free-tier marketing/chat copy must only name real OMA-AI free models.
 * Drives FREE_CHAT_MODEL_IDS from model-utils and scans shipped source for
 * "(free)" example labels + known-bad Venice free claims.
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
	it("FREE_CHAT_MODEL_IDS contains all free models", () => {
		expect([...FREE_CHAT_MODEL_IDS].sort()).toEqual([
			"gemini-2.5-flash",
			"gemini-3-flash-preview",
			"gemini-3-pro-preview",
			"gemini-3.1-pro-preview",
			"gpt-4.1",
			"gpt-4o",
			"kimi-k3",
		].sort());
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
	});

	it("ExampleConversations only marks free on FREE_CHAT_MODEL_IDS", () => {
		const src = readApp("components/chat/ExampleConversations.tsx");
		// Pair each model: "…" with following modelName containing (free)
		const blocks = [
			...src.matchAll(
				/model:\s*"([^"]+)",\s*\n\s*modelName:\s*"([^"]+)"/g,
			),
		];
		expect(blocks.length).toBeGreaterThan(0);
		for (const m of blocks) {
			const id = m[1];
			const name = m[2];
			if (/\(free\)/i.test(name)) {
				expect(
					FREE_CHAT_MODEL_IDS.has(id),
					`${name} uses paid/non-free id ${id}`,
				).toBe(true);
			}
		}
	});

	it("WelcomeBanner tip names free OMA-AI models, not Venice", () => {
		const src = readApp("components/chat/WelcomeBannerRedesign.tsx");
		expect(src).toMatch(/Gemini 3 Flash/);
		expect(src).toMatch(/Kimi K3/);
		expect(src).not.toMatch(/DeepSeek V4 Flash.*free/i);
		expect(src).not.toMatch(/GLM 5\.1.*free/i);
	});

	it("pricing footer names real OMA-AI models", () => {
		const src = readApp("app/pricing/page.tsx");
		expect(src).toMatch(/OMA-AI models have no additional fee\./);
	});

	it("Mercury/Inception local logo is not the Zhipu tile", () => {
		const src = readApp("components/ui/model-logo.tsx");
		expect(src).toMatch(/inceptionai:\s*"\/logos\/providers\/mercury\.svg"/);
		expect(src).not.toMatch(
			/inceptionai:\s*"\/logos\/providers\/zai\.svg"/,
		);
	});
});
