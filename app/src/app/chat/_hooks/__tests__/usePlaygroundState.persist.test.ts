/**
 * Regression test for the model-selection persistence flow (bug fixed
 * 2026-09-01).
 *
 * Symptoms this locks in:
 *  1. Selecting a model and reloading must restore the same model — the
 *     saved choice lives in localStorage under a per-user key.
 *  2. `?model=<id>` in the URL must win on initial mount so deep links
 *     survive refresh.
 *  3. An unknown `?model=` value must NOT overwrite the stored choice
 *     (a stale or forged URL must fall back to the saved one).
 *  4. The initial mount must NOT write the URL/default value back to
 *     localStorage — React StrictMode double-invokes effects, and without
 *     a `userChangedModelRef` gate the persisted value gets clobbered
 *     before the user has interacted with the UI.
 *  5. URL `?model=` is mirrored after the *user* picks a model, not on
 *     cold load (no `?model=deepseek-v4-flash-0731-openbroker` clutter on /chat).
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_DEFAULT_CHAT_MODEL } from "@/lib/model-utils";

type RouterMock = { replace: ReturnType<typeof vi.fn>; push: ReturnType<typeof vi.fn> };
type SearchParams = URLSearchParams;

const routerMock: RouterMock = { replace: vi.fn(), push: vi.fn() };
let searchParamsRef: SearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
	useRouter: () => routerMock,
	usePathname: () => "/chat",
	useSearchParams: () => searchParamsRef,
}));

// Re-import the module under test *after* the mock is in place so the
// lazy initializer sees the mocked hooks.
const { usePlaygroundState } = await import("../usePlaygroundState");

beforeEach(() => {
	localStorage.clear();
	routerMock.replace.mockReset();
	routerMock.push.mockReset();
	searchParamsRef = new URLSearchParams();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("usePlaygroundState — atomic request settings", () => {
	it("applies a settings form in one persisted update", () => {
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		const write = vi.spyOn(Storage.prototype, "setItem");
		let applied = false;
		act(() => { applied = result.current.applyChatParams({ temperature: 1.2, topP: 0.8, maxTokens: 4096 }); });
		expect(applied).toBe(true);
		expect(result.current).toMatchObject({ temperature: 1.2, topP: 0.8, maxTokens: 4096 });
		expect(write).toHaveBeenCalledTimes(1);
		expect(JSON.parse(localStorage.getItem("oma_chat_params")!)).toMatchObject({ temperature: 1.2, topP: 0.8, maxTokens: 4096 });
	});

	it("reports a failed save without partially changing the request settings", () => {
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
		let applied = true;
		act(() => { applied = result.current.applyChatParams({ temperature: 1.2, topP: 0.8 }); });
		expect(applied).toBe(false);
		expect(result.current).toMatchObject({ temperature: 0.7, topP: 1 });
		expect(result.current.paramsError).toMatch(/couldn't save/i);
	});
});

describe("usePlaygroundState — model persistence", () => {
	it("starts from the static default when no URL or storage entry exists", () => {
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		expect(result.current.model).toBe(FREE_DEFAULT_CHAT_MODEL);
	});

	it("restores the saved model after a reload (localStorage read)", async () => {
		localStorage.setItem("oma_chat_model:guest", "minimax-m2-7");
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		// First render uses the URL/default; the post-mount rehydrate
		// effect then pulls the stored value.
		await act(async () => {});
		expect(result.current.model).toBe("minimax-m2-7");
	});

	it("?model=<id> wins over localStorage on initial mount (deep links)", async () => {
		localStorage.setItem("oma_chat_model:guest", "minimax-m2-7");
		searchParamsRef = new URLSearchParams("model=claude-sonnet-4-6");
		const { result } = renderHook(
			() => usePlaygroundState({ authReady: true }),
			{
				wrapper: ({ children }: { children: ReactNode }) =>
					createElement(StrictMode, null, children),
			},
		);
		expect(result.current.model).toBe("claude-sonnet-4-6");
		// Even after the rehydrate effect, the URL choice wins.
		await act(async () => {});
		expect(result.current.model).toBe("claude-sonnet-4-6");
	});

	it("an unknown ?model= falls back to localStorage (no clobber)", async () => {
		localStorage.setItem("oma_chat_model:guest", "minimax-m2-7");
		searchParamsRef = new URLSearchParams("model=does-not-exist");
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {});
		expect(result.current.model).toBe("minimax-m2-7");
		// Critically: the unknown URL did NOT clobber the saved value.
		expect(localStorage.getItem("oma_chat_model:guest")).toBe(
			"minimax-m2-7",
		);
	});

	it("does NOT mirror the URL on cold load (no ?model=<default> clutter)", async () => {
		renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {});
		expect(routerMock.replace).not.toHaveBeenCalled();
	});

	it("persists to localStorage when the user picks a new model", async () => {
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {
			result.current.setModel("claude-sonnet-4-6");
		});
		await act(async () => {});
		expect(localStorage.getItem("oma_chat_model:guest")).toBe(
			"claude-sonnet-4-6",
		);
	});

	it("mirrors the URL when the user picks a model", async () => {
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {
			result.current.setModel("claude-sonnet-4-6");
		});
		await act(async () => {});
		expect(routerMock.replace).toHaveBeenCalled();
		const callArg = routerMock.replace.mock.calls.at(-1)?.[0] as string;
		expect(callArg).toContain("model=claude-sonnet-4-6");
	});

	it("scopes the storage key to the authenticated user id", async () => {
		const userId = "user_abc";
		const { result } = renderHook(() =>
			usePlaygroundState({ authReady: true, userId }),
		);
		await act(async () => {
			result.current.setModel("claude-sonnet-4-6");
		});
		await act(async () => {});
		expect(localStorage.getItem("oma_chat_model:u:user_abc")).toBe(
			"claude-sonnet-4-6",
		);
		expect(localStorage.getItem("oma_chat_model:guest")).toBeNull();
	});

	it("rehydrates the model when the mounted account identity changes", async () => {
		localStorage.setItem("oma_chat_model:u:alice", "minimax-m2-7");
		localStorage.setItem("oma_chat_model:u:bob", "claude-sonnet-4-6");
		const { result, rerender } = renderHook(
			({ userId }) => usePlaygroundState({ authReady: true, userId }),
			{ initialProps: { userId: "alice" } },
		);
		await waitFor(() => expect(result.current.model).toBe("minimax-m2-7"));

		rerender({ userId: "bob" });
		await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-6"));
		expect(result.current.modelHydrated).toBe(true);

		act(() => result.current.setModel("deepseek-v4-flash-0731-openbroker"));
		await waitFor(() => {
			expect(localStorage.getItem("oma_chat_model:u:bob")).toBe(
				"deepseek-v4-flash-0731-openbroker",
			);
		});
		expect(localStorage.getItem("oma_chat_model:u:alice")).toBe(
			"minimax-m2-7",
		);
	});

	it("does not carry the previous account's model into an empty account", async () => {
		localStorage.setItem("oma_chat_model:u:alice", "claude-sonnet-4-6");
		const { result, rerender } = renderHook(
			({ userId }) => usePlaygroundState({ authReady: true, userId }),
			{ initialProps: { userId: "alice" as string | null } },
		);
		await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-6"));

		rerender({ userId: "bob" });
		await waitFor(() => expect(result.current.model).toBe(FREE_DEFAULT_CHAT_MODEL));
		expect(localStorage.getItem("oma_chat_model:u:bob")).toBeNull();
	});

	it("does not write to localStorage before the user picks a model (StrictMode-safe)", async () => {
		// Pre-seed a saved choice. A cold mount must NOT overwrite it
		// with the URL/default — even when React StrictMode invokes the
		// persist effect twice.
		localStorage.setItem("oma_chat_model:guest", "claude-sonnet-4-6");
		renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {});
		expect(localStorage.getItem("oma_chat_model:guest")).toBe("claude-sonnet-4-6");
	});

	it("ignores stored values that aren't in the current catalog (stale saves)", async () => {
		localStorage.setItem("oma_chat_model:guest", "model-deleted-last-week");
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {});
		// Falls back to the static default rather than boot a 404 model.
		expect(result.current.model).toBe(FREE_DEFAULT_CHAT_MODEL);
	});
});
