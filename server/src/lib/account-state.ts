/**
 * Account access state.
 *
 * The `user` table carries two independent boolean flags for the same
 * decision: `banned` (Better Auth's legacy flag, still read by auth
 * middleware) and `suspended` (the flag the admin console writes). Every
 * reader used to combine them by hand, and one of them did not -- so the
 * effective state of an account was implicit and could drift between call
 * sites.
 *
 * The columns stay as they are: they are persisted, indexed and read on every
 * authenticated request. What moves here is the derivation, so every reader
 * gets the same answer.
 */

/** The effective access state of an account. */
export const ACCOUNT_ACCESS_STATE = {
	/** The account may act. */
	Allowed: "allowed",
	/** Blocked by the legacy Better Auth `banned` flag. */
	Banned: "banned",
	/** Blocked by the OMA `suspended` flag. */
	Suspended: "suspended",
} as const;

export type AccountAccessState =
	(typeof ACCOUNT_ACCESS_STATE)[keyof typeof ACCOUNT_ACCESS_STATE];

/** The subset of the user row the derivation needs. */
export interface AccountAccessFlags {
	banned?: boolean | null;
	suspended?: boolean | null;
}

/**
 * The effective access state of an account.
 *
 * `suspended` wins when both flags are set: it is the flag the admin console
 * writes, so it is the more specific and more current statement about the
 * account. A missing row is treated as allowed -- callers that need the row
 * to exist check for it separately.
 */
export function accountAccessState(
	flags: AccountAccessFlags | null | undefined,
): AccountAccessState {
	if (!flags) return ACCOUNT_ACCESS_STATE.Allowed;
	if (flags.suspended) return ACCOUNT_ACCESS_STATE.Suspended;
	if (flags.banned) return ACCOUNT_ACCESS_STATE.Banned;
	return ACCOUNT_ACCESS_STATE.Allowed;
}

/** True when the account must be rejected. */
export function isAccountBlocked(
	flags: AccountAccessFlags | null | undefined,
): boolean {
	return accountAccessState(flags) !== ACCOUNT_ACCESS_STATE.Allowed;
}
