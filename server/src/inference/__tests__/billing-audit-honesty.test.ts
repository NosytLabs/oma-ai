/**
 * The audit log must not claim a credit deduction that never happened.
 *
 * BUG (audit MEDIUM): recordUsage() wrote action="CREDIT_DEDUCTED"
 * unconditionally, even when the guarded UPDATE matched zero rows because the
 * balance was insufficient or a concurrent request won the race. The audit
 * trail then contradicted the ledger and buried a real reconciliation signal
 * behind a success entry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, updateSet, updateWhere, updateReturning, insert, insertValues, insertReturning, auditLog } =
	vi.hoisted(() => {
	const updateReturning = vi.fn();
	const updateWhere = vi.fn(() => ({ returning: updateReturning }));
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set: updateSet }));
	// recordUsage() now CLAIMS the request_id first:
	//   insert().values().onConflictDoNothing().returning()
	// A non-empty `returning()` result means this caller owns the row and may
	// deduct; an empty one means it was a duplicate and must not charge.
	const insertReturning = vi.fn(async () => [{ requestId: "req_1" }]);
	const insertValues = vi.fn(() => {
		const builder: Record<string, unknown> = {};
		builder.onConflictDoNothing = () => builder;
		builder.returning = insertReturning;
		return builder;
	});
	const insert = vi.fn(() => ({ values: insertValues }));
	const auditLog = vi.fn(async () => undefined);
	return { update, updateSet, updateWhere, updateReturning, insert, insertValues, insertReturning, auditLog };
});

vi.mock("../../db/client.js", () => ({
	db: {
		update,
		insert,
		transaction: async (fn: (tx: unknown) => unknown) => fn({ update, insert }),
	},
}));

vi.mock("../../middleware/audit.js", () => ({ auditLog }));

vi.mock("../../lib/logger.js", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { recordUsage, type RecordUsageArgs } from "../billing.js";

const baseArgs = {
	userId: "u1",
	model: "claude-opus-4-6",
	provider: "venice" as const,
	promptTokens: 100,
	outputTokens: 50,
	// Cost fields are DERIVED from pricing inside recordUsage, not passed in.
	// 1M input @ $1.00 + 1M output @ $2.00 scaled down by token counts.
	pricing: {
		inputPer1M: 1_000_000,
		outputPer1M: 2_000_000,
		markup: 0,
	} as unknown as RecordUsageArgs["pricing"],
	requestId: "req_1",
	apiKeyId: "key_1",
	status: "completed" as const,
};

describe("recordUsage audit honesty", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		update.mockReturnValue({ set: updateSet });
		updateSet.mockReturnValue({ where: updateWhere });
		updateWhere.mockReturnValue({ returning: updateReturning });
		insertValues.mockImplementation(() => {
			const builder: Record<string, unknown> = {};
			builder.onConflictDoNothing = () => builder;
			builder.returning = insertReturning;
			return builder;
		});
		// Default: this caller wins the request_id claim and may charge.
		insertReturning.mockResolvedValue([{ requestId: "req_1" }]);
	});

	it("keeps provider cost for free requests without claiming a credit deduction", async () => {
		await recordUsage({ ...baseArgs, promptTokens: 1_000_000, outputTokens: 0,
			pricing: { inputPer1M: 3, outputPer1M: 6, markup: 0, costInputPer1M: 2, costOutputPer1M: 4 },
			skipBilling: true });
		expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ costCents: "200.00000000", markupCents: "-200.00000000", totalCents: "0" }));
		expect(update).not.toHaveBeenCalled();
		expect(auditLog).not.toHaveBeenCalled();
	});

	it.each(["aborted", "error"] as const)("does not claim customer revenue or deduction for %s requests", async (status) => {
		await recordUsage({ ...baseArgs, status });
		expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ totalCents: "0" }));
		expect(update).not.toHaveBeenCalled();
		expect(auditLog).not.toHaveBeenCalled();
	});

	it.each(["aborted", "error"] as const)("preserves the actual outcome of a free %s request", async (status) => {
		await recordUsage({ ...baseArgs, status, skipBilling: true });
		expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status, totalCents: "0" }));
	});

	it("retains the catalog cost basis while charging an administrative retail override", async () => {
		updateReturning.mockResolvedValue([{ userId: "u1" }]);
		await recordUsage({ ...baseArgs, promptTokens: 1_000_000, outputTokens: 0,
			pricing: { inputPer1M: 3, outputPer1M: 6, markup: 0, costInputPer1M: 2, costOutputPer1M: 4 } });
		expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ costCents: "200.00000000", markupCents: "100.00000000", totalCents: "300.00000000" }));
	});

	it("records CREDIT_DEDUCTED when the ledger row was actually updated", async () => {
		updateReturning.mockResolvedValue([{ userId: "u1" }]);
		await recordUsage(baseArgs);
		expect(auditLog).toHaveBeenCalledWith(
			expect.objectContaining({ action: "CREDIT_DEDUCTED" }),
		);
	});

	it("preserves short Gonka charges instead of rounding them to free requests", async () => {
		updateReturning.mockResolvedValue([{ userId: "u1" }]);
		await recordUsage({ ...baseArgs, model: "minimax-m2-7", provider: "oma-ai", promptTokens: 1, outputTokens: 2,
			pricing: { inputPer1M: 0.02, outputPer1M: 0.02, markup: 0, costKnown: false } });
		expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ totalCents: "0.00000600" }));
		const deduction = (updateSet.mock.calls as unknown as Array<[Record<"balanceCents" | "totalUsedCents", { queryChunks: unknown[] }>]>)[0][0];
		expect(deduction.balanceCents.queryChunks).toContain("0.00000600");
		expect(deduction.totalUsedCents.queryChunks).toContain("0.00000600");
	});

	it("records CREDIT_DEDUCTION_REJECTED when no row was updated (free-inference race)", async () => {
		// Guarded UPDATE matched nothing: balance insufficient, or a
		// concurrent request won the race. The user was NOT charged.
		updateReturning.mockResolvedValue([]);

		await recordUsage(baseArgs);

		expect(auditLog).toHaveBeenCalledWith(
			expect.objectContaining({ action: "CREDIT_DEDUCTION_REJECTED" }),
		);
		expect(auditLog).not.toHaveBeenCalledWith(
			expect.objectContaining({ action: "CREDIT_DEDUCTED" }),
		);
		// Analytics must also show zero customer charges when no debit happened.
		expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ totalCents: "0", markupCents: "-20000.00000000" }));
	});

	it("does NOT deduct when the requestId was already recorded", async () => {
		// P0 money-safety: the usage insert now claims request_id BEFORE the
		// deduction. A duplicate loses the claim and must never touch the
		// balance — the previous deduct-then-insert order charged twice and
		// then swallowed the unique-violation.
		insertReturning.mockResolvedValue([]);
		updateReturning.mockResolvedValue([{ userId: "u1" }]);

		await recordUsage(baseArgs);

		expect(update).not.toHaveBeenCalled();
		expect(auditLog).not.toHaveBeenCalledWith(
			expect.objectContaining({ action: "CREDIT_DEDUCTED" }),
		);
	});

	it("keeps the uncharged amount recoverable for reconciliation", async () => {
		updateReturning.mockResolvedValue([]);

		await recordUsage(baseArgs);

		const entry = (auditLog.mock.calls as unknown as Array<[Record<string, any>]>)[0][0];
		expect(entry.userId).toBe("u1");
		// requestId + costCents are what makes an uncharged request
		// reconcilable after the fact rather than simply lost revenue.
		expect(entry.resourceId).toBe("req_1");
		// $1/1M input + $2/1M output, 0% markup => 20,000.00 cents.
		expect(entry.metadata.costCents).toBe("20000.00000000");
	});
});
