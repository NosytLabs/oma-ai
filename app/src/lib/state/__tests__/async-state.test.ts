import { describe, expect, it } from "vitest";
import {
	ASYNC_STATUS,
	INITIAL_ASYNC_STATE,
	asyncData,
	asyncError,
	isAsyncError,
	isAsyncLoading,
	isAsyncPending,
	isAsyncSuccess,
	toAsyncError,
	toAsyncLoading,
	toAsyncSuccess,
} from "../async-state";

describe("async-state transitions", () => {
	it("starts idle with no data and no error", () => {
		expect(INITIAL_ASYNC_STATE).toEqual({
			status: "idle",
			data: null,
			error: null,
		});
		expect(isAsyncPending(INITIAL_ASYNC_STATE)).toBe(true);
		expect(asyncData(INITIAL_ASYNC_STATE)).toBeNull();
	});

	it("loading keeps prior data (non-destructive refresh)", () => {
		const ok = toAsyncSuccess(INITIAL_ASYNC_STATE, { id: 1 });
		const reloading = toAsyncLoading(ok);
		expect(reloading.status).toBe(ASYNC_STATUS.Loading);
		expect(reloading.data).toEqual({ id: 1 });
		expect(reloading.error).toBeNull();
	});

	it("success resolves data and drops any error", () => {
		const s = toAsyncSuccess(toAsyncLoading(INITIAL_ASYNC_STATE), "payload");
		expect(isAsyncSuccess(s)).toBe(true);
		expect(asyncData(s)).toBe("payload");
		expect(s.error).toBeNull();
	});

	it("error keeps prior data so a failed refresh does not blank the screen", () => {
		const ok = toAsyncSuccess(INITIAL_ASYNC_STATE, "stale-but-useful");
		const failed = toAsyncError(ok, "boom");
		expect(isAsyncError(failed)).toBe(true);
		expect(asyncError(failed)).toBe("boom");
		expect(failed.data).toBe("stale-but-useful");
	});

	it("status is exhaustive: only one branch is ever true", () => {
		const states = [
			INITIAL_ASYNC_STATE,
			toAsyncLoading(INITIAL_ASYNC_STATE),
			toAsyncSuccess(INITIAL_ASYNC_STATE, 1),
			toAsyncError(INITIAL_ASYNC_STATE, "e"),
		];
		for (const s of states) {
			const flags = [isAsyncLoading(s), isAsyncSuccess(s), isAsyncError(s)];
			const truthy = flags.filter(Boolean).length;
			// idle has zero flags (it is isAsyncPending's domain); every other
			// state is described by exactly one flag.
			expect(truthy).toBe(s.status === "idle" ? 0 : 1);
			expect(isAsyncPending(s)).toBe(s.status === "idle" || s.status === "loading");
		}
	});
});
