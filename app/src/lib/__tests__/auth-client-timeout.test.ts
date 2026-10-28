import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("authentication request deadlines", () => {
	it.each(["nonce", "verify", "magic", "session"] as const)("aborts an unresponsive %s request without retrying it", async action => {
		let signal: AbortSignal | undefined;
		const fetch = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
			signal = init?.signal ?? undefined;
			signal?.addEventListener("abort", () => reject(new DOMException("Request aborted", "AbortError")), { once: true });
		}));
		vi.stubGlobal("fetch", fetch);
		const { authClient } = await import("../auth-client");
		const request = action === "nonce" ? authClient.siwe.nonce({})
			: action === "verify" ? authClient.siwe.verify({ message: "test-message", signature: "0xsignature" })
				: action === "magic" ? authClient.signIn.magicLink({ email: "test@example.test", callbackURL: "/dashboard" })
					: authClient.getSession();
		let settled = false;
		void request.then(() => { settled = true; }, () => { settled = true; });
		await vi.advanceTimersByTimeAsync(15_001);
		expect(settled).toBe(true);
		expect(signal?.aborted).toBe(true);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("keeps the deadline active while a caller-supplied session response body stalls", async () => {
		vi.useRealTimers();
		const caller = new AbortController();
		let requestSignal: AbortSignal | undefined;
		vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
			requestSignal = init?.signal ?? undefined;
			return new Response(new ReadableStream({ start(controller) {
				requestSignal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
			} }), { headers: { "content-type": "application/json" } });
		}));
		const { authClient } = await import("../auth-client");
		await expect(authClient.getSession({ fetchOptions: { signal: caller.signal, timeout: 20 } })).rejects.toThrow(/aborted/i);
		expect(requestSignal?.aborted).toBe(true);
		expect(caller.signal.aborted).toBe(false);
	});

	it("preserves caller cancellation before the authentication deadline", async () => {
		const caller = new AbortController();
		let started = false;
		vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
			started = true;
			init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
		})));
		const { authClient } = await import("../auth-client");
		const request = authClient.getSession({ fetchOptions: { signal: caller.signal } });
		const rejected = expect(request).rejects.toThrow(/aborted/i);
		await vi.advanceTimersByTimeAsync(0);
		expect(started).toBe(true);
		caller.abort();
		await rejected;
	});
});
