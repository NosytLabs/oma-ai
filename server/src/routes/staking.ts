import { Hono } from "hono";
import { z } from "zod";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { stakingTiers, deposits } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";

export const stakingRoutes = new Hono<OmaEnv>();

const stakeSchema = z.object({
  amount: z.number().positive(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

function calculateDiscount(stakedAmount: number): number {
  if (stakedAmount >= 100000) return 15;
  if (stakedAmount >= 50000) return 10;
  if (stakedAmount >= 10000) return 6;
  if (stakedAmount >= 1000) return 3;
  return 0;
}

// 1. Get staking info
stakingRoutes.get("/v1/stake/info", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const rows = await db.select().from(stakingTiers).where(eq(stakingTiers.userId, userId)).limit(1);

  if (!rows.length) {
    return c.json({
      stakedAmount: "0",
      discountPercent: 0,
      cooldownUntil: null,
    });
  }

  const row = rows[0];
  return c.json({
    stakedAmount: row.omaStaked,
    discountPercent: row.discountPercent,
    cooldownUntil: row.cooldownUntil ? row.cooldownUntil.toISOString() : null,
  });
});

// 2. Stake OMA tokens
stakingRoutes.post("/v1/stake", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = stakeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid parameters", type: "validation_error" } }, 400);
  }

  const { amount, txHash } = parsed.data;

  // Duplicate TX check in deposits
  const existingDep = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  if (existingDep.length > 0) {
    return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);
  }

  // On-chain verification for base network OMA token transfers
  if (config.FACILITATOR_MODE === "live") {
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(config.CHAIN_RPC_URL),
      });

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (!receipt || receipt.status !== "success") {
        return c.json({ error: { message: "Transaction failed on-chain", type: "verification_error" } }, 400);
      }

      const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
      if (!tx) {
        return c.json({ error: { message: "Transaction not found on-chain", type: "verification_error" } }, 400);
      }

      // Check OMA Token address
      if (tx.to?.toLowerCase() !== config.OMA_TOKEN_ADDRESS.toLowerCase()) {
        return c.json({ error: { message: "Transaction is not to the OMA Token contract", type: "verification_error" } }, 400);
      }

      // Check ERC20 transfer inputs: transfer(address recipient, uint256 amount)
      if (tx.input && tx.input.length >= 138 && tx.input.startsWith("0xa9059cbb")) {
        const recipient = `0x${tx.input.slice(34, 74)}`.toLowerCase();
        const rawAmount = BigInt(`0x${tx.input.slice(74, 138)}`);
        const parsedAmount = Number(formatUnits(rawAmount, 18)); // OMA ERC20 uses 18 decimals

        if (recipient !== config.TREASURY_BASE_ADDRESS.toLowerCase()) {
          return c.json({ error: { message: "Transfer recipient is not OMA Treasury", type: "verification_error" } }, 400);
        }

        if (Math.abs(parsedAmount - amount) > 0.1) {
          return c.json({ error: { message: `Staking amount mismatch: expected ${amount} OMA, found ${parsedAmount} OMA`, type: "verification_error" } }, 400);
        }
      } else {
        return c.json({ error: { message: "Invalid OMA ERC20 transfer structure", type: "verification_error" } }, 400);
      }
    } catch (err) {
      return c.json({ error: { message: `EVM staking check failed: ${err instanceof Error ? err.message : String(err)}`, type: "verification_error" } }, 500);
    }
  }

  // Update Staking Tier
  const rows = await db.select().from(stakingTiers).where(eq(stakingTiers.userId, userId)).limit(1);
  const currentStaked = rows.length ? Number(rows[0].omaStaked) : 0;
  const newStaked = currentStaked + amount;
  const newDiscount = calculateDiscount(newStaked);

  await db.insert(stakingTiers)
    .values({
      userId,
      omaStaked: String(newStaked),
      discountPercent: newDiscount,
      cooldownUntil: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: stakingTiers.userId,
      set: {
        omaStaked: String(newStaked),
        discountPercent: newDiscount,
        cooldownUntil: null,
        updatedAt: new Date(),
      },
    });

  // Log in deposit history
  await db.insert(deposits).values({
    userId,
    type: "oma_token",
    status: "completed",
    amountUsd: String(amount * 0.1), // Assumed nominal OMA price
    creditsIssued: "0", // Staking doesn't grant credits directly, it grants discount
    txHash,
  });

  return c.json({
    stakedAmount: String(newStaked),
    discountPercent: newDiscount,
  });
});

// 3. Trigger unstaking cooldown
stakingRoutes.post("/v1/unstake", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const rows = await db.select().from(stakingTiers).where(eq(stakingTiers.userId, userId)).limit(1);

  if (!rows.length || Number(rows[0].omaStaked) <= 0) {
    return c.json({ error: { message: "No active OMA stake found to unstake", type: "staking_error" } }, 400);
  }

  const row = rows[0];
  const cooldownDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days cooldown

  await db.update(stakingTiers)
    .set({
      discountPercent: 0, // Discount is immediately lost on unstaking initiation
      cooldownUntil: cooldownDate,
      updatedAt: new Date(),
    })
    .where(eq(stakingTiers.userId, userId));

  return c.json({
    stakedAmount: row.omaStaked,
    discountPercent: 0,
    cooldownUntil: cooldownDate.toISOString(),
  });
});

// 4. Withdraw after cooldown expires
stakingRoutes.post("/v1/stake/withdraw", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const rows = await db.select().from(stakingTiers).where(eq(stakingTiers.userId, userId)).limit(1);

  if (!rows.length || Number(rows[0].omaStaked) <= 0) {
    return c.json({ error: { message: "No OMA tokens available for withdrawal", type: "staking_error" } }, 400);
  }

  const row = rows[0];
  if (!row.cooldownUntil || new Date() < new Date(row.cooldownUntil)) {
    return c.json({ error: { message: "Staking cooldown has not expired yet", type: "staking_error" } }, 400);
  }

  const amountWithdrawn = row.omaStaked;

  await db.update(stakingTiers)
    .set({
      omaStaked: "0",
      discountPercent: 0,
      cooldownUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(stakingTiers.userId, userId));

  return c.json({
    success: true,
    amountWithdrawn,
    message: "Withdrawal completed successfully",
  });
});
