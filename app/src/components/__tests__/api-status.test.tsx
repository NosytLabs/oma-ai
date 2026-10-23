import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApiHealth } from "../api-status";
import { nextHealthPollMs, recordHealthCheckResult } from "@/lib/health-backoff";

let client: QueryClient;
beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	recordHealthCheckResult(true);
});
afterEach(() => {
	cleanup();
	client.clear();
	vi.unstubAllGlobals();
	recordHealthCheckResult(true);
});
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe("account readiness polling", () => {
	it("backs off real failed checks and resets the interval after recovery", async () => {
		let ready = false;
		vi.stubGlobal("fetch", vi.fn(async () => Response.json(
			{ status: ready ? "ready" : "not_ready" }, { status: ready ? 200 : 503 },
		)));
		const { result } = renderHook(() => useApiHealth(), { wrapper });
		await waitFor(() => expect(result.current.status).toBe("offline"));
		expect(nextHealthPollMs()).toBe(5_000);
		for (const interval of [10_000, 20_000, 40_000, 60_000, 60_000]) {
			await act(async () => { await client.refetchQueries(); });
			expect(nextHealthPollMs()).toBe(interval);
		}
		ready = true;
		await act(async () => { await client.refetchQueries(); });
		await waitFor(() => expect(result.current.status).toBe("online"));
		expect(nextHealthPollMs()).toBe(30_000);
	});

	it("counts transport failures toward the same outage backoff", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
		const { result } = renderHook(() => useApiHealth(), { wrapper });
		await waitFor(() => expect(result.current.status).toBe("offline"));
		expect(nextHealthPollMs()).toBe(5_000);
	});
});
