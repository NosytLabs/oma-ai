import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * GA4 tag renders unconditionally when NEXT_PUBLIC_GA_ID is set.
 * No consent gate — fires on every pageview with anonymized IP.
 */
describe("GoogleAnalytics unconditional tag", () => {
	beforeEach(() => {
		document.head.innerHTML = "";
		delete (window as { dataLayer?: unknown }).dataLayer;
		delete (window as { gtag?: unknown }).gtag;
		vi.resetModules();
		vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST12345");
	});

	afterEach(() => {
		cleanup();
	});

	it("renders the gtag script when env is set", async () => {
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");

		render(<GoogleAnalytics />);
		expect(
			document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
		).not.toBeNull();
	});

	it("renders nothing when NEXT_PUBLIC_GA_ID is empty", async () => {
		vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");

		const { container } = render(<GoogleAnalytics />);
		expect(container.innerHTML).toBe("");
	});
});