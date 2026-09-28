import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModelFilters } from "./useModelFilters";

const route = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({
	usePathname: () => "/models",
	useSearchParams: () => new URLSearchParams(route.query),
}));
vi.mock("@/lib/models-data", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/models-data")>();
	return { ...actual, loadModels: vi.fn().mockResolvedValue(actual.MODELS) };
});

beforeEach(() => {
	route.query = "q=claude&tier=budget&provider=Venice&sort=price-out&cap=reasoning&ctx=1000,1000000&price=0,10&source=shared";
	window.history.replaceState(null, "", `/models?${route.query}`);
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("catalog filter URLs", () => {
	it("clears all filters atomically while retaining sort and unrelated query parameters", async () => {
		const first = renderHook(useModelFilters);
		await waitFor(() => expect(first.result.current.isLoadingModels).toBe(false));
		expect(first.result.current.filtered).toHaveLength(0);
		act(() => first.result.current.resetFilters());
		expect(window.location.search).toBe("?sort=price-out&source=shared");
		expect(first.result.current.hasFilters).toBe(false);
		first.unmount();
		route.query = window.location.search.slice(1);
		const reloaded = renderHook(useModelFilters);
		expect(reloaded.result.current.localSearch).toBe("");
		expect(reloaded.result.current.selectedTier).toBeNull();
		expect(reloaded.result.current.capabilities).toEqual([]);
		expect(reloaded.result.current.sortBy).toBe("price-out");
		await waitFor(() => expect(reloaded.result.current.isLoadingModels).toBe(false));
	});

	it("keeps successive edits and advanced filters in a reloadable URL", async () => {
		route.query = "";
		window.history.replaceState(null, "", "/models");
		const first = renderHook(useModelFilters);
		await waitFor(() => expect(first.result.current.isLoadingModels).toBe(false));
		act(() => {
			first.result.current.handleSearch("claude");
			first.result.current.handleProvider("Venice");
			first.result.current.setCapabilities(["reasoning", "agents"]);
			first.result.current.setContextRange([128000, 1000000]);
			first.result.current.setPriceRange([1, 10]);
		});
		const params = new URLSearchParams(window.location.search);
		expect(params.get("q")).toBe("claude");
		expect(params.get("provider")).toBe("Venice");
		expect(params.get("cap")).toBe("reasoning,agents");
		first.unmount();
		route.query = params.toString();
		const reloaded = renderHook(useModelFilters);
		expect(reloaded.result.current.capabilities).toEqual(["reasoning", "agents"]);
		expect(reloaded.result.current.contextRange).toEqual([128000, 1000000]);
		expect(reloaded.result.current.priceRange).toEqual([1, 10]);
		await waitFor(() => expect(reloaded.result.current.isLoadingModels).toBe(false));
	});

	it("restores controls when URL navigation changes and ignores malformed ranges", async () => {
		const { result, rerender } = renderHook(useModelFilters);
		await waitFor(() => expect(result.current.isLoadingModels).toBe(false));
		route.query = "q=gemini&sort=invalid&ctx=NaN,10&price=-2,5000";
		rerender();
		expect(result.current.localSearch).toBe("gemini");
		expect(result.current.selectedTier).toBeNull();
		expect(result.current.sortBy).toBe("name");
		expect(result.current.contextRange).toEqual([0, 2000000]);
		expect(result.current.priceRange).toEqual([0, 1000]);
	});
});
