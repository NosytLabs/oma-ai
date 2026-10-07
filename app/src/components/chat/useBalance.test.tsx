import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBalance } from "./useBalance";

const state = vi.hoisted(() => ({ authenticated: false, refetch: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ refetch: state.refetch, isSuccess: false }),
}));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: state.authenticated, isReady: true, isDemo: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ error: vi.fn() }) }));

describe("balance refresh after chat", () => {
	it("does not send an authenticated balance request for a guest", async () => {
		state.authenticated = false;
		state.refetch.mockClear();
		const { result } = renderHook(() => useBalance());
		await result.current.refresh();
		expect(state.refetch).not.toHaveBeenCalled();
	});
	it("refreshes a signed-in user's balance", async () => {
		state.authenticated = true;
		state.refetch.mockClear();
		const { result } = renderHook(() => useBalance());
		await result.current.refresh();
		expect(state.refetch).toHaveBeenCalledOnce();
	});
});
