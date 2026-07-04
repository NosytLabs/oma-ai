import { db } from '../db/client.js'
import { stakingTiers } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { getRedisClient } from '../lib/redis-client.js'
import { config } from '../config.js'

export async function getStakingDiscount(userId: string): Promise<number> {
  const redis = await getRedisClient()
  const cacheKey = `staking:discount:${userId}`

  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached && typeof cached === 'string') return JSON.parse(cached)
    } catch {
      // Cache read failure is non-critical, fallback to DB
    }
  }

  try {
    const [tier] = await db
      .select({ discountPercent: stakingTiers.discountPercent })
      .from(stakingTiers)
      .where(eq(stakingTiers.userId, userId))
      .limit(1);

    const discount = tier?.discountPercent ?? 0

    if (redis) {
      try {
        await redis.setEx(cacheKey, Math.round(config.AFFINITY_TTL_MS / 1000), JSON.stringify(discount))
      } catch {
        // Cache write failure is non-critical
      }
    }

    return discount
  } catch {
    return 0
  }
}
