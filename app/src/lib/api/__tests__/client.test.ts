import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	request,
	ApiError,
	BackendUnavailableError,
	isAuthError,
	isSuspendedAccountError,
	isPaymentRequiredError,
	isQuotaError,
	getCached,
	setCache,
	STALE_TTL,
} from "../client";

// Mock the global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("api client", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("request() core logic", () => {
		it("composes caller cancellation with the request timeout", async () => {
			const caller = new AbortController();
			let completeFetch!: (response: Response) => void;
			fetchMock.mockImplementationOnce(
				(_url: string, init: RequestInit) =>
					new Promise<Response>((resolve, reject) => {
						completeFetch = resolve;
						init.signal?.addEventListener(
							"abort",
							() => reject(init.signal?.reason),
							{ once: true },
						);
					}),
			);

			const pending = request("/test", { signal: caller.signal });
			const observed = pending.then(
				() => null,
				(error: unknown) => error,
			);
			caller.abort();
			const result = await Promise.race([
				observed,
				new Promise<"still-pending">((resolve) =>
					setTimeout(() => resolve("still-pending"), 20),
				),
			]);
			if (result === "still-pending") {
				completeFetch(
					new Response(JSON.stringify({ late: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
				);
				await pending;
			}

			expect(result).toMatchObject({ name: "AbortError" });
		});

		it("retains the timeout when a caller signal is supplied", async () => {
			vi.useFakeTimers();
			const caller = new AbortController();
			fetchMock.mockImplementationOnce(
				(_url: string, init: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						init.signal?.addEventListener(
							"abort",
							() => reject(init.signal?.reason),
							{ once: true },
						);
					}),
			);

			const pending = request("/test", { signal: caller.signal });
			const rejection = expect(pending).rejects.toMatchObject({
				name: "AbortError",
			});
			await vi.advanceTimersByTimeAsync(30_000);
			await rejection;
		});

		it("returns JSON on success", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ hello: "world" }),
			});

			const result = await request("/test");
			expect(result).toEqual({ hello: "world" });
			expect(fetchMock).toHaveBeenCalledTimes(1);
			
			// Checks the toBrowserPath / default fetch args inside the browser
			const callArg = fetchMock.mock.calls[0][0];
			expect(callArg).toBe("/api/test"); // Assuming window is defined in vitest jsdom
		});

		it("returns undefined on 204 No Content", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 204,
			});

			const result = await request("/test");
			expect(result).toBeUndefined();
		});

		it("returns Blob when responseType is blob", async () => {
			const mockBlob = new Blob(["test"], { type: "text/plain" });
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				blob: async () => mockBlob,
			});

			const result = await request("/test", { responseType: "blob" });
			expect(result).toBe(mockBlob);
		});

		it("includes default headers and allows overrides", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({}),
			});

			await request("/test", {
				headers: {
					"X-Custom": "val",
					"Accept": "text/csv",
				},
			});

			const options = fetchMock.mock.calls[0][1];
			expect(options.headers).toEqual({
				"Content-Type": "application/json",
				Accept: "text/csv", // Overridden
				"X-Custom": "val",
			});
		});

		it("throws BackendUnavailableError if fetch throws a TypeError indicating fetch failed", async () => {
			fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

			await expect(request("/test")).rejects.toThrowError(BackendUnavailableError);
		});

		it("throws ApiError on non-ok responses with parsed message", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
				json: async () => ({ error: "Validation failed" }),
			});

			try {
				await request("/test");
				expect.fail("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ApiError);
				const apiErr = err as ApiError;
				expect(apiErr.status).toBe(400);
				expect(apiErr.message).toContain("Validation failed");
				expect(apiErr.body).toEqual({ error: "Validation failed" });
			}
		});

		it("throws ApiError extracting message from nested error.message object", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 422,
				statusText: "Unprocessable Entity",
				json: async () => ({ error: { message: "Detailed nested error" } }),
			});

			try {
				await request("/test");
				expect.fail("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ApiError);
				const apiErr = err as ApiError;
				expect(apiErr.status).toBe(422);
				expect(apiErr.message).toContain("Detailed nested error");
			}
		});

		it("throws ApiError using statusText if json parsing fails", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 502,
				statusText: "Bad Gateway",
				json: async () => { throw new Error("Invalid JSON"); },
			});

			try {
				await request("/test");
				expect.fail("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ApiError);
				const apiErr = err as ApiError;
				expect(apiErr.status).toBe(502);
				expect(apiErr.message).toContain("Bad Gateway");
			}
		});
	});

	describe("error classifiers", () => {
		it("isAuthError identifies 401 and 403", () => {
			expect(isAuthError(new ApiError(401, "unauthorized"))).toBe(true);
			expect(isAuthError(new ApiError(403, "forbidden"))).toBe(true);
			expect(isAuthError({ status: 401 })).toBe(true); // Plain object fallback
			expect(isAuthError(new ApiError(404, "not found"))).toBe(false);
		});

		it("isSuspendedAccountError identifies 403 + account_suspended code", () => {
			expect(
				isSuspendedAccountError(new ApiError(403, "suspended", { error: { code: "account_suspended" } }))
			).toBe(true);
			
			// Plain object fallback
			expect(
				isSuspendedAccountError({ status: 403, body: { error: { code: "account_suspended" } } })
			).toBe(true);

			// Not suspended
			expect(isSuspendedAccountError(new ApiError(403, "forbidden"))).toBe(false);
			expect(
				isSuspendedAccountError(new ApiError(401, "suspended", { error: { code: "account_suspended" } }))
			).toBe(false);
		});

		it("isPaymentRequiredError identifies 402", () => {
			expect(isPaymentRequiredError(new ApiError(402, "payment required"))).toBe(true);
			expect(isPaymentRequiredError({ status: 402 })).toBe(true);
			expect(isPaymentRequiredError(new ApiError(400, "bad request"))).toBe(false);
		});

		it("isQuotaError identifies 429 + daily_limit_exceeded code", () => {
			expect(
				isQuotaError(new ApiError(429, "exceeded", { error: { code: "daily_limit_exceeded" } }))
			).toBe(true);

			expect(
				isQuotaError({ status: 429, body: { error: { code: "daily_limit_exceeded" } } })
			).toBe(true);

			// Missing code
			expect(isQuotaError(new ApiError(429, "rate limited"))).toBe(false);
		});
	});

	describe("caching layer", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		it("sets and gets cached data", () => {
			setCache("my-key", { test: 123 });
			expect(getCached("my-key")).toEqual({ test: 123 });
		});

		it("returns null for non-existent key", () => {
			expect(getCached("missing")).toBeNull();
		});

		it("returns null and deletes if older than STALE_TTL", () => {
			setCache("stale-key", "data");
			
			// Advance past STALE_TTL
			vi.advanceTimersByTime(STALE_TTL + 1);
			
			expect(getCached("stale-key")).toBeNull();
			// Should be deleted
			expect(getCached("stale-key")).toBeNull(); 
		});

		it("honors the per-entry ttl instead of only the global STALE_TTL", () => {
			// Regression: getCached() only compared against STALE_TTL and never
			// read entry.ttl, so a resource cached with a 120s ttl (balance) or
			// 60s default stayed served for the full 300s. Callers' requested
			// freshness was silently ignored.
			setCache("short-ttl", "data", 1_000);
			vi.advanceTimersByTime(1_001);
			expect(getCached("short-ttl")).toBeNull();
		});

		it("still serves an entry before its ttl elapses", () => {
			setCache("within-ttl", "data", 1_000);
			vi.advanceTimersByTime(999);
			expect(getCached("within-ttl")).toBe("data");
		});

		it("caps a ttl longer than STALE_TTL at STALE_TTL", () => {
			// STALE_TTL stays an upper bound so an over-long ttl cannot pin an
			// entry in memory indefinitely.
			setCache("long-ttl", "data", STALE_TTL * 10);
			vi.advanceTimersByTime(STALE_TTL + 1);
			expect(getCached("long-ttl")).toBeNull();
		});
	});
});
