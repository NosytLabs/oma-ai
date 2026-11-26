/**
 * Explicit async state — one vocabulary for every async resource.
 *
 * A data-fetching component used to carry its lifecycle as bare booleans:
 * `isLoading`, `error`, sometimes `data === null` to mean "not loaded yet".
 * Nothing ties them together, so two of them could disagree (spinner while
 * data is already shown, or an error state with no way to tell whether the
 * prior data is still useful). Every caller re-rolled the same "only the
 * latest request may write feedback" + "ignore state after unmount" guard by
 * hand, subtly differently.
 *
 * This module is the single explicit description of that lifecycle, as a
 * discriminated union: at any moment exactly one status is true, and the
 * payload/error live on the branch that owns them. Pure transition helpers
 * move between branches; a UI can never render "loading" and "success" at
 * the same time because they are different union members.
 *
 *   idle ──load──▶ loading ──resolve──▶ success
 *                     │                     │
 *                     └──reject──▶ error ────┘   (retry goes back to loading)
 *
 * See `use-async-state.ts` for the hook that drives it from a promise while
 * baking in the latest-op-wins + unmount guard.
 */

/** States an async resource can be in. */
export const ASYNC_STATUS = {
	/** Nothing asked for yet. */
	Idle: "idle",
	/** A request is in flight. */
	Loading: "loading",
	/** The last request resolved. `data` holds the result. */
	Success: "success",
	/** The last request rejected. `error` holds the message. */
	Error: "error",
} as const;

export type AsyncStatus = (typeof ASYNC_STATUS)[keyof typeof ASYNC_STATUS];

/**
 * The async lifecycle as a discriminated union.
 *
 * `data` and `error` are only non-null on the branch that owns them, so a
 * consumer cannot read a stale success payload off an error state.
 */
export type AsyncState<T> =
	| { status: typeof ASYNC_STATUS.Idle; data: null; error: null }
	| { status: typeof ASYNC_STATUS.Loading; data: T | null; error: null }
	| { status: typeof ASYNC_STATUS.Success; data: T; error: null }
	| { status: typeof ASYNC_STATUS.Error; data: T | null; error: string };

/** The initial state for any resource whose load has not started. */
export const INITIAL_ASYNC_STATE: AsyncState<never> = {
	status: ASYNC_STATUS.Idle,
	data: null,
	error: null,
};

/** True while a request is in flight. */
export function isAsyncLoading<T>(s: AsyncState<T>): boolean {
	return s.status === ASYNC_STATUS.Loading;
}

/** True when a request has resolved. Narrowing to `T`. */
export function isAsyncSuccess<T>(s: AsyncState<T>): s is Extract<AsyncState<T>, { status: typeof ASYNC_STATUS.Success }> {
	return s.status === ASYNC_STATUS.Success;
}

/** True when a request has rejected. */
export function isAsyncError<T>(s: AsyncState<T>): boolean {
	return s.status === ASYNC_STATUS.Error;
}

/** True when nothing has resolved yet (idle or in flight). */
export function isAsyncPending<T>(s: AsyncState<T>): boolean {
	return s.status === ASYNC_STATUS.Idle || s.status === ASYNC_STATUS.Loading;
}

/** The resolved payload, or `null` while idle/loading/error. */
export function asyncData<T>(s: AsyncState<T>): T | null {
	return s.status === ASYNC_STATUS.Success ? s.data : null;
}

/** The last error message, or `null` when there is none. */
export function asyncError<T>(s: AsyncState<T>): string | null {
	return s.status === ASYNC_STATUS.Error ? s.error : null;
}

/** Start a (re)load, keeping any prior data for a non-destructive refresh. */
export function toAsyncLoading<T>(s: AsyncState<T>): AsyncState<T> {
	return { status: ASYNC_STATUS.Loading, data: s.data, error: null };
}

/** Resolve with `data`. */
export function toAsyncSuccess<T>(_s: AsyncState<T>, data: T): AsyncState<T> {
	return { status: ASYNC_STATUS.Success, data, error: null };
}

/**
 * Reject with `error`. Prior data is kept so a failed refresh does not blank
 * the screen — the consumer chooses whether to show it.
 */
export function toAsyncError<T>(s: AsyncState<T>, error: string): AsyncState<T> {
	return { status: ASYNC_STATUS.Error, data: s.data, error };
}
