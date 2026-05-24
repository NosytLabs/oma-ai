import { getRedisClient, isRedisReady } from "./redis-client.js";
import type { ChatMessage } from "../inference/types.js";

export interface QueuedRequest {
  id: string;
  userId: string;
  apiKeyId: string;
  body: {
    model: string;
    messages?: ChatMessage[];
    stream?: boolean;
    [key: string]: unknown;
  };
  priority: number;
  enqueuedAt: number;
}

export interface QueueStatus {
  queueDepth: number;
  userPosition: number;
  estimatedWaitSeconds: number;
  inQueue: boolean;
}

export const QUEUE_KEY_PREFIX = "oma:queue";
export const MAX_QUEUE_DEPTH = 1000;
export const DEFAULT_PROCESS_INTERVAL_MS = 1000;

function getQueueKey(): string {
  return `${QUEUE_KEY_PREFIX}:pending`;
}

export async function enqueueRequest(request: QueuedRequest): Promise<void> {
  const redis = await getRedisClient();
  const ready = isRedisReady();

  if (!redis || !ready) {
    throw new Error("Redis unavailable");
  }

  try {
    const depth = (await redis.llen(getQueueKey())) as number;
    if (depth >= MAX_QUEUE_DEPTH) {
      throw new Error(`Queue full: ${MAX_QUEUE_DEPTH} requests pending`);
    }

    await redis.rPush(getQueueKey(), JSON.stringify(request));
  } catch (err) {
    console.error("[queue] Failed to enqueue request:", err);
    throw err;
  }
}

export async function getQueueStatus(userId: string): Promise<QueueStatus> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) {
    return { queueDepth: 0, userPosition: -1, estimatedWaitSeconds: 0, inQueue: false };
  }

  try {
    const queueDepth = (await redis.llen(getQueueKey())) as number;

    const items = await redis.lRange(getQueueKey(), 0, -1);
    let userPosition = -1;
    for (let i = 0; i < items.length; i++) {
      const parsed = JSON.parse(items[i]) as QueuedRequest;
      if (parsed.userId === userId) {
        userPosition = i + 1;
        break;
      }
    }

    const estimatedWaitSeconds = userPosition > 0
      ? Math.ceil((userPosition * DEFAULT_PROCESS_INTERVAL_MS) / 1000)
      : 0;

    return {
      queueDepth,
      userPosition,
      estimatedWaitSeconds,
      inQueue: userPosition > 0,
    };
  } catch (err) {
    console.error("[queue] Failed to get queue status:", err);
    return { queueDepth: -1, userPosition: -1, estimatedWaitSeconds: 0, inQueue: false };
  }
}

export async function getQueuePosition(userId: string, requestId: string): Promise<number> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return -1;

  try {
    const items = await redis.lRange(getQueueKey(), 0, -1);
    for (let i = 0; i < items.length; i++) {
      const parsed = JSON.parse(items[i]) as QueuedRequest;
      if (parsed.userId === userId && parsed.id === requestId) {
        return i + 1;
      }
    }
    return -1;
  } catch (err) {
    console.error("[queue] Failed to get queue position:", err);
    return -1;
  }
}

export async function processNextRequest(): Promise<QueuedRequest | null> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return null;

  try {
    const item = await redis.lPop(getQueueKey());
    if (!item) return null;

    return JSON.parse(item as string) as QueuedRequest;
  } catch (err) {
    console.error("[queue] Failed to process next request:", err);
    return null;
  }
}

export async function peekQueue(count: number = 10): Promise<QueuedRequest[]> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return [];

  try {
    const items = await redis.lRange(getQueueKey(), 0, count - 1);
    return items.map((item) => JSON.parse(item as string) as QueuedRequest);
  } catch (err) {
    console.error("[queue] Failed to peek queue:", err);
    return [];
  }
}

export async function removeFromQueue(userId: string, requestId: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return false;

  try {
    const items = await redis.lRange(getQueueKey(), 0, -1);
    for (const item of items) {
      const parsed = JSON.parse(item as string) as QueuedRequest;
      if (parsed.userId === userId && parsed.id === requestId) {
        await redis.lRem(getQueueKey(), 1, item);
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("[queue] Failed to remove from queue:", err);
    return false;
  }
}

export async function clearQueue(): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return false;

  try {
    await redis.del(getQueueKey());
    return true;
  } catch (err) {
    console.error("[queue] Failed to clear queue:", err);
    return false;
  }
}

let processingFlag = false;
let processInterval: ReturnType<typeof setInterval> | null = null;

export function startQueueProcessor(handler?: (request: QueuedRequest) => Promise<void>): void {
  if (processInterval) return;
  processInterval = setInterval(async () => {
    if (processingFlag) return;
    processingFlag = true;
    try {
      const depth = await getQueueDepth();
      if (depth > 0) {
        const request = await processNextRequest();
        if (request && handler) {
          await handler(request);
        }
      }
    } catch (err) {
      console.error("[queue] Background processor error:", err);
    } finally {
      processingFlag = false;
    }
  }, DEFAULT_PROCESS_INTERVAL_MS);
  if (processInterval && typeof processInterval === "object" && "unref" in processInterval) {
    processInterval.unref();
  }
}

export function stopQueueProcessor(): void {
  if (processInterval) {
    clearInterval(processInterval);
    processInterval = null;
  }
}

export async function getQueueDepth(): Promise<number> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return 0;
  try {
    return (await redis.llen(getQueueKey())) as number;
  } catch {
    return 0;
  }
}

export async function getQueueStats(): Promise<{
  depth: number;
  avgWaitTimeMs: number;
  oldestRequestAgeMs: number;
}> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) {
    return { depth: 0, avgWaitTimeMs: 0, oldestRequestAgeMs: 0 };
  }

  try {
    const depth = (await redis.llen(getQueueKey())) as number;
    const items = await redis.lRange(getQueueKey(), 0, -1);

    let oldestRequestAgeMs = 0;
    if (items.length > 0) {
      const oldest = JSON.parse(items[0] as string) as QueuedRequest;
      oldestRequestAgeMs = Date.now() - oldest.enqueuedAt;
    }

    return {
      depth,
      avgWaitTimeMs: 0,
      oldestRequestAgeMs,
    };
  } catch (err) {
    console.error("[queue] Failed to get queue stats:", err);
    return { depth: -1, avgWaitTimeMs: -1, oldestRequestAgeMs: -1 };
  }
}
