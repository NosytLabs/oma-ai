import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The settlement DLQ is the only record that a payment was accepted on-chain
 * but failed to persist. It used to be Redis-backed and write-only:
 *  - production has no Redis, so addSettlementToDlq logged and returned,
 *    discarding the entry entirely;
 *  - the entry omitted `payee` and `receipt`, which are NOT NULL on
 *    `settlements`, so it could not have been replayed even with Redis;
 *  - nothing ever drained the queue.
 *
 * These tests lock in the replacement: a Postgres-backed queue carrying the
 * full payload, with a drain that is idempotent and backs off on failure.
 */

const mocks = vi.hoisted(() => ({
	insert: vi.fn(),
	select: vi.fn(),
	del: vi.fn(),
	update: vi.fn(),
}));

vi.mock("../../db/client.js", () => ({
	db: {
		insert: (...a: unknown[]) => mocks.insert(...a),
		select: (...a: unknown[]) => mocks.select(...a),
		delete: (...a: unknown[]) => mocks.del(...a),
		update: (...a: unknown[]) => mocks.update(...a),
	},
}));
vi.mock("../../lib/logger.js", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { addSettlementToDlq, drainSettlementDlq } from "../dlq";

/** insert(table).values(v).onConflictDoNothing()/onConflictDoUpdate() */
function insertChain() {
	const c: any = {};
	c.values = vi.fn(() => c);
	c.onConflictDoNothing = vi.fn(() => Promise.resolve());
	c.onConflictDoUpdate = vi.fn(() => Promise.resolve());
	return c;
}

/** select().from().where().orderBy().limit() -> rows */
function selectChain(rows: unknown[]) {
	const c: any = {};
	c.from = vi.fn(() => c);
	c.where = vi.fn(() => c);
	c.orderBy = vi.fn(() => c);
	c.limit = vi.fn(() => Promise.resolve(rows));
	return c;
}

/** delete(table).where(cond) */
function deleteChain() {
	const c: any = {};
	c.where = vi.fn(() => Promise.resolve());
	return c;
}

/** update(table).set(v).where(cond) */
function updateChain() {
	const c: any = {};
	c.set = vi.fn(() => c);
	c.where = vi.fn(() => Promise.resolve());
	return c;
}

const RECORD = {
	txHash: "0xabc",
	amount: "1000",
	networkId: "base",
	payee: "0xpayee",
	settledAt: 1_700_000_000_000,
	receipt: "signed-receipt",
};

describe("settlement DLQ", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.insert.mockImplementation(() => insertChain());
		mocks.del.mockImplementation(() => deleteChain());
		mocks.update.mockImplementation(() => updateChain());
	});

	it("refuses to queue a settlement with no receipt", async () => {
		// settlements.receipt is NOT NULL, so such an entry is a dead row.
		const ok = await addSettlementToDlq(
			{ ...RECORD, receipt: undefined as unknown as string },
			"boom",
		);
		expect(ok).toBe(false);
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("stores the full payload so the row can be rebuilt", async () => {
		const ok = await addSettlementToDlq(RECORD, "db timeout");

		expect(ok).toBe(true);
		expect(mocks.insert).toHaveBeenCalledTimes(1);

		const builder: any = mocks.insert.mock.results[0].value;
		const values = builder.values.mock.calls[0][0];
		expect(values).toMatchObject({
			txHash: "0xabc",
			networkId: "base",
			amount: "1000",
			payee: "0xpayee",
			receipt: "signed-receipt",
		});
		// Must conflict-target the idempotency key, not blindly insert.
		expect(builder.onConflictDoUpdate).toHaveBeenCalled();
	});

	it("returns false and flags critical when the queue write itself fails", async () => {
		mocks.insert.mockImplementation(() => {
			throw new Error("db down");
		});

		const ok = await addSettlementToDlq(RECORD, "original failure");

		// False, not a throw: the caller is already on an error path and must
		// surface the ORIGINAL failure, not this one.
		expect(ok).toBe(false);
	});

	it("drains nothing when the queue is empty", async () => {
		mocks.select.mockImplementation(() => selectChain([]));

		const result = await drainSettlementDlq();

		expect(result).toMatchObject({ scanned: 0, recovered: 0, failed: 0, abandoned: 0 });
		expect(mocks.del).not.toHaveBeenCalled();
	});

	it("replays a queued entry into settlements and deletes it", async () => {
		mocks.select.mockImplementation(() =>
			selectChain([{ id: "q1", ...RECORD, attempts: 1, settledAt: new Date(RECORD.settledAt) }]),
		);

		const result = await drainSettlementDlq();

		expect(result).toMatchObject({ scanned: 1, recovered: 1, failed: 0 });
		// One insert (the settlement) + one delete (the queue row).
		expect(mocks.insert).toHaveBeenCalledTimes(1);
		expect(mocks.del).toHaveBeenCalledTimes(1);
	});

	it("is idempotent: the settlement insert must be ON CONFLICT DO NOTHING", async () => {
		mocks.select.mockImplementation(() =>
			selectChain([{ id: "q1", ...RECORD, attempts: 1, settledAt: new Date(RECORD.settledAt) }]),
		);

		await drainSettlementDlq();

		// Without this, a concurrent drain (or a crash between insert and
		// delete) would double-credit the user.
		const builder: any = mocks.insert.mock.results[0].value;
		expect(builder.onConflictDoNothing).toHaveBeenCalled();
	});

	it("backs off and keeps the row when the replay fails", async () => {
		mocks.select.mockImplementation(() =>
			selectChain([{ id: "q1", ...RECORD, attempts: 1, settledAt: new Date(RECORD.settledAt) }]),
		);
		mocks.insert.mockImplementation(() => {
			throw new Error("still failing");
		});

		const result = await drainSettlementDlq();

		expect(result).toMatchObject({ scanned: 1, recovered: 0, failed: 1, abandoned: 0 });
		// Row retained for a later attempt, and pushed into the future.
		expect(mocks.del).not.toHaveBeenCalled();
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});
});
