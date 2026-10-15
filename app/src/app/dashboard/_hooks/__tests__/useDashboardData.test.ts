import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, BackendUnavailableError, type UsageSummary } from "@/lib/api";
import { useBalance } from "@/components/chat/useBalance";
import { useDashboardData } from "../useDashboardData";

vi.mock("@/lib/api", () => ({
	api: {
		auth: { listKeys: vi.fn() },
		usage: { get: vi.fn(), summary: vi.fn() },
		models: { list: vi.fn() },
		creditHistory: { list: vi.fn() },
	},
	BackendUnavailableError: class extends Error {},
}));
vi.mock("@/components/chat/useBalance", () => ({ useBalance: vi.fn() }));

const summary: UsageSummary = {
	range: "7d", timezone: "UTC", bucket: "day", from: "2026-10-03T00:00:00Z", to: "2026-10-10T00:00:00Z",
	lifetimeRequests: 3000, totals: { requests: 2500, errors: 0, aborted: 0, free_requests: 0,
		active_models: 1, input_tokens: 2500, output_tokens: 2500, billed_cents: "0.05", avg_latency_ms: 100 },
	last24h: { requests: 2500, errors: 0, aborted: 0, free_requests: 0,
		active_models: 1, input_tokens: 2500, output_tokens: 2500, billed_cents: "0.05", avg_latency_ms: 100 },
	models: [], providers: [], timeline: [],
};
function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
	return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
}
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(useBalance).mockReturnValue({ balance: null, loading: false, refresh: async () => {} });
	vi.mocked(api.auth.listKeys).mockResolvedValue({ keys: [] });
	vi.mocked(api.usage.summary).mockResolvedValue(summary);
	vi.mocked(api.usage.get).mockResolvedValue({ records: [], count: 0, nextCursor: null, totalCount: 2500 });
	vi.mocked(api.models.list).mockResolvedValue({ object: "list", data: [] });
	vi.mocked(api.creditHistory.list).mockResolvedValue({ transactions: [] });
});
describe("useDashboardData", () => {
	it("keeps settings usable without loading analytics and starts analytics when returning to usage", async () => {
		const { result, rerender } = renderHook(({ analyticsEnabled }) => useDashboardData({ isAuthenticated: true, userId: "a", analyticsEnabled }),
			{ wrapper: wrapper(), initialProps: { analyticsEnabled: false } });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(api.auth.listKeys).toHaveBeenCalled();
		for (const query of [api.usage.summary, api.usage.get, api.models.list, api.creditHistory.list]) expect(query).not.toHaveBeenCalled();
		rerender({ analyticsEnabled: true });
		await waitFor(() => expect(result.current.summary?.totals.requests).toBe(2500));
	});
	it("does not fetch private data without an authenticated identity", () => {
		const { result } = renderHook(() => useDashboardData({ isAuthenticated: false }), { wrapper: wrapper() });
		expect(result.current.usage).toEqual([]);
		expect(result.current.summary).toBeNull();
		expect(result.current.loading).toBe(false);
		expect(api.usage.summary).not.toHaveBeenCalled();
		expect(useBalance).toHaveBeenCalledWith({ enabled: false });
	});
	it("gets full-range statistics separately from on-demand request pages", async () => {
		vi.mocked(api.usage.get).mockResolvedValueOnce({ records: [], count: 0, nextCursor: "next", totalCount: 2500 });
		const { result } = renderHook(() => useDashboardData({ isAuthenticated: true, userId: "user-a" }), { wrapper: wrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.summary?.totals.requests).toBe(2500);
		expect(result.current.hasMoreUsage).toBe(true);
		expect(api.usage.get).toHaveBeenCalledTimes(1);
		await act(async () => { await result.current.loadMoreUsage(); });
		expect(api.usage.get).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "next", limit: 100 }));
	});
	it("cannot show another account's cached keys after switching identity or signing out", async () => {
		vi.mocked(api.auth.listKeys).mockResolvedValueOnce({ keys: [{ id: "a", name: "A", prefix: "oma_sk_a", createdAt: "", lastUsedAt: null }] });
		const { result, rerender } = renderHook(({ userId, isAuthenticated }) =>
			useDashboardData({ isAuthenticated, userId }), { wrapper: wrapper(), initialProps: { userId: "a", isAuthenticated: true } });
		await waitFor(() => expect(result.current.apiKeys).toHaveLength(1));
		rerender({ userId: "b", isAuthenticated: true });
		expect(result.current.apiKeys).toEqual([]);
		await waitFor(() => expect(api.auth.listKeys).toHaveBeenCalledTimes(2));
		rerender({ userId: "b", isAuthenticated: false });
		expect(result.current.apiKeys).toEqual([]);
		expect(result.current.summary).toBeNull();
	});
	it("surfaces a failed balance instead of claiming that the account has zero credits", async () => {
		vi.mocked(useBalance).mockReturnValue({ balance: null, loading: false, refresh: async () => {}, error: new BackendUnavailableError() });
		const { result } = renderHook(() => useDashboardData({ isAuthenticated: true, userId: "a" }), { wrapper: wrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.backendUnavailable).toBe(true);
		expect(result.current.error).toBeInstanceOf(BackendUnavailableError);
	});
	it("refreshes the actual statistics and balance sources", async () => {
		const { result } = renderHook(() => useDashboardData({ isAuthenticated: true, userId: "a" }), { wrapper: wrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));
		vi.mocked(api.usage.summary).mockClear();
		await act(async () => { await result.current.refresh(); });
		expect(api.usage.summary).toHaveBeenCalled();
	});
	it("shares concurrent keyboard, button and polling refreshes instead of restarting requests", async () => {
		const { result } = renderHook(() => useDashboardData({ isAuthenticated: true, userId: "a" }), { wrapper: wrapper() });
		await waitFor(() => expect(result.current.loading).toBe(false));
		const completions: Array<(value: UsageSummary) => void> = [];
		vi.mocked(api.usage.summary).mockClear().mockImplementation(() => new Promise(resolve => { completions.push(resolve); }));
		let first!: Promise<void>;
		let second!: Promise<void>;
		act(() => { first = result.current.refresh(); second = result.current.refresh(); });
		const calls = vi.mocked(api.usage.summary).mock.calls.length;
		await act(async () => { completions.forEach(finish => finish(summary)); await Promise.all([first, second]); });
		expect(calls).toBe(1);
	});
	it("does not invalidate another account's private cached data during a refresh", async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		client.setQueryData(["apiKeys", "other-account"], { keys: [] });
		const { result } = renderHook(() => useDashboardData({ isAuthenticated: true, userId: "a" }), { wrapper: wrapper(client) });
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => { await result.current.refresh(); });
		expect(client.getQueryState(["apiKeys", "other-account"])?.isInvalidated).toBe(false);
		client.clear();
	});
});
