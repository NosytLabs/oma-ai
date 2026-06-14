import { db } from "../db/client.js";
import { deposits, creditBatches, creditBalances } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

const EVM_TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

function isValidTxHash(txHash: string): boolean {
  return EVM_TX_HASH_RE.test(txHash);
}

// Transaction type from Drizzle - complex generic makes 'any' pragmatic here
/* eslint-disable @typescript-eslint/no-explicit-any */
async function createDepositAndCreditBatch(
  tx: any,
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

  const creditsCents = Math.round(amountUsd * 100);

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

    return { creditsCents, depositId: deposit.id };
  });
}

export async function processHoudiniDeposit(
  userId: string,
  quoteId: string,
  fromCoin: string,
  fromAmount: string,
  houdiniId: string,
  depositAddress: string,
) {
  const [deposit] = await db.insert(deposits).values({
    userId,
    type: "houdini_swap",
    status: "pending",
    amountUsd: "0",
    creditsIssued: "0",
    fromCoin,
    houdiniId: houdiniId || null,
    depositAddress: depositAddress || null,
  }).returning();

  return { depositId: deposit.id, depositAddress: depositAddress || "" };
}

export async function completeHoudiniDeposit(depositId: string, toAmount: number, txHash: string, userId: string) {
  if (typeof toAmount !== "number" || !Number.isFinite(toAmount) || toAmount <= 0) {
    throw new Error("Invalid toAmount");
  }
  if (!isValidTxHash(txHash)) {
    throw new Error("Invalid txHash");
  }

  const result = await db.transaction(async (tx) => {
    return completeHoudiniDepositImpl(tx, depositId, toAmount, txHash, userId);
  });

  return { creditsCents: result.creditsCents };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function completeHoudiniDepositImpl(
  tx: any, depositId: string, toAmount: number, txHash: string, userId: string) {
  const rows = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
  if (!rows.length) throw new Error("Deposit not found");

  const deposit = rows[0];
  if (deposit.userId !== userId) throw new Error("Deposit ownership mismatch");
  if (deposit.status !== "pending") throw new Error("Deposit is not pending");

  // creditsCents is derived solely from the on-chain toAmount; no caller override.
  const netAmountUsd = toAmount;
  const creditsCents = Math.round(netAmountUsd * 100);

  await tx.update(deposits)
    .set({
      status: "completed",
      amountUsd: String(netAmountUsd),
      creditsIssued: String(creditsCents / 100),
      txHash,
      completedAt: new Date(),
    })
    .where(eq(deposits.id, depositId));

  await createDepositAndCreditBatch(tx, deposit.userId, creditsCents, deposit.id);

  return { creditsCents, userId: deposit.userId };
}

export async function completeHoudiniDepositWithTx(tx: Awaited<ReturnType<typeof db.transaction>>, depositId: string, toAmount: number, txHash: string, userId: string) {
  return completeHoudiniDepositImpl(tx, depositId, toAmount, txHash, userId);
}

export async function processCctpDeposit(userId: string, amountUsd: number, txHash: string, _sourceChain: string, messageHash?: string, attestation?: string) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Invalid amountUsd: must be a positive finite number");
  }

  if (!isValidTxHash(txHash)) {
    throw new Error("Invalid txHash format: must be 0x-prefixed 64 hex chars (EVM)");
  }

  if (messageHash && !/^0x[a-fA-F0-9]{64}$/.test(messageHash)) {
    throw new Error("Invalid CCTP messageHash: must be 0x-prefixed 64 hex chars");
  }

  if (attestation && !/^0x[a-fA-F0-9]+$/.test(attestation)) {
    throw new Error("Invalid CCTP attestation: must be a valid hex string");
  }

  const creditsCents = Math.round(amountUsd * 100);

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

    return { creditsCents, depositId: deposit.id, method: "cctp" as const };
  });
}

export async function processLifiDeposit(
  userId: string,
  amountUsd: number,
  txHash: string,
  fromChain: string,
  _fromToken: string,
  toToken?: string,
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

  const creditsCents = Math.round(amountUsd * 100);

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
    const rows = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!rows.length) throw new Error("Deposit not found");

    const deposit = rows[0];
    if (userId && deposit.userId !== userId) throw new Error("Deposit ownership mismatch");
    if (deposit.status !== "pending") throw new Error("Deposit is not pending");

    const creditsCents = Math.round(amountUsd * 100);

    await tx.update(deposits)
      .set({
        status: "completed",
        amountUsd: String(amountUsd),
        creditsIssued: String(creditsCents / 100),
        txHash,
        houdiniId: paymentLinkId,
        completedAt: new Date(),
      })
      .where(eq(deposits.id, depositId));

    await createDepositAndCreditBatch(tx, deposit.userId, creditsCents, deposit.id);

    return { creditsCents };
  });

  return { creditsCents: result.creditsCents, depositId };
}
