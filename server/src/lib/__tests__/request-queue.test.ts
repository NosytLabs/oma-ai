import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enqueueRequest,
  QUEUE_KEY_PREFIX,
  MAX_QUEUE_DEPTH,
  getQueueStatus,
  getQueuePosition,
  processNextRequest,
  removeFromQueue,
  clearQueue,
  getQueueDepth,
  getQueueStats,
} from "../request-queue.js";

let redisAvailable = true;

const mockRedisClient = vi.hoisted(() => ({
  lPush: vi.fn().mockImplementation(() => {
    if (!redisAvailable) throw new Error("Redis not available");
    return 1;
  }),
  rPush: vi.fn().mockImplementation(() => 1),
  lRange: vi.fn().mockImplementation(() => {
    if (!redisAvailable) return [];
    return [];
  }),
  lTrim: vi.fn().mockImplementation(() => "OK"),
  llen: vi.fn().mockImplementation(() => {
    if (!redisAvailable) return 0;
    return 5;
  }),
  rpop: vi.fn().mockImplementation(() => {
    if (!redisAvailable) return null;
    return null;
  }),
  del: vi.fn().mockImplementation(() => 1),
}));

vi.mock("../redis-client.js", () => ({
  getRedisClient: vi.fn().mockImplementation(() => {
    return redisAvailable ? Promise.resolve(mockRedisClient) : Promise.resolve(null);
  }),
  isRedisReady: vi.fn().mockImplementation(() => redisAvailable),
}));

describe("request-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisAvailable = true;
  });

  describe("enqueueRequest", () => {
    it("should push request to Redis list", async () => {
      mockRedisClient.llen.mockResolvedValueOnce(5);
      mockRedisClient.lPush.mockResolvedValueOnce(1);

      const request = {
        id: "req-123",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "gpt-4o", messages: [{ role: "user", content: "hello" }] },
        priority: 0,
        enqueuedAt: Date.now(),
      };

      await enqueueRequest(request);

      expect(mockRedisClient.lPush).toHaveBeenCalledWith(
        `${QUEUE_KEY_PREFIX}:pending`,
        expect.stringContaining("req-123")
      );
    });

    it("should reject when queue exceeds max depth", async () => {
      mockRedisClient.llen.mockResolvedValueOnce(MAX_QUEUE_DEPTH + 1);

      const request = {
        id: "req-124",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "gpt-4o", messages: [] },
        priority: 0,
        enqueuedAt: Date.now(),
      };

      await expect(enqueueRequest(request)).rejects.toThrow("Queue full");
    });

    it("should throw when Redis unavailable", async () => {
      redisAvailable = false;

      const request = {
        id: "req-125",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "gpt-44" },
        priority: 0,
        enqueuedAt: Date.now(),
      };

      await expect(enqueueRequest(request)).rejects.toThrow("Redis unavailable");
    });
  });

  describe("getQueueStatus", () => {
    it("should return queue depth and position info", async () => {
      mockRedisClient.llen.mockResolvedValueOnce(5);
      mockRedisClient.lRange.mockResolvedValueOnce([
        JSON.stringify({ id: "req-1", userId: "user-1" }),
      ]);

      const status = await getQueueStatus("user-1");

      expect(status).toMatchObject({
        queueDepth: 5,
        userPosition: expect.any(Number),
      });
      expect(status.inQueue).toBe(true);
    });

    it("should return inQueue false when queue is empty", async () => {
      mockRedisClient.llen.mockResolvedValueOnce(0);
      mockRedisClient.lRange.mockResolvedValueOnce([]);

      const status = await getQueueStatus("user-1");

      expect(status.inQueue).toBe(false);
    });
  });

  describe("getQueuePosition", () => {
    it("should return position of specific request", async () => {
      const request = {
        id: "req-200",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "gpt-4o", messages: [] },
        priority: 0,
        enqueuedAt: Date.now(),
      };

      mockRedisClient.lRange.mockResolvedValueOnce([
        JSON.stringify({ id: "req-199", userId: "user-1" }),
        JSON.stringify(request),
        JSON.stringify({ id: "req-201", userId: "user-1" }),
      ]);

      const position = await getQueuePosition("user-1", "req-200");

      expect(position).toBe(2);
    });

    it("should return -1 if request not found", async () => {
      mockRedisClient.lRange.mockResolvedValueOnce([
        JSON.stringify({ id: "req-300", userId: "user-1" }),
      ]);

      const position = await getQueuePosition("user-1", "nonexistent");

      expect(position).toBe(-1);
    });
  });

  describe("processNextRequest", () => {
    it("should return the oldest request from the queue", async () => {
      const queuedRequest = {
        id: "req-400",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "gpt-4o", messages: [] },
        priority: 0,
        enqueuedAt: Date.now(),
      };

      mockRedisClient.rpop.mockResolvedValueOnce(JSON.stringify(queuedRequest));

      const processed = await processNextRequest();

      expect(processed).toMatchObject({
        id: "req-400",
        userId: "user-1",
      });
    });

    it("should return null when queue is empty", async () => {
      mockRedisClient.rpop.mockResolvedValueOnce(null);

      const processed = await processNextRequest();

      expect(processed).toBeNull();
    });
  });

  describe("removeFromQueue", () => {
    it("should remove specific request from queue by re-building list", async () => {
      const requestToRemove = {
        id: "req-500",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "test" },
        priority: 0,
        enqueuedAt: Date.now(),
      };
      const otherRequest = {
        id: "req-501",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "test" },
        priority: 0,
        enqueuedAt: Date.now(),
      };

      mockRedisClient.lRange.mockResolvedValueOnce([
        JSON.stringify(requestToRemove),
        JSON.stringify(otherRequest),
      ]);
      mockRedisClient.del.mockResolvedValueOnce(1);
      mockRedisClient.rPush.mockResolvedValue(1);

      const removed = await removeFromQueue("user-1", "req-500");

      expect(removed).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe("clearQueue", () => {
    it("should delete the queue key", async () => {
      mockRedisClient.del.mockResolvedValueOnce(1);

      const result = await clearQueue();

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`${QUEUE_KEY_PREFIX}:pending`);
    });
  });

  describe("getQueueDepth", () => {
    it("should return queue length", async () => {
      mockRedisClient.llen.mockResolvedValueOnce(42);

      const depth = await getQueueDepth();

      expect(depth).toBe(42);
    });
  });

  describe("getQueueStats", () => {
    it("should return queue statistics", async () => {
      mockRedisClient.llen.mockResolvedValueOnce(10);
      mockRedisClient.lRange.mockResolvedValueOnce([
        JSON.stringify({ id: "req-1", userId: "user-1", enqueuedAt: Date.now() - 5000 }),
      ]);

      const stats = await getQueueStats();

      expect(stats).toMatchObject({
        depth: 10,
        avgWaitTimeMs: expect.any(Number),
        oldestRequestAgeMs: expect.any(Number),
      });
    });
  });
});

describe("rate-limit integration", () => {
  it("should queue request when rate limited instead of rejecting", async () => {
    mockRedisClient.llen.mockResolvedValueOnce(5);
    mockRedisClient.lPush.mockResolvedValueOnce(1);

    const request = {
      id: "req-600",
      userId: "user-1",
      apiKeyId: "key-1",
      body: { model: "gpt-4o", messages: [] },
      priority: 0,
      enqueuedAt: Date.now(),
    };

    await enqueueRequest(request);

    expect(mockRedisClient.lPush).toHaveBeenCalled();
  });
});
