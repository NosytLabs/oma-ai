import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A broadcast-but-unconfirmed settlement used to exist only as an error
 * message: the hash rode back to the client, and a client that dropped it
 * left an unknown on-chain transaction nobody could reconcile. These tests
 * lock in the durable record: idempotent writes, a reconciler that resolves
 * rows from real receipts, and a parser that never turns an unknown status
 * into a reassuring one.
 */

const mocks = vi.hoisted(() => ({
	insert: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
	getTransactionReceipt: vi.fn(),
}));

vi.mock("../../db/client.js", () => ({
	db: {
		insert: (...a: unknown[]) => mocks.insert(...a),
		select: (...a: unknown[]) => mocks.select(...a),
		update: (...a: unknown[]) => mocks.update(...a),
	},
}));
vi.mock("../../lib/logger.js", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../../lib/rpc-client.js", () => ({
	getPublicClient: () => ({
		getTransactionReceipt: (...a: unknown[]) => mocks.getTransactionReceipt(...a),
	}),
}));

import {
	PENDING_SETTLEMENT_STATE,
	PENDING_SETTLEMENT_TRANSITIONS,
	canTransitionPendingSettlementState,
	countSettlementsAwaitingResolution,
	markSettlementDurable,
	parsePendingSettlementState,
	reconcilePendingSettlements,
	recordPendingSettlement,
	recordVerifiedSettlement,
} from "../pending-settlements";
import { pendingSettlements, settlements } from "../../db/schema.js";

function insertChain() {
	const c: any = {};
	c.values = vi.fn(() => c);
	c.onConflictDoNothing = vi.fn(() => Promise.resolve());
	return c;
}

const record = {
	txHash: "0xabc",
	networkId: "base",
	amount: "1.50",
	payee: "0xpayee",
	payer: "0xpayer",
};

beforeEach(() => {
	mocks.insert.mockReset();
	mocks.select.mockReset();
	mocks.update.mockReset();
});

describe("parsePendingSettlementState", () => {
	it("knows the three states", () => {
		expect(parsePendingSettlementState("pending")).toBe(
			PENDING_SETTLEMENT_STATE.Pending,
		);
		expect(parsePendingSettlementState("confirmed")).toBe(
			PENDING_SETTLEMENT_STATE.Confirmed,
		);
		expect(parsePendingSettlementState("reverted")).toBe(
			PENDING_SETTLEMENT_STATE.Reverted,
		);
	});

	it("never degrades an unknown status into a reassuring one", () => {
		expect(parsePendingSettlementState("CONFIRMED")).toBeNull();
		expect(parsePendingSettlementState("ok")).toBeNull();
		expect(parsePendingSettlementState(undefined)).toBeNull();
		expect(parsePendingSettlementState(null)).toBeNull();
	});
});

describe("recordPendingSettlement", () => {
	it("inserts idempotently and reports success", async () => {
		const chain = insertChain();
		mocks.insert.mockReturnValue(chain);
		await expect(recordPendingSettlement(record, new Error("timeout"))).resolves.toBe(true);
		expect(chain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				txHash: "0xabc",
				status: PENDING_SETTLEMENT_STATE.Pending,
			}),
		);
		expect(chain.onConflictDoNothing).toHaveBeenCalled();
	});

	it("survives a database failure without throwing", async () => {
		mocks.insert.mockImplementation(() => {
			throw new Error("db down");
		});
		await expect(recordPendingSettlement(record, new Error("timeout"))).resolves.toBe(false);
	});
});

describe("recordVerifiedSettlement", () => {
	it("inserts a verified row idempotently", async () => {
		const chain = insertChain();
		mocks.insert.mockReturnValue(chain);
		await expect(recordVerifiedSettlement(record)).resolves.toBe(true);
		expect(chain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				txHash: "0xabc",
				status: PENDING_SETTLEMENT_STATE.Verified,
			}),
		);
		expect(chain.onConflictDoNothing).toHaveBeenCalled();
	});

	it("survives a database failure without throwing", async () => {
		mocks.insert.mockImplementation(() => {
			throw new Error("db down");
		});
		await expect(recordVerifiedSettlement(record)).resolves.toBe(false);
	});
});

describe("markSettlementDurable", () => {
	it("narrows the update to rows still in flight", async () => {
		const c: any = {};
		c.set = vi.fn(() => c);
		c.where = vi.fn(() => Promise.resolve());
		mocks.update.mockReturnValue(c);
		await markSettlementDurable("0xabc", "base");
		expect(c.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: PENDING_SETTLEMENT_STATE.Settled }),
		);
		expect(c.where).toHaveBeenCalled();
	});

	it("never throws when the update fails", async () => {
		mocks.update.mockImplementation(() => {
			throw new Error("db down");
		});
		await expect(markSettlementDurable("0xabc", "base")).resolves.toBeUndefined();
	});
});

describe("parsePendingSettlementState -- extended vocabulary", () => {
	it("knows verified and settled", () => {
		expect(parsePendingSettlementState("verified")).toBe(
			PENDING_SETTLEMENT_STATE.Verified,
		);
		expect(parsePendingSettlementState("settled")).toBe(
			PENDING_SETTLEMENT_STATE.Settled,
		);
	});
});

describe("pending settlement transitions", () => {
	it("covers every state exactly once", () => {
		expect(Object.keys(PENDING_SETTLEMENT_TRANSITIONS).sort()).toEqual(
			Object.values(PENDING_SETTLEMENT_STATE).sort(),
		);
	});

	it("resolves both in-flight states the same way", () => {
		for (const from of [PENDING_SETTLEMENT_STATE.Verified, PENDING_SETTLEMENT_STATE.Pending]) {
			expect(canTransitionPendingSettlementState(from, PENDING_SETTLEMENT_STATE.Settled)).toBe(true);
			expect(canTransitionPendingSettlementState(from, PENDING_SETTLEMENT_STATE.Confirmed)).toBe(true);
			expect(canTransitionPendingSettlementState(from, PENDING_SETTLEMENT_STATE.Reverted)).toBe(true);
		}
	});

	it("keeps resolved states terminal", () => {
		for (const from of [PENDING_SETTLEMENT_STATE.Confirmed, PENDING_SETTLEMENT_STATE.Reverted, PENDING_SETTLEMENT_STATE.Settled]) {
			expect(PENDING_SETTLEMENT_TRANSITIONS[from]).toEqual([]);
		}
	});
});

/** Chainable select double that dispatches rows on the table passed to .from(). */
function selectChain(rowsByTable: Map<unknown, unknown[]>) {
	let table: unknown;
	const chain: any = {};
	chain.from = vi.fn((t: unknown) => {
		table = t;
		return chain;
	});
	chain.where = vi.fn(() => chain);
	chain.orderBy = vi.fn(() => chain);
	chain.groupBy = vi.fn(() => Promise.resolve(rowsByTable.get(table) ?? []));
	chain.limit = vi.fn(() => Promise.resolve(rowsByTable.get(table) ?? []));
	return chain;
}

function updateChain() {
	const c: any = {};
	c.set = vi.fn(() => c);
	c.where = vi.fn(() => Promise.resolve());
	return c;
}

const inFlightRow = {
	id: "row-1",
	txHash: "0xabc",
	networkId: "base",
	amount: "1.50",
	payee: "0xpayee",
	payer: "0xpayer",
	status: PENDING_SETTLEMENT_STATE.Verified,
	broadcastAt: new Date(),
	receipt: null,
	resolvedAt: null,
	lastError: null,
	createdAt: new Date(),
};

describe("reconcilePendingSettlements -- verified rows are visible", () => {
	beforeEach(() => {
		mocks.getTransactionReceipt.mockReset();
	});

	it("closes a verified row whose settlement is already durable", async () => {
		const rows = new Map<unknown, unknown[]>([
			[pendingSettlements, [inFlightRow]],
			[settlements, [{ id: "settlement-1" }]],
		]);
		mocks.select.mockImplementation(() => selectChain(rows));
		const update = updateChain();
		mocks.update.mockReturnValue(update);

		const result = await reconcilePendingSettlements();

		expect(result.scanned).toBe(1);
		expect(result.recoveredSettled).toBe(1);
		expect(update.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: PENDING_SETTLEMENT_STATE.Settled }),
		);
		expect(mocks.getTransactionReceipt).not.toHaveBeenCalled();
	});

	it("resolves a verified row from its chain receipt", async () => {
		const rows = new Map<unknown, unknown[]>([
			[pendingSettlements, [inFlightRow]],
			[settlements, []],
		]);
		mocks.select.mockImplementation(() => selectChain(rows));
		const update = updateChain();
		mocks.update.mockReturnValue(update);
		mocks.getTransactionReceipt.mockResolvedValue({ status: "success" });

		const result = await reconcilePendingSettlements();

		expect(result.confirmed).toBe(1);
		expect(update.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: PENDING_SETTLEMENT_STATE.Confirmed }),
		);
	});

	it("leaves a verified row with no durable row and no receipt counted, not lost", async () => {
		const rows = new Map<unknown, unknown[]>([
			[pendingSettlements, [inFlightRow]],
			[settlements, []],
		]);
		mocks.select.mockImplementation(() => selectChain(rows));
		mocks.update.mockReturnValue(updateChain());
		mocks.getTransactionReceipt.mockResolvedValue(null);

		const result = await reconcilePendingSettlements();

		expect(result.stillVerified).toBe(1);
		expect(result.confirmed).toBe(0);
		expect(result.recoveredSettled).toBe(0);
	});
});

describe("countSettlementsAwaitingResolution", () => {
	it("counts verified and confirmed rows alongside pending", async () => {
		const rows = new Map<unknown, unknown[]>([
			[
				pendingSettlements,
				[
					{ status: "pending", count: 2 },
					{ status: "verified", count: 3 },
					{ status: "confirmed", count: 5 },
				],
			],
		]);
		mocks.select.mockImplementation(() => selectChain(rows));

		await expect(countSettlementsAwaitingResolution()).resolves.toEqual({
			pending: 2,
			verified: 3,
			confirmed: 5,
		});
	});
});
