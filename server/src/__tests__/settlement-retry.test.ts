import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDlq = {
  getSettlementDlqEntries: vi.fn().mockResolvedValue([]),
  retrySettlementFromDlq: vi.fn().mockResolvedValue(null),
  addSettlementToDlq: vi.fn().mockResolvedValue(undefined),
  getSettlementDlqLength: vi.fn().mockResolvedValue(0),
  removeSettlementDlqEntry: vi.fn().mockResolvedValue(true),
};

const mockFacilitator = {
  verifyPayment: vi.fn().mockResolvedValue({ valid: true, txHash: "0xabc", amount: "10", networkId: "evm" }),
  settlePaymentAsync: vi.fn().mockResolvedValue({ settled: true, receipt: { txHash: "0xabc" } }),
};

vi.mock("../lib/dlq.js", () => mockDlq);
vi.mock("../x402/facilitator.js", () => mockFacilitator);
vi.mock("../config.js", () => ({
  config: { TREASURY_BASE_ADDRESS: "0xpayee", NODE_ENV: "test" },
}));

const { processSettlementDLQ, retrySettlementById, discardSettlementFromDlq, getSettlementDlqStatus } = await import("../lib/settlement-retry.js");

function makeEntry(overrides: Partial<{ orderId: string; amount: string; chain: string; attempts: number; lastError: string; createdAt: string }> = {}) {
  return {
    orderId: "order-1",
    amount: "10.00",
    chain: "evm",
    attempts: 1,
    lastError: "previous error",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDlq.getSettlementDlqEntries.mockResolvedValue([]);
  mockDlq.retrySettlementFromDlq.mockResolvedValue(null);
  mockDlq.addSettlementToDlq.mockResolvedValue(undefined);
  mockDlq.getSettlementDlqLength.mockResolvedValue(0);
  mockDlq.removeSettlementDlqEntry.mockResolvedValue(true);
  mockFacilitator.verifyPayment.mockResolvedValue({ valid: true, txHash: "0xabc", amount: "10", networkId: "evm" });
  mockFacilitator.settlePaymentAsync.mockResolvedValue({ settled: true, receipt: { txHash: "0xabc" } });
});

describe("settlement-retry", () => {
  describe("processSettlementDLQ", () => {
    it("should return empty results when queue is empty", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(0);

      const results = await processSettlementDLQ();
      expect(results).toEqual([]);
      expect(mockDlq.getSettlementDlqEntries).not.toHaveBeenCalled();
    });

    it("should process entries and return results", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry()]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: true, txHash: "0xabc", amount: "10", networkId: "evm" });
      mockFacilitator.settlePaymentAsync.mockResolvedValue({ settled: true, receipt: {} });

      const results = await processSettlementDLQ();
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].orderId).toBe("order-1");
    });

    it("should pop entry on success", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry()]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: true, txHash: "0xabc", amount: "10", networkId: "evm" });
      mockFacilitator.settlePaymentAsync.mockResolvedValue({ settled: true, receipt: {} });

      await processSettlementDLQ();
      expect(mockDlq.retrySettlementFromDlq).toHaveBeenCalledOnce();
    });

    it("should pop entry on permanent failure (attempts >= MAX_RETRIES)", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 3 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: false, error: "expired" });

      const results = await processSettlementDLQ();
      expect(results[0].permanentlyFailed).toBe(true);
      expect(mockDlq.retrySettlementFromDlq).toHaveBeenCalledOnce();
    });

    it("should NOT pop entry on retryable failure (attempts < MAX_RETRIES)", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 1 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: false, error: "temporary error" });

      const results = await processSettlementDLQ();
      expect(results[0].permanentlyFailed).toBe(false);
      expect(mockDlq.retrySettlementFromDlq).not.toHaveBeenCalled();
    });

    it("should NOT re-add to DLQ on verification failure", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 1 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: false, error: "temp error" });

      await processSettlementDLQ();
      expect(mockDlq.addSettlementToDlq).not.toHaveBeenCalled();
    });

    it("should re-add to DLQ on retryable settlement failure", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 1 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: true, txHash: "0xabc", amount: "10", networkId: "evm" });
      mockFacilitator.settlePaymentAsync.mockResolvedValue({ settled: false, error: "gas too low" });

      await processSettlementDLQ();
      expect(mockDlq.addSettlementToDlq).toHaveBeenCalledWith("order-1", "10.00", "evm", "gas too low", 2);
    });

    it("should re-add to DLQ on exception with retryable attempts", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 1 })]);
      mockFacilitator.verifyPayment.mockRejectedValue(new Error("network timeout"));

      await processSettlementDLQ();
      expect(mockDlq.addSettlementToDlq).toHaveBeenCalledWith("order-1", "10.00", "evm", "network timeout", 2);
    });

    it("should NOT re-add to DLQ on exception with permanent failure", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 3 })]);
      mockFacilitator.verifyPayment.mockRejectedValue(new Error("network timeout"));

      await processSettlementDLQ();
      expect(mockDlq.addSettlementToDlq).not.toHaveBeenCalled();
    });

    it("should NOT re-add to DLQ on permanent verification failure", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 3 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: false, error: "expired" });

      await processSettlementDLQ();
      expect(mockDlq.addSettlementToDlq).not.toHaveBeenCalled();
    });

    it("should handle settlement failure with retry", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 1 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: true, txHash: "0xabc", amount: "10", networkId: "evm" });
      mockFacilitator.settlePaymentAsync.mockResolvedValue({ settled: false, error: "insufficient gas" });

      const results = await processSettlementDLQ();
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("insufficient gas");
      expect(results[0].permanentlyFailed).toBe(false);
      expect(mockDlq.addSettlementToDlq).toHaveBeenCalledWith("order-1", "10.00", "evm", "insufficient gas", 2);
    });

    it("should process up to RETRY_BATCH_SIZE entries", async () => {
      const entries = Array.from({ length: 10 }, (_, i) => makeEntry({ orderId: `order-${i}`, attempts: 3 }));
      mockDlq.getSettlementDlqLength.mockResolvedValue(10);
      mockDlq.getSettlementDlqEntries.mockResolvedValue(entries);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: false, error: "expired" });

      const results = await processSettlementDLQ();
      expect(results).toHaveLength(10);
    });
  });

  describe("retrySettlementById", () => {
    it("should find and retry a specific entry by orderId", async () => {
      const entries = [
        makeEntry({ orderId: "order-a" }),
        makeEntry({ orderId: "order-b" }),
      ];
      mockDlq.getSettlementDlqLength.mockResolvedValue(2);
      mockDlq.getSettlementDlqEntries.mockResolvedValue(entries);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: true, txHash: "0xhash", amount: "10", networkId: "evm" });
      mockFacilitator.settlePaymentAsync.mockResolvedValue({ settled: true, receipt: {} });

      const result = await retrySettlementById("order-b");
      expect(result.success).toBe(true);
      expect(result.orderId).toBe("order-b");
    });

    it("should return error when orderId not found", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ orderId: "order-a" })]);

      const result = await retrySettlementById("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Settlement not found in DLQ");
      expect(result.permanentlyFailed).toBe(true);
    });

    it("should pop on success", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry()]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: true, txHash: "0x", amount: "10", networkId: "evm" });
      mockFacilitator.settlePaymentAsync.mockResolvedValue({ settled: true, receipt: {} });

      await retrySettlementById("order-1");
      expect(mockDlq.retrySettlementFromDlq).toHaveBeenCalledOnce();
    });

    it("should pop on permanent failure", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 3 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: false, error: "expired" });

      await retrySettlementById("order-1");
      expect(mockDlq.retrySettlementFromDlq).toHaveBeenCalledOnce();
    });

    it("should NOT pop on retryable failure", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(1);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([makeEntry({ attempts: 1 })]);
      mockFacilitator.verifyPayment.mockResolvedValue({ valid: false, error: "temp" });

      await retrySettlementById("order-1");
      expect(mockDlq.retrySettlementFromDlq).not.toHaveBeenCalled();
    });
  });

  describe("discardSettlementFromDlq", () => {
    it("should remove a specific entry by orderId", async () => {
      const entries = [
        makeEntry({ orderId: "order-a" }),
        makeEntry({ orderId: "order-b" }),
        makeEntry({ orderId: "order-c" }),
      ];
      mockDlq.getSettlementDlqLength.mockResolvedValue(3);
      mockDlq.getSettlementDlqEntries.mockResolvedValue(entries);

      const result = await discardSettlementFromDlq("order-b");
      expect(result).toBe(true);
      expect(mockDlq.removeSettlementDlqEntry).toHaveBeenCalledWith(1);
    });

    it("should return false when orderId not found", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(2);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([
        makeEntry({ orderId: "order-a" }),
        makeEntry({ orderId: "order-b" }),
      ]);

      const result = await discardSettlementFromDlq("nonexistent");
      expect(result).toBe(false);
      expect(mockDlq.removeSettlementDlqEntry).not.toHaveBeenCalled();
    });

    it("should return false when queue is empty", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(0);

      const result = await discardSettlementFromDlq("order-1");
      expect(result).toBe(false);
    });
  });

  describe("getSettlementDlqStatus", () => {
    it("should return zero counts for empty queue", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(0);

      const status = await getSettlementDlqStatus();
      expect(status).toEqual({ total: 0, retryable: 0, permanentlyFailed: 0 });
    });

    it("should categorize retryable entries (attempts < MAX_RETRIES)", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(2);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([
        makeEntry({ attempts: 1 }),
        makeEntry({ attempts: 2 }),
      ]);

      const status = await getSettlementDlqStatus();
      expect(status).toEqual({ total: 2, retryable: 2, permanentlyFailed: 0 });
    });

    it("should categorize permanently failed entries (attempts >= MAX_RETRIES)", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(3);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([
        makeEntry({ attempts: 1 }),
        makeEntry({ attempts: 3 }),
        makeEntry({ attempts: 5 }),
      ]);

      const status = await getSettlementDlqStatus();
      expect(status).toEqual({ total: 3, retryable: 1, permanentlyFailed: 2 });
    });

    it("should handle mixed entries", async () => {
      mockDlq.getSettlementDlqLength.mockResolvedValue(4);
      mockDlq.getSettlementDlqEntries.mockResolvedValue([
        makeEntry({ attempts: 0 }),
        makeEntry({ attempts: 1 }),
        makeEntry({ attempts: 3 }),
        makeEntry({ attempts: 10 }),
      ]);

      const status = await getSettlementDlqStatus();
      expect(status).toEqual({ total: 4, retryable: 2, permanentlyFailed: 2 });
    });
  });
});
