import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guestQuotaLabel, useGuestQuota } from "../useGuestQuota";

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

describe("guest quota state", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
		localStorage.clear();
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({
			remaining: 7, limit: 20, used: 13, isAuthenticated: false,
		})));
	});

	afterEach(() => {
		cleanup();
		localStorage.clear();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("starts as hydrating for a guest, before the quota is known", () => {
		const { result } = renderHook(() => useGuestQuota({ isAuthenticated: false }));
		expect(result.current.quotaState.kind).toBe("hydrating");
		expect(result.current.guestQuota).toBeNull();
	});

	it("becomes ready with the server quota once it loads", async () => {
		const { result } = renderHook(() => useGuestQuota({ isAuthenticated: false }));
		await act(async () => {});
		expect(result.current.quotaState.kind).toBe("ready");
		expect(result.current.guestQuota?.remaining).toBe(7);
	});

	it("is not applicable for a signed-in visitor", async () => {
		const { result } = renderHook(() => useGuestQuota({ isAuthenticated: true }));
		await act(async () => {});
		expect(result.current.quotaState.kind).toBe("not-applicable");
		expect(result.current.guestQuota).toBeNull();
		expect(result.current.allowGuestSend()).toBe(true);
	});

	it("records expiry as its own state rather than as 'unknown'", async () => {
		vi.setSystemTime(new Date("2026-10-27T23:59:59Z"));
		const { result } = renderHook(() => useGuestQuota({ isAuthenticated: false }));
		await act(async () => {});
		expect(result.current.quotaState.kind).toBe("ready");

		act(() => vi.advanceTimersByTime(1000));

		expect(result.current.quotaState.kind).toBe("expired");
		expect(result.current.guestQuota).toBeNull();
	});

	it("labels each state distinctly", () => {
		expect(guestQuotaLabel({ kind: "hydrating" })).toBe("Free daily allowance");
		expect(guestQuotaLabel({ kind: "not-applicable" })).toBe("Free daily allowance");
		expect(guestQuotaLabel({ kind: "expired" })).toBe("Free allowance resets at midnight");
		expect(
			guestQuotaLabel({
				kind: "ready",
				quota: { remaining: 7, limit: 20, date: "2026-10-27" } as never,
			}),
		).toBe("7 free left");
	});
});
