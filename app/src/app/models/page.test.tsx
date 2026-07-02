import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/models",
}));

import ModelsPage from "./page";

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

describe("ModelsPage", () => {
	it("renders the models page heading", () => {
		render(<ModelsPage />);
		expect(
			screen.getByRole("heading", { name: /Models$/i }),
		).toBeInTheDocument();
	});

	it("renders category filter buttons", () => {
		render(<ModelsPage />);
		const buttons = screen.getAllByRole("button");
		const buttonTexts = buttons.map((b) => b.textContent);
		// Tier filter buttons: All Tiers, Budget, Mid-Range, Premium, Frontier
		expect(buttonTexts.some((t) => t === "All Tiers")).toBe(true);
		expect(buttonTexts.some((t) => t === "Budget")).toBe(true);
		expect(buttonTexts.some((t) => t === "Mid-Range")).toBe(true);
		expect(buttonTexts.some((t) => t === "Premium")).toBe(true);
		expect(buttonTexts.some((t) => t === "Frontier")).toBe(true);
	});

	it("renders the stats bar showing model count", async () => {
		render(<ModelsPage />);
		await waitFor(() => {
			expect(screen.getByText(/models available/i)).toBeInTheDocument();
		});
	});

	it("renders model cards when models are present", async () => {
		render(<ModelsPage />);
		await waitFor(() => {
			// Real Venice catalog labels Claude Opus with sub-versions
			// (4.5 / 4.6 / 4.7 / 4.8), not "Claude Opus 4" as a plain string.
			// Use a regex so the assertion stays valid across catalog refreshes.
			expect(screen.getAllByText(/Claude Opus/i).length).toBeGreaterThan(0);
		});
	});

	it("category filter click changes active filter", async () => {
		render(<ModelsPage />);
		await waitFor(() => {
			const budgetButton = screen.getByRole("button", { name: /budget/i });
			fireEvent.click(budgetButton);
		});
		await waitFor(() => {
			expect(screen.getAllByText(/Budget/i).length).toBeGreaterThan(0);
		});
	});

	it("search input filters models", async () => {
		render(<ModelsPage />);
		await waitFor(() => {
			const searchInput = screen.getByPlaceholderText(/search models/i);
			fireEvent.change(searchInput, { target: { value: "claude" } });
			expect(screen.getAllByText(/claude/i).length).toBeGreaterThan(0);
		});
	});

	it("search with no results shows reset message", async () => {
		render(<ModelsPage />);
		await waitFor(() => {
			const searchInput = screen.getByPlaceholderText(/search models/i);
			fireEvent.change(searchInput, { target: { value: "xyznonexistent123" } });
		});
		await waitFor(() => {
			expect(
				screen.getByText(/No models match your search/i),
			).toBeInTheDocument();
		});
	});

	it("renders model cards with pricing per token", async () => {
		render(<ModelsPage />);
		await waitFor(() => {
			// Model cards show "in" suffix next to input price per token
			expect(screen.getAllByText(/in$/i).length).toBeGreaterThan(0);
		});
	});

	it("models page does not crash on render", () => {
		expect(() => render(<ModelsPage />)).not.toThrow();
	});
});
