import { db } from '../db/client.js'
import { creditBatches, creditBalances, usageRecords } from '../db/schema.js'
import { eq, sql, and, gt, desc } from 'drizzle-orm'
import { getExpiryDate } from './utils.js'

export async function refundCredits(userId: string, amountCents: string, originalRequestId?: string) {
  const amt = Number(amountCents)
  if (amt <= 0) return

  const newExpiry = getExpiryDate()

  await db.transaction(async (tx) => {
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

    const [lockedBalance] = await tx.select({ id: creditBalances.userId })
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .for('update');

    if (!lockedBalance) {
      throw new Error('Insufficient credits');
    }

    await tx.update(creditBalances)
      .set({
        balanceCents: String(newSum?.total ?? 0),
        totalUsedCents: sql`GREATEST(0, CAST(${creditBalances.totalUsedCents} AS NUMERIC) - ${amt})`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.userId, userId))
  })

  const { invalidateBalanceCache } = await import('./balance.js')
  await invalidateBalanceCache(userId)
}