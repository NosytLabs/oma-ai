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
  lRem: vi.fn().mockImplementation(() => 1),
  lPop: vi.fn().mockImplementation(() => {
    if (!redisAvailable) return null;
    return null;
  }),
  multi: vi.fn().mockImplementation(() => ({
    rPush: vi.fn().mockReturnThis(),
    hIncrBy: vi.fn().mockReturnThis(),
    sAdd: vi.fn().mockReturnThis(),
    sRem: vi.fn().mockReturnThis(),
    lRem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
  hGet: vi.fn().mockImplementation(() => {
    if (!redisAvailable) return null;
    return null;
  }),
  hIncrBy: vi.fn().mockImplementation(() => 0),
  sAdd: vi.fn().mockImplementation(() => 1),
  sIsMember: vi.fn().mockImplementation(() => false),
  sRem: vi.fn().mockImplementation(() => 1),
  keys: vi.fn().mockImplementation(() => []),
  eval: vi.fn().mockImplementation((script: string, _options: { keys: string[]; arguments: (string | number)[] }) => {
    if (!redisAvailable) throw new Error("Redis not available");
    if (typeof script === 'string' && script.includes('RPUSH')) {
      return [1, 6];
    }
    if (typeof script === 'string' && script.includes('LPOP')) {
      return [null, 0];
    }
    return [1, 0];
  }),
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
    it("should push request to Redis list using eval", async () => {
      mockRedisClient.eval.mockResolvedValueOnce([1, 6]);

      const request = {
        id: "req-123",
        userId: "user-1",
        apiKeyId: "key-1",
        body: { model: "gpt-4o", messages: [{ role: "user", content: "hello" }] },
        priority: 0,
        enqueuedAt: Date.now(),
      };

      await enqueueRequest(request);

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining("RPUSH"),
        {
          keys: [`${QUEUE_KEY_PREFIX}:pending`, `oma:queue:users:user-1`],
          arguments: [
            expect.any(String),
            expect.stringContaining("req-123"),
            "user-1",
            "req-123",
          ],
        }
      );
    });

    it("should reject when queue exceeds max depth", async () => {
      mockRedisClient.eval.mockResolvedValueOnce([-1, MAX_QUEUE_DEPTH]);

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
      mockRedisClient.hGet.mockResolvedValueOnce("2");

      const status = await getQueueStatus("user-1");

      expect(status).toMatchObject({
        queueDepth: 5,
        userPosition: 1,
      });
      expect(status.inQueue).toBe(true);
    });

    it("should return inQueue false when user not in queue", async () => {
      mockRedisClient.llen.mockResolvedValueOnce(0);
      mockRedisClient.hGet.mockResolvedValueOnce(null);

      const status = await getQueueStatus("user-1");

      expect(status.inQueue).toBe(false);
      expect(status.userPosition).toBe(-1);
    });
  });

  describe("getQueuePosition", () => {
    it("should return 1 if request is in queue", async () => {
      mockRedisClient.sIsMember.mockResolvedValueOnce(true);

      const position = await getQueuePosition("user-1", "req-200");

      expect(position).toBe(1);
    });

    it("should return -1 if request not found", async () => {
      mockRedisClient.sIsMember.mockResolvedValueOnce(false);

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

      mockRedisClient.eval.mockResolvedValueOnce([JSON.stringify(queuedRequest), 1]);

      const processed = await processNextRequest();

      expect(processed).toMatchObject({
        id: "req-400",
        userId: "user-1",
      });
    });

    it("should return null when queue is empty", async () => {
      mockRedisClient.eval.mockResolvedValueOnce([null, 0]);

      const processed = await processNextRequest();

      expect(processed).toBeNull();
    });
  });

  describe("removeFromQueue", () => {
    it("should remove specific request from queue", async () => {
      mockRedisClient.sIsMember.mockResolvedValueOnce(true);

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
      mockRedisClient.multi.mockReturnValueOnce({
        lRem: vi.fn().mockReturnThis(),
        hIncrBy: vi.fn().mockReturnThis(),
        sRem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });

      const removed = await removeFromQueue("user-1", "req-500");

      expect(removed).toBe(true);
    });

    it("should return false when request not in user set", async () => {
      mockRedisClient.sIsMember.mockResolvedValueOnce(false);

      const removed = await removeFromQueue("user-1", "nonexistent");

      expect(removed).toBe(false);
    });
  });

  describe("clearQueue", () => {
    it("should delete the queue key", async () => {
      mockRedisClient.keys.mockResolvedValueOnce([]);
      mockRedisClient.del.mockResolvedValueOnce(1);

      const result = await clearQueue();

      expect(result).toBe(true);
      expect(mockRedisClient.keys).toHaveBeenCalledWith("oma:queue:users:*");
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
    mockRedisClient.eval.mockResolvedValueOnce([1, 6]);

    const request = {
      id: "req-600",
      userId: "user-1",
      apiKeyId: "key-1",
      body: { model: "gpt-4o", messages: [] },
      priority: 0,
      enqueuedAt: Date.now(),
    };

    await enqueueRequest(request);

    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining("RPUSH"),
      {
        keys: [`${QUEUE_KEY_PREFIX}:pending`, `oma:queue:users:user-1`],
        arguments: [
          expect.any(String),
          expect.stringContaining("req-600"),
          "user-1",
          "req-600",
        ],
      }
    );
  });
});
