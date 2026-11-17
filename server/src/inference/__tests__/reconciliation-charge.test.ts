/**
 * The reconciliation charge rule, without a database.
 *
 * A hold in `reconciliation` is real user money parked on an ambiguous
 * outcome. When an operator (or the evidence sweep) settles it, the charge
 * must come from evidence — the receipt's recorded charge, or an explicit
 * operator amount — and must never exceed the hold, not even by one ledger
 * unit. These tests pin that arithmetic at the ledger's own precision.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../db/client.js", () => ({ db: { transaction: vi.fn(), execute: vi.fn() } }));
vi.mock("../../lib/logger.js", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { resolveReconciliationCharge } from "../credit-reservations.js";

describe("resolveReconciliationCharge", () => {
	it("uses the receipt's recorded charge by default", () => {
		expect(resolveReconciliationCharge("0.41280000", "0.01260000")).toBe("0.01260000");
	});

	it("normalizes the receipt charge to ledger precision", () => {
		expect(resolveReconciliationCharge("1.00000000", "0.5")).toBe("0.50000000");
	});

	it("lets an explicit operator charge override the receipt", () => {
		expect(resolveReconciliationCharge("0.41280000", "0.01260000", 0.02)).toBe("0.02000000");
	});

	it("accepts a charge equal to the whole hold", () => {
		expect(resolveReconciliationCharge("0.41280000", "0.41280000")).toBe("0.41280000");
		expect(resolveReconciliationCharge("0.41280000", null, 0.4128)).toBe("0.41280000");
	});

	it("refuses a charge one ledger unit above the hold", () => {
		expect(() => resolveReconciliationCharge("0.00000001", "0.00000002")).toThrow(/exceeds the reserved hold/);
		expect(() => resolveReconciliationCharge("0.41280000", "0.01260000", 0.41280001)).toThrow(/exceeds the reserved hold/);
	});

	it("refuses a negative or non-finite operator charge", () => {
		expect(() => resolveReconciliationCharge("1.00000000", "0.50000000", -1)).toThrow(/non-negative/);
		expect(() => resolveReconciliationCharge("1.00000000", "0.50000000", Number.NaN)).toThrow(/non-negative/);
		expect(() => resolveReconciliationCharge("1.00000000", "0.50000000", Number.POSITIVE_INFINITY)).toThrow(/non-negative/);
	});

	it("refuses to invent a charge when no receipt records one", () => {
		expect(() => resolveReconciliationCharge("1.00000000", null)).toThrow(/No financial receipt/);
		expect(() => resolveReconciliationCharge("1.00000000", undefined)).toThrow(/No financial receipt/);
	});

	it("settles at zero when the receipt records no charge and no override is given", () => {
		expect(resolveReconciliationCharge("0.41280000", "0.00000000")).toBe("0.00000000");
	});
});
