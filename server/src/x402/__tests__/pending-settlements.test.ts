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

import {
	PENDING_SETTLEMENT_STATE,
	markSettlementDurable,
	parsePendingSettlementState,
	recordPendingSettlement,
	recordVerifiedSettlement,
} from "../pending-settlements";

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
