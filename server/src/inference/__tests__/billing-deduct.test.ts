/**
 * Conditional credit deduction — must not floor to zero or re-seed trial.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, updateSet, updateWhere, updateReturning } = vi.hoisted(() => {
	const updateReturning = vi.fn();
	const updateWhere = vi.fn(() => ({ returning: updateReturning }));
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set: updateSet }));
	return { update, updateSet, updateWhere, updateReturning };
});

vi.mock("../../db/client.js", () => ({
	db: {
		update,
		transaction: async (fn: (tx: { update: typeof update }) => unknown) =>
			fn({ update }),
	},
}));

vi.mock("../../middleware/audit.js", () => ({
	auditLog: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { deductCreditsIfSufficient } from "../billing.js";

describe("deductCreditsIfSufficient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		update.mockReturnValue({ set: updateSet });
		updateSet.mockReturnValue({ where: updateWhere });
		updateWhere.mockReturnValue({ returning: updateReturning });
	});

	it("returns true when a ledger row is updated", async () => {
		updateReturning.mockResolvedValue([{ userId: "u1" }]);
		await expect(deductCreditsIfSufficient("u1", 12.5)).resolves.toBe(true);
		expect(update).toHaveBeenCalled();
		expect(updateSet).toHaveBeenCalled();
		expect(updateWhere).toHaveBeenCalled();
	});

	it("returns false when no row matches (insufficient / missing)", async () => {
		updateReturning.mockResolvedValue([]);
		await expect(deductCreditsIfSufficient("u1", 99)).resolves.toBe(false);
	});

	it("skips the update for non-positive costs", async () => {
		await expect(deductCreditsIfSufficient("u1", 0)).resolves.toBe(true);
		expect(update).not.toHaveBeenCalled();
	});
});
