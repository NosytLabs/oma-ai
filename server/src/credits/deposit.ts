import { db } from "../db/client.js";
import { emitDepositMatched } from "../lib/deposit-events.js";

// Drizzle's PgTransaction is a subset of NeonHttpDatabase (no $withAuth/batch).
// Both support .select/.insert/.update/.delete used in deposit helpers.
type DbClient = Pick<typeof db, "select" | "insert" | "update" | "delete" | "query">;
import { deposits, creditBatches, creditBalances } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import {
  verifyCctpAttestation,
  normalizeChainName,
  CCTP_CHAIN_DOMAIN_IDS,
} from "./cctp-client.js";
import { verifyUsdcOnChain } from "./verify-usdc-on-chain.js";

const EVM_TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

function isValidTxHash(txHash: string): boolean {
  return EVM_TX_HASH_RE.test(txHash);
}

// Bonus credit tiers: larger deposits get bonus credits on top of the base
// $1 = 100 credits conversion. This matches the pricing page:
//   Starter ($10):   1,000 credits (no bonus)
//   Builder ($50):   5,500 credits (+10% bonus)
//   Scale ($200):   24,000 credits (+20% bonus)
const BONUS_TIERS = [
  { thresholdUsd: 200, bonusPct: 0.20 },
  { thresholdUsd: 50, bonusPct: 0.10 },
] as const;

export function calculateCreditsWithBonus(amountUsd: number): { baseCents: number; bonusCents: number; totalCents: number } {
  const baseCents = Math.round(amountUsd * 100);
  let bonusPct = 0;
  for (const tier of BONUS_TIERS) {
    if (amountUsd >= tier.thresholdUsd) {
      bonusPct = tier.bonusPct;
      break;
    }
  }
  const bonusCents = Math.round(baseCents * bonusPct);
  return { baseCents, bonusCents, totalCents: baseCents + bonusCents };
}

// Transaction type from Drizzle - using typeof db since tx has the same interface
async function createDepositAndCreditBatch(
  tx: DbClient,
  userId: string,
  creditsCents: number,
  depositId: string,
) {
  await tx.insert(creditBatches).values({
    userId,
    amountCents: String(creditsCents),
    remainingCents: String(creditsCents),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });

  await tx.insert(creditBalances)
    .values({
      userId,
      balanceCents: String(creditsCents),
      totalDepositedCents: String(creditsCents),
      totalUsedCents: '0',
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: creditBalances.userId,
      set: {
        balanceCents: sql`${creditBalances.balanceCents} + ${creditsCents}`,
        totalDepositedCents: sql`${creditBalances.totalDepositedCents} + ${creditsCents}`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return { creditsCents, depositId };
}

export async function processUsdcDeposit(userId: string, amountUsd: number, txHash: string) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Invalid amountUsd: must be a positive finite number");
  }

  const { totalCents: creditsCents } = calculateCreditsWithBonus(amountUsd);

  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).for("update");
    if (existing.length > 0) {
      return { creditsCents: 0, depositId: existing[0].id };
    }

    const [deposit] = await tx.insert(deposits).values({
      userId,
      type: "usdc_direct",
      status: "completed",
      amountUsd: String(amountUsd),
      creditsIssued: String(creditsCents / 100),
      txHash,
    }).returning();

    await createDepositAndCreditBatch(tx, userId, creditsCents, deposit.id);

    emitDepositMatched({
      id: deposit.id,
      userId,
      type: "usdc_direct",
      amountUsd: String(amountUsd),
      creditsIssued: String(creditsCents / 100),
      txHash,
      status: "completed",
      createdAt: new Date(),
      completedAt: new Date(),
    });

    return { creditsCents, depositId: deposit.id };
  });
}

export async function processCctpDeposit(
  userId: string,
  amountUsd: number,
  txHash: string,
  sourceChain: string,
  messageHash: string,
  attestation?: string,
) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Invalid amountUsd: must be a positive finite number");
  }

  if (!isValidTxHash(txHash)) {
    throw new Error("Invalid txHash format: must be 0x-prefixed 64 hex chars (EVM)");
  }

  if (!messageHash || !/^0x[a-fA-F0-9]{64}$/.test(messageHash)) {
    throw new Error("Invalid CCTP messageHash: must be 0x-prefixed 64 hex chars");
  }

  if (attestation && !/^0x[a-fA-F0-9]+$/.test(attestation)) {
    throw new Error("Invalid CCTP attestation: must be a valid hex string");
  }

  // H-CCTP-1: Verify against Circle's attestation API before crediting.
  // Catches fabricated messageHashes and stale/incomplete attestations
  // that could otherwise mint credits without a real on-chain burn.
  const normalized = normalizeChainName(sourceChain);
  if (!normalized) {
    throw new Error(`Unsupported CCTP source chain: ${sourceChain}`);
  }
  const sourceDomain = CCTP_CHAIN_DOMAIN_IDS[normalized];
  const verifyResult = await verifyCctpAttestation(messageHash, amountUsd, sourceDomain, txHash);
  if (!verifyResult.verified) {
    throw new Error(`CCTP attestation verification failed: ${verifyResult.error ?? "unknown error"}`);
  }

  const { totalCents: creditsCents } = calculateCreditsWithBonus(amountUsd);

  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).for("update");
    if (existing.length > 0) {
      return { creditsCents: 0, depositId: existing[0].id, method: "cctp" as const };
    }

    const [deposit] = await tx.insert(deposits).values({
      userId,
      type: "cctp_crosschain",
      status: "completed",
      amountUsd: String(amountUsd),
      creditsIssued: String(creditsCents / 100),
      txHash,
    }).returning();

    await createDepositAndCreditBatch(tx, userId, creditsCents, deposit.id);

    emitDepositMatched({
      id: deposit.id,
      userId,
      type: "cctp_crosschain",
      amountUsd: String(amountUsd),
      creditsIssued: String(creditsCents / 100),
      txHash,
      status: "completed",
      createdAt: new Date(),
      completedAt: new Date(),
    });

    return { creditsCents, depositId: deposit.id, method: "cctp" as const };
  });
}

export async function processLifiDeposit(
  userId: string,
  amountUsd: number,
  txHash: string,
  fromChain: string,
  _fromToken: string,
  _toToken?: string,
  lifiStatus?: string,
) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Invalid amountUsd: must be a positive finite number");
  }

  if (!isValidTxHash(txHash)) {
    throw new Error("Invalid txHash format: must be 0x-prefixed 64 hex chars (EVM)");
  }

  if (lifiStatus && lifiStatus !== "completed") {
    throw new Error(`Invalid LiFi status: expected "completed", got "${lifiStatus}"`);
  }

  if (!fromChain || typeof fromChain !== "string") {
    throw new Error("Invalid LiFi fromChain");
  }

  // H-LIFI-1: Verify the on-chain USDC transfer before crediting.
  // LiFi deposits bridge USDC to Base; we independently confirm the
  // transfer to our treasury matches the claimed amount.
  const onChainResult = await verifyUsdcOnChain(txHash, amountUsd);
  if (!onChainResult.valid) {
    throw new Error(`LiFi on-chain verification failed: ${onChainResult.error ?? "unknown error"}`);
  }

  const { totalCents: creditsCents } = calculateCreditsWithBonus(amountUsd);

  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).for("update");
    if (existing.length > 0) {
      return { creditsCents: 0, depositId: existing[0].id, method: "lifi" as const };
    }

    const [deposit] = await tx.insert(deposits).values({
      userId,
      type: "lifi_swap",
      status: "completed",
      amountUsd: String(amountUsd),
      creditsIssued: String(creditsCents / 100),
      txHash,
    }).returning();

    await createDepositAndCreditBatch(tx, userId, creditsCents, deposit.id);

    emitDepositMatched({
      id: deposit.id,
      userId,
      type: "lifi_swap",
      amountUsd: String(amountUsd),
      creditsIssued: String(creditsCents / 100),
      txHash,
      status: "completed",
      createdAt: new Date(),
      completedAt: new Date(),
    });

    return { creditsCents, depositId: deposit.id, method: "lifi" as const };
  });
}

export async function processPaymentLinkDeposit(
  depositId: string,
  paymentLinkId: string,
  amountUsd: number,
  txHash: string,
  userId?: string,
) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Invalid amountUsd: must be a positive finite number");
  }

  const result = await db.transaction(async (tx) => {
    // SECURITY: Check for duplicate txHash before processing — same guard as USDC/CCTP/LiFi paths
    if (txHash) {
      const existing = await tx.select({ id: deposits.id }).from(deposits)
        .where(eq(deposits.txHash, txHash))
        .for("update");
      if (existing.length > 0) throw new Error("Duplicate txHash");
    }

    const rows = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!rows.length) throw new Error("Deposit not found");

    const deposit = rows[0];
    if (userId && deposit.userId !== userId) throw new Error("Deposit ownership mismatch");
    if (deposit.status !== "pending") throw new Error("Deposit is not pending");

    const { totalCents: creditsCents } = calculateCreditsWithBonus(amountUsd);

    await tx.update(deposits)
      .set({
        status: "completed",
        amountUsd: String(amountUsd),
        creditsIssued: String(creditsCents / 100),
        txHash,
        completedAt: new Date(),
      })
      .where(eq(deposits.id, depositId));

    await createDepositAndCreditBatch(tx, deposit.userId, creditsCents, deposit.id);

    return { creditsCents };
  });

  emitDepositMatched({
    id: depositId,
    userId: userId ?? "",
    type: "payment_link",
    amountUsd: String(amountUsd),
    creditsIssued: String(result.creditsCents / 100),
    txHash,
    status: "completed",
    createdAt: new Date(),
    completedAt: new Date(),
  });

  return { creditsCents: result.creditsCents, depositId };
}
