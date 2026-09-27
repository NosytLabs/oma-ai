import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/client.js";
import { creditBalances, deposits, paymentCreditClaims } from "../db/schema.js";

vi.mock("viem", async () => {
		const actual = await vi.importActual("viem");
		return {
				...actual,
				createPublicClient: vi.fn(),
				http: vi.fn(),
				formatUnits: vi.fn((value: bigint) => (Number(value) / 1e6).toString()),
				parseAbi: vi.fn(() => [{ type: "event", name: "Transfer", inputs: [] }]),
				getAddress: vi.fn((addr: string) => addr.toLowerCase()),
				base: { id: 8453, name: "Base" },
		};
});

// Crediting now runs several SELECTs across different tables inside one
// transaction (deposit-recovery probes `deposits`, then payment-credit probes
// `paymentCreditClaims`, `deposits` again under a row lock, and
// `paymentCreditPolicy`). A single queued return value cannot serve those, so
// the mock dispatches on the table handed to .from(). It also exposes .for(),
// because payment-credit takes a SELECT ... FOR UPDATE row lock.
const selectRows = new Map<unknown, unknown[]>();
function setSelectRows(table: unknown, rows: unknown[]) {
	selectRows.set(table, rows);
}
function makeSelect() {
	const chain: Record<string, unknown> = {};
	let table: unknown;
	const settle = () => {
		const rows = selectRows.get(table) ?? [];
		const thenable: Promise<unknown[]> & { for: unknown } = Promise.resolve(rows) as never;
		thenable.for = vi.fn(() => Promise.resolve(rows));
		return thenable;
	};
	chain.from = vi.fn((t: unknown) => {
		table = t;
		return chain;
	});
	chain.where = vi.fn(() => chain);
	chain.limit = vi.fn(settle);
	return chain;
}

vi.mock("../db/client.js", () => ({
		db: {
				select: vi.fn(),
				insert: vi.fn(),
				update: vi.fn(),
				transaction: vi.fn(),
		},
}));

vi.mock("../lib/logger.js", () => ({
		logger: {
				info: vi.fn(),
				debug: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				fatal: vi.fn(),
		},
}));

vi.mock("../config.js", () => ({
		config: {
				USDC_DEPOSIT_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				CHAIN_RPC_URL: "https://mainnet.base.org",
				// Unit tests must not reach the chain. The credit path only skips its
				// on-chain receipt/block verification when the facilitator is in mock
				// mode, so the config double has to say so explicitly.
				FACILITATOR_MODE: "mock",
				NODE_ENV: "test",
		},
}));

import { logger } from "../lib/logger.js";
import { config as _config } from "../config.js";
import * as depositRecovery from "../lib/deposit-recovery.js";

const mockClient = {
		getBlockNumber: vi.fn(),
		getLogs: vi.fn(),
};

describe("deposit-recovery lib", () => {
		beforeEach(() => {
				// resetAllMocks (not clearAllMocks) so queued mockResolvedValueOnce
				// values from prior tests are dropped; clearAllMocks keeps them and
				// every test after the first consumed a stale value (queue shift bug).
				vi.resetAllMocks();
				selectRows.clear();
				setSelectRows(deposits, []);
				vi.mocked(db.select as any).mockImplementation(() => makeSelect());

				vi.mocked(db.insert as any).mockReturnValue({
						values: vi.fn().mockReturnThis(),
						returning: vi.fn().mockResolvedValue([{ id: "dep_123", userId: "usr_abc12345" }]),
						onConflictDoUpdate: vi.fn().mockResolvedValue({}),
						// payment-credit claims a payment with ON CONFLICT DO NOTHING, so the
						// insert double has to answer that branch too. Returning one row means
						// this worker won the claim, which is the path these tests assert.
						onConflictDoNothing: vi.fn().mockReturnValue({
							returning: vi.fn().mockResolvedValue([
								{ networkId: "base", txHash: "0xabc", creditedUserId: "usr_abc12345", creditedCents: "10" },
							]),
						}),
				});

				vi.mocked(db.update as any).mockReturnValue({
						set: vi.fn().mockReturnThis(),
						where: vi.fn().mockReturnThis(),
						returning: vi.fn().mockResolvedValue([{ id: "dep_123" }]),
				});
				vi.mocked((db as any).transaction).mockImplementation(async (fn: any) => fn(db));

				mockClient.getBlockNumber.mockResolvedValue(1000n);
		});

		afterEach(() => {
				vi.restoreAllMocks();
		});

		describe("processTransfer", () => {
				it("skips transfer to non-deposit address", async () => {
						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc",
								args: { from: "0xfrom", to: "0xother", value: 1_000_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(db.select).not.toHaveBeenCalled();
				});

				it("skips dust transfers below minimum", async () => {
						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc",
								args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 50_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(logger.debug).toHaveBeenCalledWith(
								expect.objectContaining({ amountUsdCents: 5 }),
								"[deposit-recovery] skipping dust transfer",
						);
				});

				it("skips transfer with no recorded deposit (wallet-only flow)", async () => {
						setSelectRows(deposits, []);

						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc",
								args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(logger.debug).toHaveBeenCalledWith(
								expect.objectContaining({ txHash: "0xabc" }),
								"[deposit-recovery] no recorded deposit for txHash, skipping (wallet-submitted deposits only)",
						);
						expect(db.insert).not.toHaveBeenCalled();
				});

		it("marks existing pending deposit as completed and credits balance", async () => {
						setSelectRows(deposits, [{
										id: "dep_123",
										userId: "usr_abc12345",
										txHash: "0xabc",
										amountUsd: "1.00",
										status: "pending",
										fromAddress: "0xfrom",
								}]);

						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc",
								args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(db.update).toHaveBeenCalled();
						// Two rows now, not one: the durable claim that makes crediting
					// idempotent, and the balance upsert it credits.
					expect(db.insert).toHaveBeenCalledWith(paymentCreditClaims);
					expect(db.insert).toHaveBeenCalledWith(creditBalances);
						expect(logger.info).toHaveBeenCalledWith(
								expect.objectContaining({ depositId: "dep_123" }),
								"[deposit-recovery] marked pending deposit as completed and credited balance",
						);
				});

				it("marks pending deposit as completed even without fromAddress (legacy rows)", async () => {
						setSelectRows(deposits, [{
										id: "dep_nomemo",
										userId: "usr_real_user_id",
										txHash: "0xabc_nomemo",
										amountUsd: "5.00",
										status: "pending",
										fromAddress: null,
								}]);

						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc_nomemo",
								args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 5_000_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(db.update).toHaveBeenCalled();
						// Two rows now, not one: the durable claim that makes crediting
					// idempotent, and the balance upsert it credits.
					expect(db.insert).toHaveBeenCalledWith(paymentCreditClaims);
					expect(db.insert).toHaveBeenCalledWith(creditBalances);
						expect(logger.info).toHaveBeenCalledWith(
								expect.objectContaining({ depositId: "dep_nomemo" }),
								"[deposit-recovery] marked pending deposit as completed and credited balance",
						);
				});

				it("skips already completed deposit", async () => {
						setSelectRows(deposits, [{
										id: "dep_123",
										userId: "usr_abc12345",
										txHash: "0xabc",
										amountUsd: "1.00",
										status: "completed",
										fromAddress: "0xfrom",
								}]);

						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc",
								args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(logger.debug).toHaveBeenCalledWith(
								expect.objectContaining({ txHash: "0xabc" }),
								"[deposit-recovery] deposit already completed, skipping",
						);
						expect(db.update).not.toHaveBeenCalled();
				});

				it("blocks concurrent completion when another worker already claimed the deposit", async () => {
						setSelectRows(deposits, [{
										id: "dep_123", userId: "usr_abc12345", txHash: "0xabc",
										amountUsd: "1.00", status: "pending", fromAddress: "0xfrom",
								}]);
						// Another worker already holds the claim. Under the durable-credit
						// design that is a payment_credit_claims row, so payment-credit short
						// circuits through previouslyCredited() and never inserts a new claim.
						setSelectRows(paymentCreditClaims, [
							{ networkId: "base", txHash: "0xabc", creditedUserId: "usr_abc12345", creditedCents: "10" },
						]);
						vi.mocked(db.update as any).mockReturnValueOnce({
								set: vi.fn().mockReturnThis(),
								where: vi.fn().mockReturnThis(),
								returning: vi.fn().mockResolvedValue([]),
						});

						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc",
								args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(db.insert).not.toHaveBeenCalled();
				});

				it("fails deposit when on-chain sender does not match recorded fromAddress", async () => {
						setSelectRows(deposits, [{
										id: "dep_123",
										userId: "usr_abc12345",
										txHash: "0xabc",
										amountUsd: "1.00",
										status: "pending",
										fromAddress: "0xrealowner",
								}]);

						await depositRecovery.processTransfer(mockClient as any, {
								transactionHash: "0xabc",
								args: { from: "0xsomeoneelse", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
						}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

						expect(db.update).toHaveBeenCalled();
						expect(logger.warn).toHaveBeenCalledWith(
								expect.objectContaining({ sender: "0xsomeoneelse", recorded: "0xrealowner" }),
								"[deposit-recovery] sender does not match recorded fromAddress, marked deposit failed",
						);
				});
		});

		it("rejects a deposit when the declared amount exceeds the verified transfer", async () => {
			setSelectRows(deposits, [{
					id: "dep_123",
					userId: "usr_abc12345",
					txHash: "0xabc",
					amountUsd: "10.00",
					status: "pending",
					fromAddress: "0xfrom",
				}]);

			await depositRecovery.processTransfer(mockClient as any, {
				transactionHash: "0xabc",
				args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
			}, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

			expect(db.insert).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalledWith(
				expect.objectContaining({ declaredAmountCents: 1000, verifiedAmountCents: 100 }),
				"[deposit-recovery] declared amount does not match verified transfer, marked deposit failed",
			);
		});

		describe("runRecoveryIteration", () => {
				it("returns fromBlock when no new blocks", async () => {
						mockClient.getBlockNumber.mockResolvedValueOnce(500n);

						const result = await depositRecovery.runRecoveryIteration(mockClient as any, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 600n);

						expect(result).toBe(600n);
						expect(mockClient.getLogs).not.toHaveBeenCalled();
				});

				it("processes logs and returns current block", async () => {
						mockClient.getBlockNumber.mockResolvedValueOnce(1000n);
						mockClient.getLogs.mockResolvedValueOnce([
								{ transactionHash: "0xabc", args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n } },
						]);

						setSelectRows(deposits, []);

						const result = await depositRecovery.runRecoveryIteration(mockClient as any, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 500n);

						expect(result).toBe(1000n);
						expect(mockClient.getLogs).toHaveBeenCalled();
				});

				it("continues on individual log processing error", async () => {
						mockClient.getBlockNumber.mockResolvedValueOnce(1000n);
						mockClient.getLogs.mockResolvedValueOnce([
								{ transactionHash: "0xabc", args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n } },
								{ transactionHash: "0xdef", args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 2_000_000n } },
						]);

						const mockFrom = vi.fn().mockReturnThis();
						const mockWhere = vi.fn().mockReturnThis();
						const mockLimit = vi.fn()
								.mockRejectedValueOnce(new Error("DB connection lost"))
								.mockResolvedValueOnce([]);

						vi.mocked(db.select as any).mockReturnValue({
								from: mockFrom,
								where: mockWhere,
								limit: mockLimit,
						});

						const result = await depositRecovery.runRecoveryIteration(mockClient as any, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 500n);

						expect(result).toBe(1000n);
						expect(logger.error).toHaveBeenCalledWith(
								expect.objectContaining({ txHash: "0xabc" }),
								"[deposit-recovery] failed to process transfer, continuing",
						);
				});

				it("returns fromBlock on getLogs error", async () => {
						mockClient.getBlockNumber.mockResolvedValueOnce(1000n);
						mockClient.getLogs.mockRejectedValueOnce(new Error("RPC error"));

						const result = await depositRecovery.runRecoveryIteration(mockClient as any, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 500n);

						expect(result).toBe(500n);
						expect(logger.error).toHaveBeenCalledWith(
								expect.objectContaining({ fromBlock: 500n }),
								"[deposit-recovery] iteration failed, will retry from same block",
						);
				});
		});
});
