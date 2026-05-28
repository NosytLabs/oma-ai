import { db } from '../db/client.js'
import { creditBatches, creditBalances } from '../db/schema.js'
import { eq, sql, and, gt, lt, asc, desc, inArray } from 'drizzle-orm'

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
      .for('update')

      if (!activeBatches.length) {
        throw new Error('Insufficient credits')
      }

      const totalAvailable = activeBatches.reduce((s, b) => s + Number(b.remainingCents), 0)
      const required = Number(totalCents)

      if (totalAvailable < required) {
        throw new Error('Insufficient credits')
      }

      let toConsume = required
      const batchUpdates: { id: string; newRemaining: string }[] = []

      for (const batch of activeBatches) {
        if (toConsume <= 0) break
        const remaining = Number(batch.remainingCents)
        const consume = Math.min(remaining, toConsume)
        batchUpdates.push({
          id: batch.id,
          newRemaining: String(remaining - consume),
        })
        toConsume -= consume
      }

      if (batchUpdates.length > 0) {
        const ids = batchUpdates.map(b => b.id)
        const cases = batchUpdates.map(b => sql`WHEN ${creditBatches.id} = ${b.id} THEN ${b.newRemaining}`)
        await tx.update(creditBatches)
          .set({ remainingCents: sql`CASE ${sql.join(cases, sql` `)} ELSE remaining_cents END` })
          .where(inArray(creditBatches.id, ids))
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

const CREDIT_EXPIRY_DAYS = 90
const ACTIVE_EXTENSION_DAYS = 90

export function getCreditExpiryDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + CREDIT_EXPIRY_DAYS)
  return d
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

  const newExpiry = getCreditExpiryDate()
  const batchIds = expiringBatches.map(b => b.id)

  await db.update(creditBatches)
    .set({ expiresAt: newExpiry })
    .where(and(
      inArray(creditBatches.id, batchIds),
      gt(creditBatches.remainingCents, '0'),
    ))

  return expiringBatches.length
}