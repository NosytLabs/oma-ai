import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/client.js";

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
  },
}));

import { logger } from "../lib/logger.js";
import { config as _config } from "../config.js";
import * as depositRecovery from "../lib/deposit-recovery.js";

const mockClient = {
  getBlockNumber: vi.fn(),
  getLogs: vi.fn(),
  getTransaction: vi.fn(),
};

describe("deposit-recovery lib", () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so queued mockResolvedValueOnce
    // values from prior tests are dropped; clearAllMocks keeps them and
    // every test after the first consumed a stale value (queue shift bug).
    vi.resetAllMocks();
    vi.mocked(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    vi.mocked(db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "dep_123", userId: "usr_abc12345" }]),
      onConflictDoUpdate: vi.fn().mockResolvedValue({}),
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

  describe("extractUserIdFromMemo", () => {
    it("extracts userId from valid oma- memo", () => {
      const result = depositRecovery.extractUserIdFromMemo("0x6f6d612d6162633132333435");
      expect(result).toBe("usr_abc12345");
    });

    it("returns null for invalid memo prefix", () => {
      const result = depositRecovery.extractUserIdFromMemo("0x74657374616263");
      expect(result).toBeNull();
    });

    it("returns null for short memo", () => {
      const result = depositRecovery.extractUserIdFromMemo("0x6f6d612d616263");
      expect(result).toBeNull();
    });

    it("handles 0x prefix correctly", () => {
      const result = depositRecovery.extractUserIdFromMemo("6f6d612d6162633132333435");
      expect(result).toBe("usr_abc12345");
    });
  });

  describe("processTransfer", () => {
    it("skips transfer to non-deposit address", async () => {
      mockClient.getTransaction.mockResolvedValueOnce({ input: "0x" });

      await depositRecovery.processTransfer(mockClient as any, {
        transactionHash: "0xabc",
        args: { from: "0xfrom", to: "0xother", value: 1_000_000n },
      }, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

      expect(db.select).not.toHaveBeenCalled();
    });

    it("skips dust transfers below minimum", async () => {
      mockClient.getTransaction.mockResolvedValueOnce({ input: "0x6f6d612d6162633132333435" });

      await depositRecovery.processTransfer(mockClient as any, {
        transactionHash: "0xabc",
        args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 50_000n },
      }, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ amountUsdCents: 5 }),
        "[deposit-recovery] skipping dust transfer",
      );
    });

    it("creates new deposit and credits balance for new tx", async () => {
      vi.mocked(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      });

      mockClient.getTransaction.mockResolvedValueOnce({
        input: "0x6f6d612d6162633132333435",
      });

      await depositRecovery.processTransfer(mockClient as any, {
        transactionHash: "0xabc",
        args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
      }, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

      expect(db.insert).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ amountUsdCents: 100 }),
        "[deposit-recovery] created and completed deposit, credited balance",
      );
    });

    it("marks existing pending deposit as completed and credits balance", async () => {
      vi.mocked(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([{
          id: "dep_123",
          userId: "usr_abc12345",
          txHash: "0xabc",
          amountUsd: "1.00",
          status: "pending",
        }]),
      });

      mockClient.getTransaction.mockResolvedValueOnce({
        input: "0x6f6d612d6162633132333435",
      });

      await depositRecovery.processTransfer(mockClient as any, {
        transactionHash: "0xabc",
        args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
      }, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ depositId: "dep_123" }),
        "[deposit-recovery] marked pending deposit as completed and credited balance",
      );
    });

    it("skips already completed deposit", async () => {
      vi.mocked(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([{
          id: "dep_123",
          userId: "usr_abc12345",
          txHash: "0xabc",
          amountUsd: "1.00",
          status: "completed",
        }]),
      });

      mockClient.getTransaction.mockResolvedValueOnce({
        input: "0x6f6d612d6162633132333435",
      });

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
      vi.mocked(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([{
          id: "dep_123", userId: "usr_abc12345", txHash: "0xabc",
          amountUsd: "1.00", status: "pending",
        }]),
      });
      vi.mocked(db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      });
      mockClient.getTransaction.mockResolvedValueOnce({ input: "0x6f6d612d6162633132333435" });

      await depositRecovery.processTransfer(mockClient as any, {
        transactionHash: "0xabc",
        args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
      }, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

      expect(db.insert).not.toHaveBeenCalled();
    });

    it("handles transaction with no input data", async () => {
      mockClient.getTransaction.mockResolvedValueOnce({ input: "0x" });

      await depositRecovery.processTransfer(mockClient as any, {
        transactionHash: "0xabc",
        args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
      }, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ txHash: "0xabc" }),
        "[deposit-recovery] no valid memo in transaction input",
      );
    });

    it("continues on RPC error in getTransaction", async () => {
      mockClient.getTransaction.mockRejectedValueOnce(new Error("RPC error"));

      await expect(depositRecovery.processTransfer(mockClient as any, {
        transactionHash: "0xabc",
        args: { from: "0xfrom", to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 1_000_000n },
      }, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).rejects.toThrow("RPC error");
    });
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
      mockClient.getTransaction.mockResolvedValueOnce({ input: "0x6f6d612d6162633132333435" });

      vi.mocked(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

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
      mockClient.getTransaction.mockRejectedValueOnce(new Error("RPC error")).mockResolvedValueOnce({ input: "0x6f6d612d6162633132333435" });

      vi.mocked(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
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