/**
 * `useAsyncState` — drive an `AsyncState<T>` (see async-state.ts) from a
 * promise.
 *
 * Replaces the hand-rolled `isLoading`/`isSubmitting` boolean + `finally`
 * flag + "ignore this component after unmount" ref that every async component
 * in the app used to repeat, slightly differently. The two subtle guards it
 * bakes in for every caller:
 *
 *  - **Latest op wins.**
 *    `run` bump a monotonically increasing token; only the token of the most
 *    recent `run` may write to state. A stale promise resolving late cannot
 *    clobber a newer request's result.
 *  - **Unmount guard.**
 *    Setters are no-ops after the component unmounts (React 18+ already
 *    ignores them but logs a warning; we avoid the warning and the work).
 *
 * ```ts
 * const { state, run, isBusy } = useAsyncState<DepositInstructions>();
 * useEffect(() => { void run(() => deposit.instructions()); }, [run]);
 * // render: isAsyncLoading(state) → spinner; isAsyncSuccess(state) → data
 * ```
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	INITIAL_ASYNC_STATE,
	toAsyncError,
	toAsyncLoading,
	toAsyncSuccess,
	type AsyncState,
} from "./async-state";

export interface UseAsyncStateResult<T> {
	/** The current lifecycle. Render exhaustively off its `status`. */
	state: AsyncState<T>;
	/**
	 * Reset to the initial (idle) state. Use after a hard reset that should
	 * drop any prior data and error.
	 */
	reset: () => void;
	/**
	 * Run `task`, moving through loading → success/error.
	 *
	 * Resolves with the task's value when this op is still the latest one.
	 * Resolves **`null`** when the outcome was discarded — a newer `run`
	 * started, or the component unmounted — so the caller does not surface
	 * feedback for an op nobody is waiting on. Rejects only when a still-
	 * current op failed, so `try/catch` keeps working for flow control.
	 */
	run: (task: () => Promise<T>) => Promise<T | null>;
	/** True while a request is in flight. Convenience; same as `isAsyncLoading(state)`. */
	isBusy: boolean;
}

export type AsyncConcurrency =
	/** A newer op supersedes an older one; both may run (fetch/refresh). */
	| "supersede-old"
	/** While an op is in flight, new `run` calls are refused (forms: no double submit). */
	| "reject-new";

export function useAsyncState<T>(
	opts: { concurrency?: AsyncConcurrency } = {},
): UseAsyncStateResult<T> {
	const [state, setState] = useState<AsyncState<T>>(INITIAL_ASYNC_STATE);
	const latestToken = useRef(0);
	// Token of the op currently in flight, or 0. Guards `reject-new` mode.
	const busyToken = useRef(0);
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const commit = useCallback((next: (prev: AsyncState<T>) => AsyncState<T>, token: number) => {
		// A token already superseded (or the component unmounted) → ignore.
		if (token !== latestToken.current || !mounted.current) return;
		setState(next);
	}, []);

	const reset = useCallback(() => {
		latestToken.current++; // invalidate any in-flight op
		busyToken.current = 0; // a reset also frees `reject-new` mode
		setState(INITIAL_ASYNC_STATE);
	}, []);

	const run = useCallback(
		async (task: () => Promise<T>): Promise<T | null> => {
			// `reject-new`: refuse an op while one is in flight — before bumping
			// `latestToken`, so the refused call cannot make the running op stale.
			if (opts.concurrency === "reject-new" && busyToken.current !== 0) {
				return null;
			}
			const token = ++latestToken.current;
			busyToken.current = token;
			// `toAsyncLoading` is a pure function of the previous state, so it
			// works directly as the React updater — prior data is preserved.
			commit(toAsyncLoading, token);
			try {
				const data = await task();
				if (token !== latestToken.current || !mounted.current) return null;
				busyToken.current = 0;
				commit((prev) => toAsyncSuccess(prev, data), token);
				return data;
			} catch (err) {
				// A discarded outcome (newer run started / unmounted) must not
				// write state OR surface as a rejection the caller would show.
				if (token !== latestToken.current || !mounted.current) return null;
				busyToken.current = 0;
				const message = err instanceof Error ? err.message : "Request failed";
				commit((prev) => toAsyncError(prev, message), token);
				throw err;
			}
		},
		// `commit`, both refs and `opts` are stable, so `run` is stable.
		[opts.concurrency],
	);

	return {
		state,
		reset,
		run,
		isBusy: state.status === "loading",
	};
}
