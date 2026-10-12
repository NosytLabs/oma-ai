import { afterEach, describe, expect, it } from "vitest";
import { resolveSiweDomain } from "../siwe-domain";

/**
 * Regression: wallet sign-in silently created no account.
 *
 * The SIWE `domain` field must be the host the browser is actually on.
 * It previously preferred process.env.NEXT_PUBLIC_APP_URL, which Next
 * inlines at BUILD time — so the shipped bundle said "oma-ai.com" while
 * users were on www.oma-ai.com. better-auth rejects the pair with
 * "SIWE message does not match the expected nonce, domain, address, or
 * chain ID", and the user only ever saw the wallet's own sound/prompt
 * with no login and no account.
 *
 * These tests pin the invariant: the domain comes from window.location.host
 * and is never taken from a build-time env var.
 *
 * The logic lives in `../siwe-domain` (not inline in the component) precisely
 * so it can be tested here without rendering the panel or mocking a wallet.
 */
describe("SIWE domain selection", () => {
	const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

	afterEach(() => {
		if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
		else process.env.NEXT_PUBLIC_APP_URL = originalEnv;
	});

	it("uses the live browser host, not the build-time NEXT_PUBLIC_APP_URL", () => {
		process.env.NEXT_PUBLIC_APP_URL = "https://oma-ai.com";
		// jsdom's host is not writable, so redefine it explicitly.
		Object.defineProperty(window, "location", {
			value: { ...window.location, host: "www.oma-ai.com" },
			writable: true,
			configurable: true,
		});

		const domain = resolveSiweDomain();

		// better-auth's SIWE verifier does not normalise "www." away, so the
		// client must collapse "www.oma-ai.com" and "oma-ai.com" to the
		// same canonical form before signing. Otherwise users on the apex
		// get rejected when the server is configured for www and vice versa.
		expect(domain).toBe("oma-ai.com");
	});

	it("prefers the live host on the apex domain too", () => {
		process.env.NEXT_PUBLIC_APP_URL = "https://www.oma-ai.com";
		Object.defineProperty(window, "location", {
			value: { ...window.location, host: "oma-ai.com" },
			writable: true,
			configurable: true,
		});

		expect(resolveSiweDomain()).toBe("oma-ai.com");
	});

	it("keeps the dev host so local sign-in matches the local server", () => {
		process.env.NEXT_PUBLIC_APP_URL = "https://oma-ai.com";
		Object.defineProperty(window, "location", {
			value: { ...window.location, host: "localhost:3000" },
			writable: true,
			configurable: true,
		});

		expect(resolveSiweDomain()).toBe("localhost:3000");
	});
});
