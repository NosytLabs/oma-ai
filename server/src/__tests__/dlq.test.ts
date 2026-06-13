import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedis = {
  lPush: vi.fn().mockResolvedValue(1),
  lRange: vi.fn().mockResolvedValue([]),
  lTrim: vi.fn().mockResolvedValue("OK"),
  lLen: vi.fn().mockResolvedValue(0),
  del: vi.fn().mockResolvedValue(1),
  rPush: vi.fn().mockResolvedValue(1),
};

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

const { addToDlq, addSettlementToDlq, getDlqEntries, getSettlementDlqEntries, retryFromDlq, retrySettlementFromDlq, clearDlq, removeSettlementDlqEntry, getSettlementDlqLength } = await import("../lib/dlq.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.lPush.mockResolvedValue(1);
  mockRedis.lRange.mockResolvedValue([]);
  mockRedis.lTrim.mockResolvedValue("OK");
  mockRedis.lLen.mockResolvedValue(0);
  mockRedis.del.mockResolvedValue(1);
  mockRedis.rPush.mockResolvedValue(1);
});

describe("DLQ", () => {
  describe("addToDlq", () => {
    it("should add entry with correct structure", async () => {
      await addToDlq("openai", '{"prompt":"test"}', "timeout error");

      expect(mockRedis.lPush).toHaveBeenCalledOnce();
      const [key, value] = mockRedis.lPush.mock.calls[0];
      expect(key).toBe("webhook:dlq");
      const entry = JSON.parse(value);
      expect(entry).toEqual({
        provider: "openai",
        body: '{"prompt":"test"}',
        error: "timeout error",
        timestamp: expect.any(String),
      });
    });

    it("should use custom list name", async () => {
      await addToDlq("anthropic", "body", "err", "settlement");
      expect(mockRedis.lPush.mock.calls[0][0]).toBe("settlement:dlq");
    });

    it("should handle Redis unavailable gracefully", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      await expect(addToDlq("openai", "body", "err")).resolves.toBeUndefined();
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedis.lPush.mockRejectedValueOnce(new Error("connection lost"));

      await expect(addToDlq("openai", "body", "err")).resolves.toBeUndefined();
    });
  });

  describe("addSettlementToDlq", () => {
    it("should add settlement entry with correct structure", async () => {
      await addSettlementToDlq("order-123", "10.50", "evm", "insufficient funds", 2);

      expect(mockRedis.lPush).toHaveBeenCalledOnce();
      const [key, value] = mockRedis.lPush.mock.calls[0];
      expect(key).toBe("settlement:dlq");
      const entry = JSON.parse(value);
      expect(entry).toEqual({
        orderId: "order-123",
        amount: "10.50",
        chain: "evm",
        lastError: "insufficient funds",
        attempts: 2,
        createdAt: expect.any(String),
      });
    });

    it("should default attempts to 1", async () => {
      await addSettlementToDlq("order-456", "5.00", "solana", "error");

      const entry = JSON.parse(mockRedis.lPush.mock.calls[0][1]);
      expect(entry.attempts).toBe(1);
    });

    it("should handle Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      await expect(addSettlementToDlq("o", "1", "evm", "e")).resolves.toBeUndefined();
    });
  });

  describe("getDlqEntries", () => {
    it("should return parsed entries within range", async () => {
      const entries = [
        JSON.stringify({ provider: "a", body: "b", error: "c", timestamp: "2026-01-01" }),
        JSON.stringify({ provider: "d", body: "e", error: "f", timestamp: "2026-01-02" }),
      ];
      mockRedis.lRange.mockResolvedValueOnce(entries);

      const result = await getDlqEntries(0, 2);
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe("a");
      expect(result[1].provider).toBe("d");
      expect(mockRedis.lRange).toHaveBeenCalledWith("webhook:dlq", 0, 1);
    });

    it("should return empty array when Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await getDlqEntries(0, 10);
      expect(result).toEqual([]);
    });

    it("should handle malformed JSON gracefully", async () => {
      mockRedis.lRange.mockResolvedValueOnce(["not-valid-json"]);
      const result = await getDlqEntries(0, 1);
      expect(result).toEqual([]);
    });
  });

  describe("getSettlementDlqEntries", () => {
    it("should return settlement entries", async () => {
      const entry = JSON.stringify({ orderId: "o1", amount: "1", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" });
      mockRedis.lRange.mockResolvedValueOnce([entry]);

      const result = await getSettlementDlqEntries(0, 5);
      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe("o1");
      expect(mockRedis.lRange).toHaveBeenCalledWith("settlement:dlq", 0, 4);
    });

    it("should return empty array when Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await getSettlementDlqEntries(0, 10);
      expect(result).toEqual([]);
    });
  });

  describe("retryFromDlq", () => {
    it("should pop and return the first entry", async () => {
      const entry = JSON.stringify({ provider: "openai", body: "{}", error: "err", timestamp: "ts" });
      mockRedis.lRange.mockResolvedValueOnce([entry]);
      mockRedis.lTrim.mockResolvedValueOnce("OK");

      const result = await retryFromDlq();
      expect(result).toEqual({ provider: "openai", body: "{}", error: "err", timestamp: "ts" });
      expect(mockRedis.lRange).toHaveBeenCalledWith("webhook:dlq", 0, 0);
      expect(mockRedis.lTrim).toHaveBeenCalledWith("webhook:dlq", 1, -1);
    });

    it("should return null when queue is empty", async () => {
      mockRedis.lRange.mockResolvedValueOnce([]);

      const result = await retryFromDlq();
      expect(result).toBeNull();
      expect(mockRedis.lTrim).not.toHaveBeenCalled();
    });

    it("should return null when Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await retryFromDlq();
      expect(result).toBeNull();
    });
  });

  describe("retrySettlementFromDlq", () => {
    it("should pop and return the first settlement entry", async () => {
      const entry = JSON.stringify({ orderId: "o1", amount: "1", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" });
      mockRedis.lRange.mockResolvedValueOnce([entry]);
      mockRedis.lTrim.mockResolvedValueOnce("OK");

      const result = await retrySettlementFromDlq();
      expect(result).toEqual({ orderId: "o1", amount: "1", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" });
      expect(mockRedis.lRange).toHaveBeenCalledWith("settlement:dlq", 0, 0);
      expect(mockRedis.lTrim).toHaveBeenCalledWith("settlement:dlq", 1, -1);
    });

    it("should return null when empty", async () => {
      mockRedis.lRange.mockResolvedValueOnce([]);
      const result = await retrySettlementFromDlq();
      expect(result).toBeNull();
    });

    it("should return null when Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await retrySettlementFromDlq();
      expect(result).toBeNull();
    });
  });

  describe("removeSettlementDlqEntry", () => {
    it("should remove entry at the specified index and preserve others", async () => {
      const entries = [
        { orderId: "o0", amount: "1", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
        { orderId: "o1", amount: "2", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
        { orderId: "o2", amount: "3", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
        { orderId: "o3", amount: "4", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
        { orderId: "o4", amount: "5", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
      ];
      mockRedis.lRange.mockResolvedValueOnce(entries.map((e) => JSON.stringify(e)));

      const result = await removeSettlementDlqEntry(2);
      expect(result).toBe(true);

      // Should delete the key and re-push the remaining 4 entries
      expect(mockRedis.del).toHaveBeenCalledWith("settlement:dlq");
      expect(mockRedis.rPush).toHaveBeenCalledOnce();

      const rPushArgs = mockRedis.rPush.mock.calls[0];
      expect(rPushArgs[0]).toBe("settlement:dlq");
      // rPush receives the entries array as a single argument (not spread)
      const remainingEntries = rPushArgs[1] as string[];
      expect(remainingEntries).toHaveLength(4);
      const orderIds = remainingEntries.map((v: string) => JSON.parse(v).orderId);
      expect(orderIds).toEqual(["o0", "o1", "o3", "o4"]);
    });

    it("should return false for out-of-bounds index", async () => {
      const entries = [{ orderId: "o0", amount: "1", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" }];
      mockRedis.lRange.mockResolvedValueOnce(entries.map((e) => JSON.stringify(e)));

      const result = await removeSettlementDlqEntry(5);
      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("should return false for empty queue", async () => {
      mockRedis.lRange.mockResolvedValueOnce([]);

      const result = await removeSettlementDlqEntry(0);
      expect(result).toBe(false);
    });

    it("should return false when Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await removeSettlementDlqEntry(0);
      expect(result).toBe(false);
    });

    it("should remove first element correctly", async () => {
      const entries = [
        { orderId: "o0", amount: "1", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
        { orderId: "o1", amount: "2", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
      ];
      mockRedis.lRange.mockResolvedValueOnce(entries.map((e) => JSON.stringify(e)));

      const result = await removeSettlementDlqEntry(0);
      expect(result).toBe(true);

      const remainingEntries = mockRedis.rPush.mock.calls[0][1] as string[];
      expect(remainingEntries).toHaveLength(1);
      expect(JSON.parse(remainingEntries[0]).orderId).toBe("o1");
    });

    it("should remove last element correctly", async () => {
      const entries = [
        { orderId: "o0", amount: "1", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
        { orderId: "o1", amount: "2", chain: "evm", attempts: 1, lastError: "e", createdAt: "2026" },
      ];
      mockRedis.lRange.mockResolvedValueOnce(entries.map((e) => JSON.stringify(e)));

      const result = await removeSettlementDlqEntry(1);
      expect(result).toBe(true);

      const remainingEntries = mockRedis.rPush.mock.calls[0][1] as string[];
      expect(remainingEntries).toHaveLength(1);
      expect(JSON.parse(remainingEntries[0]).orderId).toBe("o0");
    });
  });

  describe("getSettlementDlqLength", () => {
    it("should return correct length", async () => {
      mockRedis.lLen.mockResolvedValueOnce(7);
      const result = await getSettlementDlqLength();
      expect(result).toBe(7);
      expect(mockRedis.lLen).toHaveBeenCalledWith("settlement:dlq");
    });

    it("should return 0 when Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await getSettlementDlqLength();
      expect(result).toBe(0);
    });
  });

  describe("clearDlq", () => {
    it("should delete the entire list", async () => {
      await clearDlq("webhook");
      expect(mockRedis.del).toHaveBeenCalledWith("webhook:dlq");
    });

    it("should delete settlement list when specified", async () => {
      await clearDlq("settlement");
      expect(mockRedis.del).toHaveBeenCalledWith("settlement:dlq");
    });

    it("should handle Redis unavailable", async () => {
      const { getRedisClient } = await import("../lib/redis-client.js");
      (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await clearDlq();
      expect(result).toBe(false);
    });
  });
});
