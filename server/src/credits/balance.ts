import { db } from '../db/client.js'
import { creditBalances, usageRecords, stakingTiers, creditBatches } from '../db/schema.js'
import { eq, sql, and, gt, asc, lt } from 'drizzle-orm'

const CREDIT_EXPIRY_DAYS = 90
const ACTIVE_EXTENSION_DAYS = 90

export async function getBalance(userId: string) {
  const [sumRow] = await db.select({ total: sql`COALESCE(SUM(${creditBatches.remainingCents}), 0)` })
    .from(creditBatches)
    .where(and(
      eq(creditBatches.userId, userId),
      gt(creditBatches.expiresAt, new Date()),
    ))

  const batchTotal = String(sumRow?.total ?? '0')

  const rows = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId))

  if (!rows.length) {
    return {
      balanceCents: batchTotal,
      totalDepositedCents: '0',
      totalUsedCents: '0',
      lastActivityAt: null,
    }
  }

  const row = rows[0]
  return {
    balanceCents: batchTotal,
    totalDepositedCents: row.totalDepositedCents,
    totalUsedCents: row.totalUsedCents,
    lastActivityAt: row.lastActivityAt,
  }
}

function getExpiryDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + CREDIT_EXPIRY_DAYS)
  return d
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
}

export async function deductCredits(
  userId: string,
  costCents: number,
  markupCents: number,
  totalCents: number,
  model: string,
  provider: "venice" | "antseed",
  apiKeyId: string,
  inputTokens: number,
  outputTokens: number,
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
      .orderBy(asc(creditBatches.createdAt))
      .for('update')

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
}

export async function getStakingDiscount(userId: string): Promise<number> {
  const rows = await db.select().from(stakingTiers).where(eq(stakingTiers.userId, userId))
  if (!rows.length) return 0
  return Number(rows[0].discountPercent)
}

export async function refundCredits(userId: string, amountCents: string) {
  const amt = Number(amountCents)
  if (amt <= 0) return

  const expiresAt = getExpiryDate()

  await db.transaction(async (tx) => {
    await tx.insert(creditBatches).values({
      userId,
      amountCents: String(amt),
      remainingCents: String(amt),
      expiresAt,
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
        .orderBy(asc(creditBatches.createdAt))
        .for('update')

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
