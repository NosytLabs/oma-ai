import { db } from '../db/client.js'
import { creditBatches, creditBalances, usageRecords } from '../db/schema.js'
import { eq, sql, and, gt, asc, desc } from 'drizzle-orm'

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

    if (totalCents > Number.MAX_SAFE_INTEGER) {
      throw new Error('Invalid amount')
    }

    let toConsume = totalCents
    const batchUpdates = activeBatches.map((batch) => {
      if (toConsume <= 0) return { id: batch.id, remainingCents: batch.remainingCents }
      const remaining = Number(batch.remainingCents)
      const consume = Math.min(remaining, toConsume)
      toConsume -= consume
      return { id: batch.id, remainingCents: String(remaining - consume) }
    })

    if (batchUpdates.length > 0) {
      await tx.update(creditBatches)
        .set({ remainingCents: sql`CASE ${batchUpdates.map((b) => sql`WHEN ${creditBatches.id} = ${b.id} THEN ${b.remainingCents}`).join(' ')} END` })
        .where(sql`${creditBatches.id} IN (${sql.join(batchUpdates.map((b) => sql`${b.id}`), sql`, `)})`)
    }

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
    }).onConflictDoNothing();
  })

  const { invalidateBalanceCache } = await import('./balance.js')
  await invalidateBalanceCache(userId)
}