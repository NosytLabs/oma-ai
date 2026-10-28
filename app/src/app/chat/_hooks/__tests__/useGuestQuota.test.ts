import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGuestQuota } from "../useGuestQuota";

describe("guest quota expiry", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-27T23:59:59Z"));
		localStorage.clear();
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({
			remaining: 0, limit: 20, used: 20, isAuthenticated: false,
		})));
	});

	afterEach(() => {
		cleanup();
		localStorage.clear();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("clears yesterday's quota from a chat tab left open overnight", async () => {
		const { result } = renderHook(() => useGuestQuota({ isAuthenticated: false }));
		await act(async () => {});
		expect(result.current.guestQuota?.remaining).toBe(0);
		expect(result.current.allowGuestSend()).toBe(false);

		act(() => vi.advanceTimersByTime(1000));

		expect(result.current.guestQuota).toBeNull();
		expect(result.current.allowGuestSend()).toBe(true);
	});

	it("allows a new-day request even before a suspended tab's expiry timer runs", async () => {
		const { result } = renderHook(() => useGuestQuota({ isAuthenticated: false }));
		await act(async () => {});
		expect(result.current.allowGuestSend()).toBe(false);

		vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));

		expect(result.current.allowGuestSend()).toBe(true);
	});
});
