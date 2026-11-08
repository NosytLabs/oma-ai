/**
 * Transition-table contracts for the explicit lifecycles.
 *
 * Each lifecycle module names its states and the legal moves between them.
 * These tests check the tables against their own vocabulary, so a typo in a
 * state name, a missing key or a terminal state that can still move fails
 * here instead of silently producing an impossible write.
 */
import { describe, expect, it } from "vitest";
import {
	DEPOSIT_STATUS,
	DEPOSIT_STATUSES,
	DEPOSIT_STATUS_TRANSITIONS,
	PENDING_DEPOSIT_STATUSES,
	TERMINAL_DEPOSIT_STATUSES,
} from "../deposit-status.js";
import { REFUND_STATUS, REFUND_STATUSES, REFUND_STATUS_TRANSITIONS } from "../refund-status.js";
import {
	CLAIM_RELEASED,
	CLAIM_STATE,
	CLAIM_STATES,
	CLAIM_STATE_TRANSITIONS,
} from "../inference-claim-state.js";
import {
	RESERVATION_STATE,
	RESERVATION_STATES,
	RESERVATION_STATE_TRANSITIONS,
} from "../credit-reservation-state.js";

describe("deposit status transitions", () => {
	it("covers every status exactly once", () => {
		expect(Object.keys(DEPOSIT_STATUS_TRANSITIONS).sort()).toEqual(
			[...DEPOSIT_STATUSES].sort(),
		);
	});

	it("only moves to known statuses", () => {
		for (const targets of Object.values(DEPOSIT_STATUS_TRANSITIONS)) {
			for (const target of targets) {
				expect(DEPOSIT_STATUSES).toContain(target);
			}
		}
	});

	it("keeps terminal statuses terminal apart from a later refund", () => {
		for (const status of TERMINAL_DEPOSIT_STATUSES) {
			const targets = DEPOSIT_STATUS_TRANSITIONS[status];
			if (status === DEPOSIT_STATUS.Completed) {
				// A settled deposit can still be refunded afterwards; that is the
				// only move out of a terminal state.
				expect(targets.every((t) => t === DEPOSIT_STATUS.Refunded)).toBe(true);
				continue;
			}
			expect(targets).toEqual([]);
		}
	});

	it("splits the vocabulary into pending and terminal", () => {
		const covered = new Set([...PENDING_DEPOSIT_STATUSES, ...TERMINAL_DEPOSIT_STATUSES]);
		expect(covered.size).toBe(DEPOSIT_STATUSES.length);
		for (const status of DEPOSIT_STATUSES) expect(covered.has(status)).toBe(true);
	});
});

describe("refund status transitions", () => {
	it("covers every status and only moves to known statuses", () => {
		expect(Object.keys(REFUND_STATUS_TRANSITIONS).sort()).toEqual(
			[...REFUND_STATUSES].sort(),
		);
		for (const targets of Object.values(REFUND_STATUS_TRANSITIONS)) {
			for (const target of targets) expect(REFUND_STATUSES).toContain(target);
		}
	});

	it("treats a decision as final", () => {
		expect(REFUND_STATUS_TRANSITIONS[REFUND_STATUS.Granted]).toEqual([]);
		expect(REFUND_STATUS_TRANSITIONS[REFUND_STATUS.Denied]).toEqual([]);
	});
});

describe("inference claim transitions", () => {
	it("covers every state plus the release-by-deletion state", () => {
		expect(Object.keys(CLAIM_STATE_TRANSITIONS).sort()).toEqual(
			[...CLAIM_STATES, CLAIM_RELEASED].sort(),
		);
	});

	it("only moves to known states", () => {
		const known = new Set<string>([...CLAIM_STATES, CLAIM_RELEASED]);
		for (const targets of Object.values(CLAIM_STATE_TRANSITIONS)) {
			for (const target of targets) expect(known.has(target)).toBe(true);
		}
	});

	it("keeps a completed claim final", () => {
		expect(CLAIM_STATE_TRANSITIONS[CLAIM_STATE.Completed]).toEqual([]);
	});
});

describe("credit reservation transitions", () => {
	it("covers every reservation state", () => {
		expect(Object.keys(RESERVATION_STATE_TRANSITIONS).sort()).toEqual(
			[...RESERVATION_STATES].sort(),
		);
	});

	it("only moves to known reservation states", () => {
		for (const targets of Object.values(RESERVATION_STATE_TRANSITIONS)) {
			for (const target of targets) {
				expect(RESERVATION_STATES).toContain(target);
			}
		}
	});

	it("keeps released and settled final", () => {
		expect(RESERVATION_STATE_TRANSITIONS[RESERVATION_STATE.Released]).toEqual([]);
		expect(RESERVATION_STATE_TRANSITIONS[RESERVATION_STATE.Settled]).toEqual([]);
	});
});
