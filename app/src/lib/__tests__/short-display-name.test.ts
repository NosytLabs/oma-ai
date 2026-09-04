import { describe, expect, it } from "vitest";
import { displayName, shortDisplayName } from "@/lib/model-utils";

describe("shortDisplayName", () => {
	it("strips the trailing provider disambiguator", () => {
		expect(
			shortDisplayName("deepseek-v4-flash-0731-openbroker", "DeepSeek V4 Flash (OMA-AI)"),
		).toBe("DeepSeek V4 Flash");
		expect(
			shortDisplayName("deepseek-v4-flash-0731", "DeepSeek V4 Flash (Venice)"),
		).toBe("DeepSeek V4 Flash");
	});

	it("leaves names without a suffix untouched", () => {
		expect(shortDisplayName("llama-3.3-70b", "Llama 3.3 70B")).toBe(
			"Llama 3.3 70B",
		);
	});

	it("falls back to the full display name pipeline", () => {
		const full = displayName("kimi-k2-6");
		expect(shortDisplayName("kimi-k2-6")).toBe(
			full.replace(/\s*\([^()]*\)\s*$/, ""),
		);
	});
});
