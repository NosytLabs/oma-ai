/**
 * Contract for the account access vocabulary.
 *
 * The account's effective state is derived from two persisted flags. These
 * tests pin the derivation so every reader (session auth, bearer auth, the
 * admin gate) agrees on what "blocked" means.
 */
import { describe, expect, it } from "vitest";
import {
	ACCOUNT_ACCESS_STATE,
	accountAccessState,
	isAccountBlocked,
} from "../account-state.js";

describe("accountAccessState", () => {
	it("allows an account with neither flag set", () => {
		expect(accountAccessState({ banned: false, suspended: false })).toBe(
			ACCOUNT_ACCESS_STATE.Allowed,
		);
		expect(accountAccessState({})).toBe(ACCOUNT_ACCESS_STATE.Allowed);
		expect(accountAccessState(null)).toBe(ACCOUNT_ACCESS_STATE.Allowed);
		expect(accountAccessState(undefined)).toBe(ACCOUNT_ACCESS_STATE.Allowed);
	});

	it("names the legacy banned flag", () => {
		expect(accountAccessState({ banned: true, suspended: false })).toBe(
			ACCOUNT_ACCESS_STATE.Banned,
		);
	});

	it("names the suspended flag", () => {
		expect(accountAccessState({ banned: false, suspended: true })).toBe(
			ACCOUNT_ACCESS_STATE.Suspended,
		);
	});

	it("prefers suspended when both flags are set", () => {
		expect(accountAccessState({ banned: true, suspended: true })).toBe(
			ACCOUNT_ACCESS_STATE.Suspended,
		);
	});
});

describe("isAccountBlocked", () => {
	it("blocks on either flag", () => {
		expect(isAccountBlocked({ banned: true, suspended: false })).toBe(true);
		expect(isAccountBlocked({ banned: false, suspended: true })).toBe(true);
		expect(isAccountBlocked({ banned: true, suspended: true })).toBe(true);
	});

	it("does not block a clear account", () => {
		expect(isAccountBlocked({ banned: false, suspended: false })).toBe(false);
		expect(isAccountBlocked(null)).toBe(false);
	});
});
