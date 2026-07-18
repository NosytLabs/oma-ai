import { db } from '../db/client.js'
import { creditBalances } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { getRedisClient } from '../lib/redis-client.js'

const BALANCE_CACHE_TTL = 10

export async function getBalance(userId: string) {
  const redis = await getRedisClient()
  if (redis) {
    try {
      const cached = await redis.get(`balance:${userId}`)
      if (cached && typeof cached === 'string') return JSON.parse(cached)
    } catch {
      // Cache read failure is non-critical, fallback to DB
    }
  }

  const rows = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId))

  const result = !rows.length
    ? {
        balanceCents: '0',
        totalDepositedCents: '0',
        totalUsedCents: '0',
        lastActivityAt: null,
      }
    : {
        balanceCents: rows[0].balanceCents,
        totalDepositedCents: rows[0].totalDepositedCents,
        totalUsedCents: rows[0].totalUsedCents,
        lastActivityAt: rows[0].lastActivityAt,
      }

  if (redis) {
    redis.setEx(`balance:${userId}`, BALANCE_CACHE_TTL, JSON.stringify(result)).catch(() => {
      // Cache write failure is non-critical - DB is source of truth
    });
  }

  return result
}

export async function invalidateBalanceCache(userId: string) {
  const redis = await getRedisClient()
  if (!redis) return
  try {
    await redis.del(`balance:${userId}`)
  } catch {
    // Cache invalidation failure is non-critical
  }
}