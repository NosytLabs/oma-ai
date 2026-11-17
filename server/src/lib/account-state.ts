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

type AccountAccessState =
	(typeof ACCOUNT_ACCESS_STATE)[keyof typeof ACCOUNT_ACCESS_STATE];

/** The subset of the user row the derivation needs. */
interface AccountAccessFlags {
	banned?: boolean | null;
	suspended?: boolean | null;
	/**
	 * When a timed ban ends. Better Auth records it on the user row, but the
	 * derivation used to ignore it, so a ban written with an expiry behaved
	 * as permanent on every OMA-enforced path.
	 */
	banExpires?: Date | string | null;
}

/**
 * The effective access state of an account.
 *
 * `suspended` wins when both flags are set: it is the flag the admin console
 * writes, so it is the more specific and more current statement about the
 * account. A missing row is treated as allowed -- callers that need the row
 * to exist check for it separately.
 *
 * A ban whose `banExpires` has passed has lapsed: the account is allowed
 * again without anyone clearing the flag by hand. `suspended` has no expiry
 * column, so it is never time-lifted. An unparseable expiry fails closed --
 * the ban stands -- because a corrupt timestamp must not read as "expired".
 */
export function accountAccessState(
	flags: AccountAccessFlags | null | undefined,
	now: Date = new Date(),
): AccountAccessState {
	if (!flags) return ACCOUNT_ACCESS_STATE.Allowed;
	if (flags.suspended) return ACCOUNT_ACCESS_STATE.Suspended;
	if (flags.banned) {
		if (flags.banExpires) {
			const expires =
				flags.banExpires instanceof Date
					? flags.banExpires
					: new Date(flags.banExpires);
			if (!Number.isNaN(expires.getTime()) && expires.getTime() <= now.getTime()) {
				return ACCOUNT_ACCESS_STATE.Allowed;
			}
		}
		return ACCOUNT_ACCESS_STATE.Banned;
	}
	return ACCOUNT_ACCESS_STATE.Allowed;
}

/** True when the account must be rejected. */
export function isAccountBlocked(
	flags: AccountAccessFlags | null | undefined,
	now?: Date,
): boolean {
	return accountAccessState(flags, now) !== ACCOUNT_ACCESS_STATE.Allowed;
}
