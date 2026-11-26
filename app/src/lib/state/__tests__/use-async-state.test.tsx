import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAsyncState } from "../use-async-state";

describe("useAsyncState", () => {
	it("moves idle → loading → success and resolves the value", async () => {
		const { result } = renderHook(() => useAsyncState<string>());
		let resolve!: (v: string) => void;
		const task = () =>
			new Promise<string>((res) => {
				resolve = res;
			});

		let promise!: Promise<string | null>;
		act(() => {
			promise = result.current.run(task);
		});
		expect(result.current.state.status).toBe("loading");
		expect(result.current.isBusy).toBe(true);

		await act(async () => {
			resolve("done");
			await promise;
		});
		expect(result.current.state.status).toBe("success");
		expect(result.current.state.data).toBe("done");
		expect(result.current.isBusy).toBe(false);
	});

	it("moves to error on rejection and rethrows for flow control", async () => {
		const { result } = renderHook(() => useAsyncState<string>());
		let promise!: Promise<string | null>;
		act(() => {
			promise = result.current.run(async () => {
				throw new Error("kaboom");
			});
		});
		await expect(promise).rejects.toThrow("kaboom");
		await waitFor(() =>
			expect(result.current.state.status).toBe("error"),
		);
		expect(result.current.state.error).toBe("kaboom");
	});

	it("ignores a stale promise resolving after a newer run", async () => {
		const { result } = renderHook(() => useAsyncState<number>());
		const gates: Array<(v: number) => void> = [];
		const gated = () => new Promise<number>((res) => gates.push(res));

		let first!: Promise<number | null>;
		let second!: Promise<number | null>;
		act(() => {
			first = result.current.run(gated);
			second = result.current.run(gated);
		});
		await act(async () => {
			gates[1](2); // the newer run resolves first
			await second;
		});
		expect(result.current.state.data).toBe(2);
		await act(async () => {
			gates[0](1); // the stale run settles late
			const staleValue = await first;
			// The stale run resolves null (discarded), not its value.
			expect(staleValue).toBeNull();
		});
		// The stale result must not clobber the newer one.
		expect(result.current.state.data).toBe(2);
	});

	it("reset returns to idle and invalidates in-flight work", async () => {
		const { result } = renderHook(() => useAsyncState<number>());
		let resolve!: (v: number) => void;
		const task = () => new Promise<number>((res) => (resolve = res));

		let promise!: Promise<number | null>;
		act(() => {
			promise = result.current.run(task);
		});
		act(() => result.current.reset());
		expect(result.current.state.status).toBe("idle");

		await act(async () => {
			resolve(9);
			const value = await promise;
			expect(value).toBeNull(); // discarded by the reset
		});
		expect(result.current.state.status).toBe("idle");
	});

	it("reject-new mode refuses a second op while one is in flight", async () => {
		const { result } = renderHook(() =>
			useAsyncState<number>({ concurrency: "reject-new" }),
		);
		let calls = 0;
		let resolve!: (v: number) => void;
		const task = () => {
			calls++;
			return new Promise<number>((res) => (resolve = res));
		};

		let first!: Promise<number | null>;
		act(() => {
			first = result.current.run(task);
		});
		let second!: Promise<number | null>;
		act(() => {
			// Same tick, before React commits the busy state: must be refused.
			second = result.current.run(task);
		});
		await act(async () => {
			const refused = await second;
			expect(refused).toBeNull();
			resolve(1);
			expect(await first).toBe(1);
		});
		expect(calls).toBe(1); // the second submit never reached the task
		expect(result.current.state.data).toBe(1);
	});
});
