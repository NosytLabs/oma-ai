import { describe, expect, it, vi } from "vitest";

vi.mock("../../config.js", () => ({ config: { OPENBROKER_API_KEY: "live-test-key-123456789", VENICE_API_KEY: "live-test-key-123456789" } }));
vi.mock("../../lib/logger.js", () => ({ logger: { info: vi.fn() } }));

import { getModelById, providerAvailable } from "../models.js";
import { buildFallbackChain } from "../fallback.js";

describe("paused upstream models", () => {
	it("marks degraded Gonka DeepSeek unavailable while keeping healthy peers available", () => {
		expect(providerAvailable(getModelById("deepseek-v4-flash-0731-openbroker")!)).toBe(false);
		expect(providerAvailable(getModelById("minimax-m2-7")!)).toBe(true);
	});
	it("does not use a paused model as a paid or free fallback", () => {
		for (const freeOnly of [false, true]) {
			expect(buildFallbackChain("minimax-m2-7", [], freeOnly)).not.toContain("deepseek-v4-flash-0731-openbroker");
		}
	});
});
