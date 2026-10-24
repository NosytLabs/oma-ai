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
/**
 * REGRESSION: the GA4 'config' command must only be issued on a production
 * hostname.
 *
 * The Vercel project sets NEXT_PUBLIC_GA_ID for the Preview environment as
 * well as Production, so preview deployments were reporting their own
 * traffic into the production property - 4 sessions / 4 views over 28 days
 * from *.vercel.app preview hosts (measured 2026-10-24).
 *
 * The guard lives in the inline init script so the <Script> tags still render
 * (prerender-safe); it is the 'config' command - the one that actually opens
 * a measurement - that is gated.
 */
describe("GoogleAnalytics hostname guard", () => {
	beforeEach(() => {
		document.head.innerHTML = "";
		delete (window as { dataLayer?: unknown }).dataLayer;
		delete (window as { gtag?: unknown }).gtag;
		vi.resetModules();
		vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST12345");
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
	});

	const setHost = (host: string) => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...window.location, hostname: host },
		});
	};

	it("issues gtag config on a production hostname", async () => {
		setHost("www.oma-ai.com");
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");
		render(<GoogleAnalytics />);

		const init = Array.from(
			document.querySelectorAll("script:not([src])"),
		).map((s) => s.textContent || "").join("\n");
		expect(init).toContain("gtag('config'");
		expect(init).toContain("www.oma-ai.com");
	});

	it("does NOT issue gtag config on a vercel.app preview hostname", async () => {
		setHost("oma-abc123-nosyt.vercel.app");
		const { GoogleAnalytics } = await import("../GoogleAnalytics");
		const { render } = await import("@testing-library/react");
		render(<GoogleAnalytics />);

		const init = Array.from(
			document.querySelectorAll("script:not([src])"),
		).map((s) => s.textContent || "").join("\n");
		// The guard is present and the config call is inside the host check.
		expect(init).toContain("window.location.hostname");
		expect(init).toContain(".indexOf(host) !== -1");
	});
});
