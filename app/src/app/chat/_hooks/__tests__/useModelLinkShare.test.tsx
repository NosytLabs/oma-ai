import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModelLinkShare } from "../useModelLinkShare";

const mocks = vi.hoisted(() => ({
	copyToClipboard: vi.fn<(text: string) => Promise<boolean>>(),
}));

vi.mock("@/lib/clipboard", () => ({
	copyToClipboard: mocks.copyToClipboard,
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("useModelLinkShare", () => {
	const toast = {
		success: vi.fn(),
		error: vi.fn(),
	};

	beforeEach(() => {
		vi.useFakeTimers();
		mocks.copyToClipboard.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it("copies the current model URL and resets its success feedback", async () => {
		mocks.copyToClipboard.mockResolvedValue(true);
		const { result } = renderHook(() =>
			useModelLinkShare({ model: "a/b?c", toast }),
		);

		await act(async () => result.current.copyModelLink());

		expect(mocks.copyToClipboard).toHaveBeenCalledWith(
			`${window.location.origin}/chat?model=a%2Fb%3Fc`,
		);
		expect(result.current.status).toBe("success");
		expect(toast.success).toHaveBeenCalledWith("Model link copied to clipboard");

		act(() => vi.advanceTimersByTime(2_000));
		expect(result.current.status).toBe("default");
	});

	it("reports a clipboard failure", async () => {
		mocks.copyToClipboard.mockResolvedValue(false);
		const { result } = renderHook(() =>
			useModelLinkShare({ model: "model-a", toast }),
		);

		await act(async () => result.current.copyModelLink());

		expect(result.current.status).toBe("error");
		expect(toast.error).toHaveBeenCalledWith(
			"Could not copy model link — check clipboard permissions",
		);
	});

	it("keeps feedback from the newest copy when clipboard requests overlap", async () => {
		const first = deferred<boolean>();
		const second = deferred<boolean>();
		mocks.copyToClipboard
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const { result, rerender } = renderHook(
			({ model }) => useModelLinkShare({ model, toast }),
			{ initialProps: { model: "model-a" } },
		);

		let firstCopy!: Promise<void>;
		act(() => {
			firstCopy = result.current.copyModelLink();
		});
		rerender({ model: "model-b" });
		let secondCopy!: Promise<void>;
		act(() => {
			secondCopy = result.current.copyModelLink();
		});

		await act(async () => {
			second.resolve(true);
			await secondCopy;
		});
		await act(async () => {
			first.resolve(false);
			await firstCopy;
		});

		expect(result.current.status).toBe("success");
		expect(toast.success).toHaveBeenCalledTimes(1);
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("ignores an in-flight copy after unmount", async () => {
		const pending = deferred<boolean>();
		mocks.copyToClipboard.mockReturnValue(pending.promise);
		const { result, unmount } = renderHook(() =>
			useModelLinkShare({ model: "model-a", toast }),
		);

		let copy!: Promise<void>;
		act(() => {
			copy = result.current.copyModelLink();
		});
		unmount();
		await act(async () => {
			pending.resolve(true);
			await copy;
		});

		expect(toast.success).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("clears its feedback timer after unmount", async () => {
		mocks.copyToClipboard.mockResolvedValue(true);
		const { result, unmount } = renderHook(() =>
			useModelLinkShare({ model: "model-a", toast }),
		);

		await act(async () => result.current.copyModelLink());
		expect(vi.getTimerCount()).toBe(1);

		unmount();

		expect(vi.getTimerCount()).toBe(0);
	});
});
