import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * The GA4 tag must not fire before the visitor opts in. These tests pin the
 * privacy behaviour: no gtag request and no dataLayer config on first paint,
 * and a working tag only after an explicit accept.
 *
 * The component is a client component that reads localStorage in an effect, so
 * tests exercise it through the real DOM rather than shallow rendering.
 */
describe("GoogleAnalytics consent gate", () => {
	beforeEach(() => {
		localStorage.clear();
		document.head.innerHTML = "";
		delete (window as { dataLayer?: unknown }).dataLayer;
		delete (window as { gtag?: unknown }).gtag;
		vi.resetModules();
		vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST12345");
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("reserves the banner height for viewport-bound chat and releases it on decline", async () => {
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 96 } as DOMRect);
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render, fireEvent } = await import("@testing-library/react");
		const { getByRole } = render(<GoogleAnalytics />);
		expect(document.documentElement.style.getPropertyValue("--analytics-consent-height")).toBe("96px");
		fireEvent.click(getByRole("button", { name: /decline/i }));
		expect(document.documentElement.style.getPropertyValue("--analytics-consent-height")).toBe("");
	});

	it("prompts without firing any gtag request before a decision", async () => {
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");

		render(<GoogleAnalytics />);
		// The banner IS rendered (that is the prompt), but nothing may reach
		// Google yet. This is the assertion that matters for privacy.
		expect(
			document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
		).toBeNull();
		expect(document.querySelector('[role="region"]')).not.toBeNull();
	});

	it("shows the consent prompt when no decision is stored", async () => {
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");

		const { getByRole } = render(<GoogleAnalytics />);
		expect(getByRole("button", { name: /accept/i })).toBeTruthy();
		expect(getByRole("button", { name: /decline/i })).toBeTruthy();
	});

	it("does not load gtag.js until analytics are accepted", async () => {
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");
		const { fireEvent } = await import("@testing-library/react");

		const { getByRole } = render(<GoogleAnalytics />);
		expect(
			document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
		).toBeNull();

		fireEvent.click(getByRole("button", { name: /accept/i }));
		expect(
			document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
		).not.toBeNull();
	});

	it("stays off forever when the visitor declines", async () => {
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render, fireEvent } = await import("@testing-library/react");

		const { container, getByRole } = render(<GoogleAnalytics />);
		fireEvent.click(getByRole("button", { name: /decline/i }));

		expect(localStorage.getItem("oma_analytics_consent")).toBe("declined");
		// Declining dismisses the banner and renders no tag. next/script writes
		// into document.head which cleanup() does not clear, so assert on what
		// the component renders.
		expect(container.innerHTML).toBe("");
		expect(document.querySelector('[role="region"]')).toBeNull();
	});

	it("does not re-prompt after a previous decision", async () => {
		localStorage.setItem("oma_analytics_consent", "declined");
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");

		const { queryByRole } = render(<GoogleAnalytics />);
		expect(queryByRole("button", { name: /accept/i })).toBeNull();
	});

	it("renders nothing at all when NEXT_PUBLIC_GA_ID is unset", async () => {
		vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");

		const { container } = render(<GoogleAnalytics />);
		expect(container.innerHTML).toBe("");
	});
});
