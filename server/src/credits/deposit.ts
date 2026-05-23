import { addCredits } from "./balance.js";
import { db } from "../db/client.js";
import { deposits } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function processUsdcDeposit(userId: string, amountUsd: number, txHash: string) {
  const creditsCents = Math.round(amountUsd * 100);

  const [deposit] = await db.insert(deposits).values({
    userId,
    type: "usdc_direct",
    status: "completed",
    amountUsd: String(amountUsd),
    creditsIssued: String(creditsCents / 100),
    txHash,
  }).returning();

  await addCredits(userId, creditsCents);

  return { creditsCents, depositId: deposit.id };
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

export async function completeHoudiniDeposit(depositId: string, toAmount: number, txHash: string, userId: string, amountUsd?: number) {
  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!rows.length) throw new Error("Deposit not found");

    const deposit = rows[0];
    if (deposit.userId !== userId) throw new Error("Deposit ownership mismatch");
    if (deposit.status !== "pending") throw new Error("Deposit is not pending");

    // Use amountUsd if provided (actual USD received by OMA after HoudiniSwap fees),
    // otherwise fall back to toAmount (for backward compatibility)
    const netAmountUsd = amountUsd ?? toAmount;
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

    return { creditsCents, userId: deposit.userId };
  });

  await addCredits(result.userId, result.creditsCents);

  return { creditsCents: result.creditsCents };
}

export async function processCctpDeposit(userId: string, amountUsd: number, txHash: string, _sourceChain: string) {
  const creditsCents = Math.round(amountUsd * 100);

  const [deposit] = await db.insert(deposits).values({
    userId,
    type: "cctp_crosschain",
    status: "completed",
    amountUsd: String(amountUsd),
    creditsIssued: String(creditsCents / 100),
    txHash,
  }).returning();

  await addCredits(userId, creditsCents);

  return { creditsCents, depositId: deposit.id, method: "cctp" as const };
}

export async function processLifiDeposit(
  userId: string,
  amountUsd: number,
  txHash: string,
  _fromChain: string,
  _fromToken: string,
  _toToken?: string,
) {
  const creditsCents = Math.round(amountUsd * 100);

  const [deposit] = await db.insert(deposits).values({
    userId,
    type: "lifi_swap",
    status: "completed",
    amountUsd: String(amountUsd),
    creditsIssued: String(creditsCents / 100),
    txHash,
  }).returning();

  await addCredits(userId, creditsCents);

  return { creditsCents, depositId: deposit.id, method: "lifi" as const };
}

export async function processPaymentLinkDeposit(
  depositId: string,
  paymentLinkId: string,
  amountUsd: number,
  txHash: string,
  userId?: string,
) {
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

    return { creditsCents, userId: deposit.userId };
  });

  await addCredits(result.userId, result.creditsCents);

  return { creditsCents: result.creditsCents, depositId };
}
