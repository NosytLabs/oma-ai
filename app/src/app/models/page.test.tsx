import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ModelsPage from "./page";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/models",
}));

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
	it("renders the models page heading", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: /every model/i }),
				).toBeInTheDocument();
			});
		});
	});

	it("renders category filter buttons", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				const buttons = screen.getAllByRole("button");
				const buttonTexts = buttons.map((b) => b.textContent);
				expect(buttonTexts.some((t) => t === "All Tiers")).toBe(true);
				expect(buttonTexts.some((t) => t === "Budget")).toBe(true);
				expect(buttonTexts.some((t) => t === "Mid-Range")).toBe(true);
				expect(buttonTexts.some((t) => t === "Premium")).toBe(true);
				expect(buttonTexts.some((t) => t === "Frontier")).toBe(true);
			});
		});
	});

	it("renders the stats bar showing model count", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				// Wording must NOT claim every catalogued model is usable —
				// 18 of 20 are marked UNAVAILABLE when Venice is unconfigured.
				expect(screen.getByText(/models in the catalog/i)).toBeInTheDocument();
			});
		});
	});

	it("renders model cards when models are present", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				// Catalog now names the upstream truthfully: DeepSeek V4 Flash
				// on OMA-AI / Gonka.AI. Use a regex so the assertion stays
				// valid across catalog refreshes.
				expect(screen.getAllByText(/DeepSeek V4 Flash/i).length).toBeGreaterThan(0);
			});
		});
	});

	it("category filter click changes active filter", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				const budgetButton = screen.getByRole("button", { name: /budget/i });
				fireEvent.click(budgetButton);
			});
		});
		await act(async () => {
			await waitFor(() => {
				expect(screen.getAllByText(/Budget/i).length).toBeGreaterThan(0);
			});
		});
	});

	it("search input filters models", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				const searchInput = screen.getByPlaceholderText(/search models/i);
				fireEvent.change(searchInput, { target: { value: "gemini" } });
			});
		});
		await act(async () => {
			await waitFor(() => {
				expect(screen.getAllByText(/gemini/i).length).toBeGreaterThan(0);
			});
		});
	});

	it("search with no results shows reset message", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				const searchInput = screen.getByPlaceholderText(/search models/i);
				fireEvent.change(searchInput, { target: { value: "xyznonexistent123" } });
			});
		});
		await act(async () => {
			await waitFor(() => {
				expect(
					screen.getByText(/No models match your search/i),
				).toBeInTheDocument();
			});
		});
	});

	it("renders model cards with pricing per token", async () => {
		render(<ModelsPage />);
		await act(async () => {
			await waitFor(() => {
				// Model cards show "per 1M" text next to input price per token
				expect(screen.getAllByText(/per 1M/i).length).toBeGreaterThan(0);
			});
		});
	});

	it("models page does not crash on render", () => {
		expect(() => render(<ModelsPage />)).not.toThrow();
	});
});