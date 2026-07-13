import { getRedisClient } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROCESSING_LOCK_TTL = 30;

export async function checkIdempotencyKey(
  key: string,
  ttlSeconds: number = 86400
): Promise<{ isNew: boolean; existingResponse?: unknown } | null> {
  if (!UUID_REGEX.test(key)) {
    return null;
  }

  const redis = await getRedisClient();
  if (!redis) return null;

  const lockKey = `idem:${key}`;
  const processingData = JSON.stringify({ status: "processing", createdAt: Date.now() });

  try {
    const existing = await redis.get(lockKey);
    
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed && parsed.status === "processing") {
          const lockTtl = await redis.ttl(lockKey);
          if (lockTtl <= ttlSeconds - PROCESSING_LOCK_TTL) {
            await redis.del(lockKey);
            const reSet = await redis.setNX(lockKey, processingData);
            if (reSet) {
              await redis.expire(lockKey, PROCESSING_LOCK_TTL);
              return { isNew: true };
            }
            const retryExisting = await redis.get(lockKey);
            if (retryExisting) {
              return { isNew: false, existingResponse: JSON.parse(retryExisting) };
            }
            return { isNew: true };
          }
          // Fresh processing lock: poll for the completed result instead of
          // returning the "processing" placeholder to the concurrent caller.
          const deadline = Date.now() + Math.max(lockTtl, PROCESSING_LOCK_TTL) * 1000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 200));
            const current = await redis.get(lockKey);
            if (!current) break;
            const cp = JSON.parse(current);
            if (cp.status !== "processing") {
              return { isNew: false, existingResponse: cp };
            }
          }
          // Timed out (the original request likely errored): allow a retry.
          return { isNew: true };
        }
        return { isNew: false, existingResponse: parsed };
      } catch {
        return { isNew: true };
      }
    }

    const wasSet = await redis.setNX(lockKey, processingData);
    
    if (!wasSet) {
      const retryExisting = await redis.get(lockKey);
      if (retryExisting) {
        return { isNew: false, existingResponse: JSON.parse(retryExisting) };
      }
      return { isNew: true };
    }

    await redis.expire(lockKey, PROCESSING_LOCK_TTL);
    return { isNew: true };
  } catch (err) {
    logger.error({ err, key }, "[idempotency] Error");
    return { isNew: true };
  }
}

export async function releaseIdempotencyLock(key: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  if (!UUID_REGEX.test(key)) return;
  await redis.del(`idem:${key}`);
}

export async function storeIdempotencyResult(
  key: string,
  response: unknown,
  ttlSeconds: number = 86400
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.setEx(`idem:${key}`, ttlSeconds, JSON.stringify(response));
}


