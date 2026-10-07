/**
 * BUG-G regression tests: a saved / deep-linked model id can be in the
 * static catalog but absent from the live availability set (provider
 * retired it, or it's gated behind sign-in). The picker used to render an
 * empty selection and the next send went out with an unusable model.
 * usePlaygroundState now validates against the live set and falls back.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = { replace: vi.fn(), push: vi.fn() };
let searchParamsRef = new URLSearchParams();

vi.mock("next/navigation", () => ({
	useRouter: () => routerMock,
	usePathname: () => "/chat",
	useSearchParams: () => searchParamsRef,
}));

const { usePlaygroundState } = await import("../usePlaygroundState");
const { FREE_DEFAULT_CHAT_MODEL } = await import("@/lib/model-utils");

const AVAILABLE = ["zai-org-glm-5-3", "minimax-m2-7"];

beforeEach(() => {
	localStorage.clear();
	routerMock.replace.mockReset();
	searchParamsRef = new URLSearchParams();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("usePlaygroundState — live availability validation (BUG-G)", () => {
	it("keeps a selection that is in the available set", async () => {
		searchParamsRef = new URLSearchParams("model=minimax-m2-7");
		const { result } = renderHook(() =>
			usePlaygroundState({ authReady: true, availableModelIds: AVAILABLE }),
		);
		await act(async () => {});
		expect(result.current.model).toBe("minimax-m2-7");
	});

	it("falls back to the free default when the saved model is unavailable", async () => {
		// In the static catalog, but the live set no longer serves it.
		searchParamsRef = new URLSearchParams("model=claude-sonnet-4-6");
		const { result } = renderHook(() =>
			usePlaygroundState({ authReady: true, availableModelIds: AVAILABLE }),
		);
		await act(async () => {});
		expect(AVAILABLE).not.toContain("claude-sonnet-4-6");
		expect(result.current.model).toBe(FREE_DEFAULT_CHAT_MODEL);
	});

	it("falls back to the first available id when the free default is not served", async () => {
		searchParamsRef = new URLSearchParams("model=claude-sonnet-4-6");
		const { result } = renderHook(() =>
			usePlaygroundState({
				authReady: true,
				availableModelIds: ["minimax-m2-7"],
			}),
		);
		await act(async () => {});
		expect(result.current.model).toBe("minimax-m2-7");
	});

	it("does not touch the selection when no availability set is supplied", async () => {
		searchParamsRef = new URLSearchParams("model=claude-sonnet-4-6");
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {});
		expect(result.current.model).toBe("claude-sonnet-4-6");
	});
});
