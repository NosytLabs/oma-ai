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
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});

describe("usePlaygroundState — model persistence", () => {
	it("starts from the static default when no URL or storage entry exists", () => {
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		expect(result.current.model).toBe("deepseek-v4-flash-0731-openbroker");
	});

	it("restores the saved model after a reload (localStorage read)", async () => {
		localStorage.setItem("oma_chat_model:guest", "mistral-small-2603");
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		// First render uses the URL/default; the post-mount rehydrate
		// effect then pulls the stored value.
		await act(async () => {});
		expect(result.current.model).toBe("mistral-small-2603");
	});

	it("?model=<id> wins over localStorage on initial mount (deep links)", async () => {
		localStorage.setItem("oma_chat_model:guest", "mistral-small-2603");
		searchParamsRef = new URLSearchParams("model=MiniMaxAI/MiniMax-M2.7");
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		expect(result.current.model).toBe("MiniMaxAI/MiniMax-M2.7");
		// Even after the rehydrate effect, the URL choice wins.
		await act(async () => {});
		expect(result.current.model).toBe("MiniMaxAI/MiniMax-M2.7");
	});

	it("an unknown ?model= falls back to localStorage (no clobber)", async () => {
		localStorage.setItem("oma_chat_model:guest", "mistral-small-2603");
		searchParamsRef = new URLSearchParams("model=does-not-exist");
		const { result } = renderHook(() => usePlaygroundState({ authReady: true }));
		await act(async () => {});
		expect(result.current.model).toBe("mistral-small-2603");
		// Critically: the unknown URL did NOT clobber the saved value.
		expect(localStorage.getItem("oma_chat_model:guest")).toBe(
			"mistral-small-2603",
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
			result.current.setModel("MiniMaxAI/MiniMax-M2.7");
		});
		await act(async () => {});
		expect(localStorage.getItem("oma_chat_model:guest")).toBe(
			"MiniMaxAI/MiniMax-M2.7",
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
			result.current.setModel("MiniMaxAI/MiniMax-M2.7");
		});
		await act(async () => {});
		expect(localStorage.getItem("oma_chat_model:u:user_abc")).toBe(
			"MiniMaxAI/MiniMax-M2.7",
		);
		expect(localStorage.getItem("oma_chat_model:guest")).toBeNull();
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
		expect(result.current.model).toBe("deepseek-v4-flash-0731-openbroker");
	});
});
