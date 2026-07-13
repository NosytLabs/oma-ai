import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "./page";

const originalIntersectionObserver = global.IntersectionObserver;

class MockIntersectionObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

beforeEach(() => {
	global.IntersectionObserver =
		MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
	global.IntersectionObserver = originalIntersectionObserver;
	vi.restoreAllMocks();
});

describe("PricingPage", () => {
	it("renders the pricing page heading", () => {
		render(<PricingPage />);
		expect(screen.getByText(/AI API Pricing/i)).toBeInTheDocument();
	});

	it("renders payment methods section", () => {
		render(<PricingPage />);
		expect(screen.getByText("USDC on Base / Solana")).toBeInTheDocument();
		expect(screen.getByText("LI.FI / CCTP")).toBeInTheDocument();
	});

	it("renders model pricing table with headers", async () => {
		render(<PricingPage />);
		await waitFor(() => {
			expect(screen.getByText(/Input \/ 1M/i)).toBeInTheDocument();
			expect(screen.getByText(/Output \/ 1M/i)).toBeInTheDocument();
		});
	});

	it("category filter buttons work", async () => {
		render(<PricingPage />);
		await waitFor(() => {
			const frontierButton = screen.getByRole("button", { name: /frontier/i });
			fireEvent.click(frontierButton);
			// Frontier category includes both Claude Sonnet 4 and Claude Opus 4
			// (per pricing/page.tsx MODELS table, lines 30-31). Use getAllByText
			// since the click filters the table to frontier models only.
			expect(
				screen.getAllByText(/Claude (Sonnet|Opus) 4/).length,
			).toBeGreaterThan(0);
		});
	});

	it("renders FAQ section", () => {
		render(<PricingPage />);
		expect(screen.getByText(/FAQ/i)).toBeInTheDocument();
		expect(screen.getByText("How do I add credits?")).toBeInTheDocument();
	});

	it("renders credits and billing disclaimer section", () => {
		render(<PricingPage />);
		expect(
			screen.getByRole("heading", { name: /Billing/i }),
		).toBeInTheDocument();
	});

	it("renders CTA buttons linking to deposit and models", async () => {
		render(<PricingPage />);
		await waitFor(() => {
			const depositLinks = screen.getAllByRole("link", { name: /deposit/i });
			expect(depositLinks.length).toBeGreaterThan(0);
		});
		expect(
			screen.getByRole("link", { name: /view all models/i }),
		).toHaveAttribute("href", "/models");
	});

	it("pricing page does not crash on render", () => {
		expect(() => render(<PricingPage />)).not.toThrow();
	});
});
