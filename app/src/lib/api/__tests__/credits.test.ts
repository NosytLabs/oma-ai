import { describe, expect, it } from "vitest";
import { creditTransactionStatus, type CreditTransaction } from "../credits";

/**
 * The credit feed mixes row types, and each row type owns a different status
 * vocabulary. The accessor narrows a row's status with the vocabulary its
 * type owns and returns null for anything else, so a drifted value can never
 * be mistaken for a real one.
 */
function tx(over: Partial<CreditTransaction>): CreditTransaction {
	return {
		id: "tx_1",
		type: "deposit",
		amountCents: 0,
		status: "completed",
		createdAt: "2026-01-01T00:00:00Z",
		...over,
	};
}

describe("creditTransactionStatus", () => {
	it("narrows a deposit row with the deposit vocabulary", () => {
		expect(creditTransactionStatus(tx({ type: "deposit", status: "pending" }))).toBe("pending");
		expect(creditTransactionStatus(tx({ type: "deposit", status: "refunded" }))).toBe("refunded");
	});

	it("narrows a usage or refund row with the usage vocabulary", () => {
		expect(creditTransactionStatus(tx({ type: "usage", status: "free_tier" }))).toBe("free_tier");
		expect(creditTransactionStatus(tx({ type: "refund", status: "error" }))).toBe("error");
	});

	it("returns null when the row type does not own that status", () => {
		expect(creditTransactionStatus(tx({ type: "deposit", status: "free_tier" }))).toBeNull();
		expect(creditTransactionStatus(tx({ type: "usage", status: "pending" }))).toBeNull();
	});

	it("returns null for an unknown value", () => {
		expect(creditTransactionStatus(tx({ type: "deposit", status: "not-a-status" }))).toBeNull();
	});
});
