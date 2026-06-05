import { db } from '../db/client.js'
import { creditBatches, creditBalances } from '../db/schema.js'
import { sql } from 'drizzle-orm'
import { invalidateBalanceCache } from './balance.js'
import { getExpiryDate } from './utils.js'

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