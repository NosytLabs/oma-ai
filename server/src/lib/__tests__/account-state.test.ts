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

describe("timed bans", () => {
	const now = new Date("2026-11-17T12:00:00Z");

	it("lapses a ban whose expiry has passed", () => {
		expect(
			accountAccessState(
				{ banned: true, suspended: false, banExpires: new Date("2026-11-16T12:00:00Z") },
				now,
			),
		).toBe(ACCOUNT_ACCESS_STATE.Allowed);
		expect(
			isAccountBlocked(
				{ banned: true, suspended: false, banExpires: "2026-11-17T12:00:00Z" },
				now,
			),
		).toBe(false);
	});

	it("keeps a ban whose expiry is still ahead", () => {
		expect(
			accountAccessState(
				{ banned: true, suspended: false, banExpires: new Date("2026-11-18T12:00:00Z") },
				now,
			),
		).toBe(ACCOUNT_ACCESS_STATE.Banned);
	});

	it("keeps a ban with no expiry permanent", () => {
		expect(accountAccessState({ banned: true, suspended: false, banExpires: null }, now)).toBe(
			ACCOUNT_ACCESS_STATE.Banned,
		);
	});

	it("never time-lifts a suspension, even with an expired ban alongside", () => {
		expect(
			accountAccessState(
				{ banned: true, suspended: true, banExpires: new Date("2020-01-01T00:00:00Z") },
				now,
			),
		).toBe(ACCOUNT_ACCESS_STATE.Suspended);
	});

	it("fails closed on an unparseable expiry", () => {
		expect(
			accountAccessState({ banned: true, suspended: false, banExpires: "not-a-date" }, now),
		).toBe(ACCOUNT_ACCESS_STATE.Banned);
	});
});
