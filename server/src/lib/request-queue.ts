import { getRedisClient, isRedisReady } from "./redis-client.js";
import { logger } from "./logger.js";
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

const ENQUEUE_SCRIPT = `
local queue_key = KEYS[1]
local user_set_key = KEYS[2]
local max_depth = tonumber(ARGV[1])
local request_json = ARGV[2]
local user_id = ARGV[3]
local request_id = ARGV[4]

local depth = redis.call('LLEN', queue_key)
if depth >= max_depth then
  return {-1, depth}
end

redis.call('RPUSH', queue_key, request_json)
redis.call('HINCRBY', queue_key, '_user:' .. user_id, 1)
redis.call('SADD', user_set_key, request_id)
return {1, depth + 1}
`;

const DEQUEUE_SCRIPT = `
local queue_key = KEYS[1]
local user_set_key = KEYS[2]
local user_id = ARGV[1]

local item = redis.call('LPOP', queue_key)
if not item then
  return {nil, 0}
end

local ok, parsed = pcall(cjson.decode, item)
if not ok then
  return {item, 0}
end

local uid = parsed.userId or user_id
local reqId = parsed.id or ''

redis.call('HINCRBY', queue_key, '_user:' .. uid, -1)
if reqId ~= '' then
  redis.call('SREM', user_set_key, reqId)
end
return {item, 1}
`;

export async function enqueueRequest(request: QueuedRequest): Promise<void> {
  const redis = await getRedisClient();
  const ready = isRedisReady();

  if (!redis || !ready) {
    throw new Error("Redis unavailable");
  }

  try {
    const jsonStr = JSON.stringify(request);
    const userQueueKey = `oma:queue:users:${request.userId}`;
    const result = await (redis.eval as (script: string, numkeys: number, ...args: (string | number)[]) => Promise<number[]>)(
      ENQUEUE_SCRIPT,
      2,
      getQueueKey(),
      userQueueKey,
      MAX_QUEUE_DEPTH,
      jsonStr,
      request.userId,
      request.id
    );

    if (result[0] === -1) {
      throw new Error(`Queue full: ${MAX_QUEUE_DEPTH} requests pending`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Queue full")) throw err;
    logger.error({ err, requestId: request.id, userId: request.userId }, "[queue] Failed to enqueue request");
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

    const count = await redis.hGet(getQueueKey(), `_user:${userId}`);
    const userCount = count ? parseInt(count, 10) : 0;
    const userPosition = userCount > 0 ? 1 : -1;

    const estimatedWaitSeconds = userPosition > 0
      ? Math.ceil((userCount * DEFAULT_PROCESS_INTERVAL_MS) / 1000)
      : 0;

    return {
      queueDepth,
      userPosition,
      estimatedWaitSeconds,
      inQueue: userPosition > 0,
    };
  } catch (err) {
    logger.error({ err, userId }, "[queue] Failed to get queue status");
    return { queueDepth: -1, userPosition: -1, estimatedWaitSeconds: 0, inQueue: false };
  }
}

export async function getQueuePosition(userId: string, requestId: string): Promise<number> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return -1;

  try {
    const exists = await redis.sIsMember(`oma:queue:users:${userId}`, requestId);
    return exists ? 1 : -1;
  } catch (err) {
    logger.error({ err, userId, requestId }, "[queue] Failed to get queue position");
    return -1;
  }
}

export async function processNextRequest(): Promise<QueuedRequest | null> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return null;

  try {
    const result = await (redis.eval as (script: string, numkeys: number, ...args: (string | number)[]) => Promise<(string | number | null)[]>)(
      DEQUEUE_SCRIPT,
      2,
      getQueueKey(),
      `oma:queue:users:placeholder`,
      ""
    );

    if (!result[0]) return null;

    const item = result[0] as string;
    const parsed = JSON.parse(item) as QueuedRequest;

    if (result[1] === 0) {
      const userQueueKey = `oma:queue:users:${parsed.userId}`;
      const multi = redis.multi();
      multi.hIncrBy(getQueueKey(), `_user:${parsed.userId}`, -1);
      multi.sRem(userQueueKey, parsed.id);
      await multi.exec();
    }

    return parsed;
  } catch (err) {
    logger.error({ err }, "[queue] Failed to process next request");
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
    logger.error({ err }, "[queue] Failed to peek queue");
    return [];
  }
}

export async function removeFromQueue(userId: string, requestId: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return false;

  try {
    const isMember = await redis.sIsMember(`oma:queue:users:${userId}`, requestId);
    if (!isMember) return false;

    const items = await redis.lRange(getQueueKey(), 0, -1);
    for (const item of items) {
      const parsed = JSON.parse(item as string) as QueuedRequest;
      if (parsed.userId === userId && parsed.id === requestId) {
        const multi = redis.multi();
        multi.lRem(getQueueKey(), 1, item);
        multi.hIncrBy(getQueueKey(), `_user:${userId}`, -1);
        multi.sRem(`oma:queue:users:${userId}`, requestId);
        await multi.exec();
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.error({ err, userId, requestId }, "[queue] Failed to remove from queue");
    return false;
  }
}

export async function clearQueue(): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return false;

  try {
    const userKeys = await redis.keys("oma:queue:users:*");
    const keysToDelete = [getQueueKey(), ...userKeys];
    if (userKeys.length > 0) {
      await redis.del(keysToDelete);
    } else {
      await redis.del(getQueueKey());
    }
    return true;
  } catch (err) {
    logger.error({ err }, "[queue] Failed to clear queue");
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
      logger.error({ err }, "[queue] Background processor error");
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
    logger.error({ err }, "[queue] Failed to get queue stats");
    return { depth: -1, avgWaitTimeMs: -1, oldestRequestAgeMs: -1 };
  }
}
