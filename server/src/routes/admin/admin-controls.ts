/**
 * Admin controls — pure SQL helpers.
 *
 * Slice 6 extracted these out of the inline admin route handlers so
 * they're unit-testable without bringing up a Hono test harness. The
 * route handlers in routes/admin/index.ts still own request/response
 * shaping, auth, and audit logging — they just call into here for the
 * transactional credit math.
 *
 * All functions assume the caller has already verified authorization
 * (admin role) and validated input. They DO NOT call auditLog() — that
 * lives in the route handler so we can keep this module pure-async
 * (testable with mock db) and free of side-effects.
 */
import { sql } from "drizzle-orm";
import { creditBalances } from "../../db/schema.js";

// Structural type for the db — accepts the canonical `db` from
// db/client.js plus any test mock that mimics the surface we use.
// We intentionally do NOT pin to the full NodePgDatabase<schema> type
// because tests then have to fabricate a perfectly-typed schema object
// for every mock — far more brittle than necessary.
export type AdjustCreditsDb = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (...args: any[]) => any;
};

export interface AdjustCreditsResult {
  userId: string;
  amountCents: number;
  beforeBalanceCents: number;
  balanceCents: number;
  totalDepositedCents: number;
  totalUsedCents: number;
}

/**
 * Atomically apply `amountCents` (positive or negative) to a user's
 * credit balance. Negative values drain (capped at zero — never lets
 * the balance go negative). Positive values bump both `balance_cents`
 * and `total_deposited_cents` for analytics. The existing row is
 * upserted so the function works for users without a prior
 * credit_balances row (rare in production; common in tests).
 */
export async function adjustCredits(
  db: AdjustCreditsDb,
  userId: string,
  amountCents: number,
): Promise<AdjustCreditsResult> {
  const [existing] = await db
    .select()
    .from(creditBalances)
    .where(sql`${creditBalances.userId} = ${userId}`)
    .limit(1);
  const beforeBalanceCents = existing ? Number(existing.balanceCents) : 0;

  const [finalBal] = await db
    .insert(creditBalances)
    .values({
      userId,
      balanceCents: sql`GREATEST(0, ${amountCents}::numeric)::numeric`,
      totalDepositedCents:
        amountCents > 0 ? sql`${amountCents}::numeric` : sql`0::numeric`,
      totalUsedCents: "0",
    })
    .onConflictDoUpdate({
      target: creditBalances.userId,
      set: {
        balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric + ${amountCents}::numeric, 0)`,
        totalDepositedCents:
          amountCents > 0
            ? sql`${creditBalances.totalDepositedCents}::numeric + ${amountCents}::numeric`
            : creditBalances.totalDepositedCents,
        lastActivityAt: sql`NOW()`,
      },
    })
    .returning();

  const balanceCents = Number(finalBal?.balanceCents ?? 0);
  const totalDepositedCents = Number(finalBal?.totalDepositedCents ?? 0);
  const totalUsedCents = Number(finalBal?.totalUsedCents ?? 0);

  return {
    userId,
    amountCents,
    beforeBalanceCents,
    balanceCents,
    totalDepositedCents,
    totalUsedCents,
  };
}

export interface DrainCreditsResult {
  userId: string;
  amountCents: number;
  beforeBalanceCents: number;
  balanceCents: number;
  drained: number;
}

/**
 * Drain `amountCents` from the user's balance for a refund. The drain
 * is capped at the current balance (we never go negative). Increments
 * `total_used_cents` by the actually-drained amount (may be less than
 * amountCents if balance was lower). Returns a record of the before /
 * after so the caller can audit log it.
 */
export async function drainCreditsForRefund(
  db: AdjustCreditsDb,
  userId: string,
  amountCents: number,
): Promise<DrainCreditsResult> {
  const [existing] = await db
    .select()
    .from(creditBalances)
    .where(sql`${creditBalances.userId} = ${userId}`)
    .limit(1);
  const beforeBalanceCents = existing ? Number(existing.balanceCents) : 0;
  const drained = Math.min(amountCents, beforeBalanceCents);

  const [finalBal] = await db
    .insert(creditBalances)
    .values({
      userId,
      balanceCents: sql`GREATEST(0, ${beforeBalanceCents}::numeric - ${amountCents}::numeric)::numeric`,
      totalDepositedCents: existing ? existing.totalDepositedCents : "0",
      totalUsedCents: sql`${drained}::numeric`,
    })
    .onConflictDoUpdate({
      target: creditBalances.userId,
      set: {
        balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric - ${amountCents}::numeric, 0)`,
        totalUsedCents: sql`${creditBalances.totalUsedCents}::numeric + ${drained}::numeric`,
        lastActivityAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();

  const balanceCents = Number(finalBal?.balanceCents ?? 0);
  return {
    userId,
    amountCents,
    beforeBalanceCents,
    balanceCents,
    drained,
  };
}