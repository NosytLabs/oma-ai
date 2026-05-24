import { getRedisClient } from "../lib/redis-client.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROCESSING_LOCK_TTL = 30; // seconds — if handler crashes, lock auto-expires quickly

export async function checkIdempotencyKey(
  key: string,
  ttlSeconds: number = 86400
): Promise<{ isNew: boolean; existingResponse?: unknown } | null> {
  if (!UUID_REGEX.test(key)) {
    return null;
  }

  const redis = await getRedisClient();
  if (!redis) return null;
  
  const existing = await redis.get(`idem:${key}`);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      // If the key exists with status "processing" and the lock TTL has expired, treat as abandoned
      if (parsed && parsed.status === "processing") {
        const lockTtl = await redis.ttl(`idem:${key}`);
        // If TTL <= (total TTL - PROCESSING_LOCK_TTL), the processing lock has lapsed and we can allow retry
        if (lockTtl <= ttlSeconds - PROCESSING_LOCK_TTL) {
          await redis.del(`idem:${key}`);
          return { isNew: true };
        }
      }
      return { isNew: false, existingResponse: parsed };
    } catch {
      return { isNew: true };
    }
  }
  
  await redis.setEx(`idem:${key}`, PROCESSING_LOCK_TTL, JSON.stringify({ status: "processing" }));
  return { isNew: true };
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