import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODELS } from "@/lib/models-data";
import { useModelFilters } from "./useModelFilters";

const { loadModels } = vi.hoisted(() => ({ loadModels: vi.fn() }));
vi.mock("@/lib/models-data", async (importOriginal) => ({
	...await importOriginal<typeof import("@/lib/models-data")>(),
	loadModels,
}));
vi.mock("@/components/shared/useUrlFilters", () => ({
	useUrlFilters: () => ({ tier: null, provider: null, search: "", sort: null, setParam: vi.fn(), copyFilterUrl: vi.fn() }),
}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("catalog availability state", () => {
	it("keeps the live count unknown while showing the fallback catalog during loading", () => {
		loadModels.mockReturnValue(new Promise(() => {}));
		const { result } = renderHook(useModelFilters);
		expect(result.current.totalModels).toBe(MODELS.length);
		expect(result.current.availableCount).toBeNull();
		expect(result.current.isLoadingModels).toBe(true);
	});

	it("does not label fallback entries as live after a failed catalog fetch", async () => {
		loadModels.mockResolvedValue(MODELS);
		const { result } = renderHook(useModelFilters);
		await waitFor(() => expect(result.current.isLoadingModels).toBe(false));
		expect(result.current.totalModels).toBe(MODELS.length);
		expect(result.current.availableCount).toBeNull();
	});

	it("reports a known zero when the live catalog has no available models", async () => {
		loadModels.mockResolvedValue(MODELS.slice(0, 2).map((model) => ({ ...model, available: false })));
		const { result } = renderHook(useModelFilters);
		await waitFor(() => expect(result.current.availableCount).toBe(0));
	});

	it("counts live entries without the explicitly unavailable routes", async () => {
		loadModels.mockResolvedValue(MODELS.slice(0, 2).map((model, i) => ({ ...model, available: i === 0 })));
		const { result } = renderHook(useModelFilters);
		await waitFor(() => expect(result.current.availableCount).toBe(1));
	});
});
