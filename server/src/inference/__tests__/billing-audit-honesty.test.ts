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

const { update, updateSet, updateWhere, updateReturning, insert, auditLog } = vi.hoisted(() => {
	const updateReturning = vi.fn();
	const updateWhere = vi.fn(() => ({ returning: updateReturning }));
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set: updateSet }));
	const insert = vi.fn(() => ({ values: vi.fn(async () => undefined) }));
	const auditLog = vi.fn(async () => undefined);
	return { update, updateSet, updateWhere, updateReturning, insert, auditLog };
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
		insert.mockReturnValue({ values: vi.fn(async () => undefined) });
	});

	it("records CREDIT_DEDUCTED when the ledger row was actually updated", async () => {
		updateReturning.mockResolvedValue([{ userId: "u1" }]);
		await recordUsage(baseArgs);
		expect(auditLog).toHaveBeenCalledWith(
			expect.objectContaining({ action: "CREDIT_DEDUCTED" }),
		);
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
		expect(entry.metadata.costCents).toBe("20000.0000");
	});
});
