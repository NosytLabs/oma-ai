/**
 * The settlement cache state machine.
 *
 * The cache used to distinguish "verified but not settled" from "settled" by
 * the presence of a receipt, which meant the rule lived only in comments and
 * in `if (record.receipt)` checks. The state is explicit now, so these tests
 * lock in the two states and the predicate every reader uses.
 */
import { describe, expect, it } from "vitest";
import { isSettledRecord, SETTLEMENT_STATE } from "../types.js";

const verified = {
	state: SETTLEMENT_STATE.Verified,
	txHash: "0xabc",
	amount: "1000",
	networkId: "base",
	payee: "0xpayee",
	settledAt: 0,
};

const settled = {
	state: SETTLEMENT_STATE.Settled,
	txHash: "0xabc",
	amount: "1000",
	networkId: "base",
	payee: "0xpayee",
	settledAt: 1_700_000_000_000,
	receipt: "signed-receipt",
};

describe("settlement state", () => {
	it("knows the two states by name", () => {
		expect(SETTLEMENT_STATE.Verified).toBe("verified");
		expect(SETTLEMENT_STATE.Settled).toBe("settled");
	});

	it("does not treat a verified record as settled", () => {
		expect(isSettledRecord(verified)).toBe(false);
	});

	it("treats a settled record as settled", () => {
		expect(isSettledRecord(settled)).toBe(true);
	});

	it("treats a missing record as not settled", () => {
		expect(isSettledRecord(undefined)).toBe(false);
		expect(isSettledRecord(null)).toBe(false);
	});
});
