import { db } from '../db/client.js'
import { creditBalances, usageRecords, creditBatches, stakingTiers } from '../db/schema.js'
import { eq, sql, and, gt, asc, desc, lt } from 'drizzle-orm'
import { getRedisClient } from '../lib/redis-client.js'

const BALANCE_CACHE_TTL = 30

async function invalidateBalanceCache(userId: string) {
  const redis = await getRedisClient()
  if (!redis) return
  try {
    await redis.del(`balance:${userId}`)
  } catch {
    // Cache invalidation failure is non-critical
  }
}

const CREDIT_EXPIRY_DAYS = 90
const ACTIVE_EXTENSION_DAYS = 90

export function getExpiryDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + CREDIT_EXPIRY_DAYS)
  return d
}

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
    try {
      await redis.setEx(`balance:${userId}`, BALANCE_CACHE_TTL, JSON.stringify(result))
    } catch {
      // Cache write failure is non-critical
    }
  }

  return result
}

export async function addCredits(userId: string, amountCents: number) {
  const expiresAt = getExpiryDate()

  await db.transaction(async (tx) => {
    await tx.insert(creditBatches).values({
      userId,
      amountCents: String(amountCents),
      remainingCents: String(amountCents),
      expiresAt,
    })

    await tx.insert(creditBalances)
      .values({
        userId,
        balanceCents: String(amountCents),
        totalDepositedCents: String(amountCents),
        totalUsedCents: '0',
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: creditBalances.userId,
        set: {
          balanceCents: sql`${creditBalances.balanceCents} + ${amountCents}`,
          totalDepositedCents: sql`${creditBalances.totalDepositedCents} + ${amountCents}`,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        },
      })
  })

  await invalidateBalanceCache(userId)
}

export async function deductCredits(
  userId: string,
  costCents: number,
  markupCents: number,
  totalCents: number,
  model: string,
  provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra" | "tinyfish",
  apiKeyId: string,
  inputTokens: number,
  outputTokens: number,
  requestId: string,
  latencyMs?: number,
) {
  await db.transaction(async (tx) => {
    const activeBatches = await tx.select()
      .from(creditBatches)
      .where(and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.remainingCents, '0'),
        gt(creditBatches.expiresAt, new Date()),
      ))
      .orderBy(asc(creditBatches.expiresAt), desc(creditBatches.remainingCents))
      .for('update')

    if (!activeBatches.length) {
      throw new Error('Insufficient credits')
    }

    const totalAvailable = activeBatches.reduce((s, b) => s + Number(b.remainingCents), 0)
    if (totalAvailable < totalCents) {
      throw new Error('Insufficient credits')
    }

    let toConsume = totalCents
    for (const batch of activeBatches) {
      if (toConsume <= 0) break
      const remaining = Number(batch.remainingCents)
      const consume = Math.min(remaining, toConsume)
      const newRemaining = remaining - consume
      await tx.update(creditBatches)
        .set({ remainingCents: String(newRemaining) })
        .where(eq(creditBatches.id, batch.id))
      toConsume -= consume
    }

    const [newSum] = await tx.select({ total: sql`COALESCE(SUM(${creditBatches.remainingCents}), 0)` })
      .from(creditBatches)
      .where(and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.expiresAt, new Date()),
      ))

    const updated = await tx.update(creditBalances)
      .set({
        balanceCents: String(newSum?.total ?? 0),
        totalUsedCents: sql`${creditBalances.totalUsedCents} + ${totalCents}`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.userId, userId))
      .returning()

    if (!updated.length) {
      throw new Error('Insufficient credits')
    }

    await tx.insert(usageRecords).values({
      requestId,
      userId,
      costCents: String(costCents),
      markupCents: String(markupCents),
      totalCents: String(totalCents),
      model,
      provider,
      apiKeyId,
      inputTokens,
      outputTokens,
      latencyMs: latencyMs ?? null,
    })
  })

  await invalidateBalanceCache(userId)
}

export async function refundCredits(userId: string, amountCents: string, originalRequestId?: string) {
  const amt = Number(amountCents)
  if (amt <= 0) return

  const newExpiry = getExpiryDate()

  await db.transaction(async (tx) => {
    // Try to find the original batch from a recent usage record for the same request
    let oldExpiry: Date | null = null
    if (originalRequestId) {
      const [usage] = await tx.select()
        .from(usageRecords)
        .where(and(
          eq(usageRecords.requestId, originalRequestId),
          eq(usageRecords.userId, userId),
        ))
        .orderBy(desc(usageRecords.createdAt))
        .limit(1)
      if (usage) {
        const batchInfo = await tx.select({ expiresAt: creditBatches.expiresAt })
          .from(creditBatches)
          .where(and(
            eq(creditBatches.userId, userId),
            eq(creditBatches.amountCents, usage.totalCents),
          ))
          .orderBy(desc(creditBatches.expiresAt))
          .limit(1)
        if (batchInfo.length > 0) {
          oldExpiry = batchInfo[0].expiresAt
        }
      }
    }

    const effectiveExpiry = oldExpiry && oldExpiry < newExpiry ? oldExpiry : newExpiry

    await tx.insert(creditBatches).values({
      userId,
      amountCents: String(amt),
      remainingCents: String(amt),
      expiresAt: effectiveExpiry,
    })

    const [newSum] = await tx.select({ total: sql`COALESCE(SUM(${creditBatches.remainingCents}), 0)` })
      .from(creditBatches)
      .where(and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.expiresAt, new Date()),
      ))

    await tx.update(creditBalances)
      .set({
        balanceCents: String(newSum?.total ?? 0),
        totalUsedCents: sql`GREATEST(0, CAST(${creditBalances.totalUsedCents} AS NUMERIC) - ${amt})`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.userId, userId))
  })
}

export async function preflightDeduction(userId: string, totalCents: string): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      const activeBatches = await tx.select()
        .from(creditBatches)
        .where(and(
          eq(creditBatches.userId, userId),
          gt(creditBatches.remainingCents, '0'),
          gt(creditBatches.expiresAt, new Date()),
        ))
      .orderBy(asc(creditBatches.expiresAt), desc(creditBatches.remainingCents))
      .for('update', { skipLocked: true })

      if (!activeBatches.length) {
        throw new Error('Insufficient credits')
      }

      const totalAvailable = activeBatches.reduce((s, b) => s + Number(b.remainingCents), 0)
      const required = Number(totalCents)

      if (totalAvailable < required) {
        throw new Error('Insufficient credits')
      }

      let toConsume = required
      for (const batch of activeBatches) {
        if (toConsume <= 0) break
        const remaining = Number(batch.remainingCents)
        const consume = Math.min(remaining, toConsume)
        await tx.update(creditBatches)
          .set({ remainingCents: String(remaining - consume) })
          .where(eq(creditBatches.id, batch.id))
        toConsume -= consume
      }

      const [newSum] = await tx.select({ total: sql`COALESCE(SUM(${creditBatches.remainingCents}), 0)` })
        .from(creditBatches)
        .where(and(
          eq(creditBatches.userId, userId),
          gt(creditBatches.expiresAt, new Date()),
        ))

      await tx.insert(creditBalances)
        .values({
          userId,
          balanceCents: String(newSum?.total ?? 0),
          totalDepositedCents: '0',
          totalUsedCents: String(required),
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: creditBalances.userId,
          set: {
            balanceCents: String(newSum?.total ?? 0),
            totalUsedCents: sql`CAST(${creditBalances.totalUsedCents} AS NUMERIC) + ${required}`,
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          },
        })
    })
    return true
  } catch (err) {
    if (err instanceof Error && err.message === 'Insufficient credits') return false
    throw err
  }
}

export async function extendExpiringBatches(userId: string): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ACTIVE_EXTENSION_DAYS)

  const rows = await db.select({ lastActivityAt: creditBalances.lastActivityAt })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1)

  if (!rows.length) return 0
  if (!rows[0].lastActivityAt) return 0

  const lastActivity = new Date(rows[0].lastActivityAt)
  if (lastActivity < cutoff) return 0

  const expiryThreshold = new Date()
  expiryThreshold.setDate(expiryThreshold.getDate() + CREDIT_EXPIRY_DAYS)

  const expiringBatches = await db.select({ id: creditBatches.id })
    .from(creditBatches)
    .where(and(
      eq(creditBatches.userId, userId),
      gt(creditBatches.remainingCents, '0'),
      lt(creditBatches.expiresAt, expiryThreshold),
    ))

  if (!expiringBatches.length) return 0

  const newExpiry = getExpiryDate()
  for (const batch of expiringBatches) {
    await db.update(creditBatches)
      .set({ expiresAt: newExpiry })
      .where(eq(creditBatches.id, batch.id))
  }

  return expiringBatches.length
}

export async function getStakingDiscount(userId: string): Promise<number> {
  try {
    const [tier] = await db
      .select({ discountPercent: stakingTiers.discountPercent })
      .from(stakingTiers)
      .where(eq(stakingTiers.userId, userId))
      .limit(1);

    return tier?.discountPercent ?? 0;
  } catch {
    return 0;
  }
}
