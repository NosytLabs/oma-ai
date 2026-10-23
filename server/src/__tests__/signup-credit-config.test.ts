import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("signup credit configuration", () => {
	async function signupCents(value: string | undefined) {
		vi.stubEnv("FREE_SIGNUP_CENTS", value);
		vi.resetModules();
		return (await import("../config.js")).config.FREE_SIGNUP_CENTS;
	}

	it("does not mint promotional credits when the offer is unconfigured", async () => {
		expect(await signupCents(undefined)).toBe(0);
	});

	it("keeps an explicit zero disabled", async () => {
		expect(await signupCents("0")).toBe(0);
	});

	it("supports an explicitly configured 100-cent promotional offer", async () => {
		expect(await signupCents("100")).toBe(100);
	});
});
