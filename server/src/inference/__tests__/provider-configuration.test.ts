import { describe, expect, it, vi } from "vitest";

vi.mock("../../config.js", () => ({ config: {} }));
import { resolveProvider, ProviderError } from "../provider-route.js";

describe("customer-facing provider availability", () => {
	it.each(["oma-ai", "venice"])("keeps %s server configuration instructions out of customer failures", (provider) => {
		let failure: unknown;
		try { resolveProvider(provider); } catch (error) { failure = error; }
		expect(failure).toBeInstanceOf(ProviderError);
		expect((failure as ProviderError).status).toBe(503);
		expect((failure as Error).message).toMatch(/temporarily unavailable/);
		expect((failure as Error).message).not.toMatch(/API_KEY|server env|not configured|setup required/i);
	});
});
