import { db } from "../db/client.js";
import { deposits, users, depositRecoveries } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { config } from "../config.js";
import { addToDlq } from "../lib/dlq.js";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const BASE_TREASURY = config.TREASURY_BASE_ADDRESS;

interface WrongNetworkDeposit {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  blockNumber: bigint;
  timestamp: Date;
}

export interface RecoveryResult {
  success: boolean;
  originalDepositId?: string;
  recoveryDepositId?: string;
  creditsRecovered: number;
  error?: string;
}

export async function scanForWrongNetworkDeposits(
  userAddress: string,
  startBlock?: bigint,
  endBlock?: bigint
): Promise<WrongNetworkDeposit[]> {
  const client = createPublicClient({
    chain: base,
    transport: http(config.CHAIN_RPC_URL),
  });

  const currentBlock = await client.getBlockNumber();
  const fromBlock = startBlock ?? currentBlock - BigInt(1000);
  const toBlock = endBlock ?? currentBlock;

  const depositLogs = await client.getContractEvents({
    address: USDC_BASE,
    abi: [
      {
        name: "Transfer",
        type: "event",
        inputs: [
          { name: "from", type: "address", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "value", type: "uint256", indexed: false },
        ],
      },
    ],
    eventName: "Transfer",
    args: {
      from: userAddress as `0x${string}`,
      to: BASE_TREASURY as `0x${string}`,
    },
    fromBlock,
    toBlock,
  });

  const wrongNetworkDeposits: WrongNetworkDeposit[] = [];

  for (const log of depositLogs) {
    const txHash = log.transactionHash;
    if (!txHash || !log.args.from || !log.args.to || log.args.value === undefined) {
      continue;
    }

    const existingDeposit = await db
      .select({ id: deposits.id })
      .from(deposits)
      .where(eq(deposits.txHash, txHash))
      .limit(1);

    if (existingDeposit.length > 0) {
      continue;
    }

    const block = await client.getBlock({ blockNumber: log.blockNumber });

    wrongNetworkDeposits.push({
      txHash,
      fromAddress: log.args.from,
      toAddress: log.args.to,
      amount: formatUnits(log.args.value, USDC_DECIMALS),
      blockNumber: log.blockNumber,
      timestamp: new Date(Number(block.timestamp) * 1000),
    });
  }

  return wrongNetworkDeposits;
}

export async function initiateRecovery(
  userId: string,
  wrongNetworkTxHash: string,
  recoveryTxHash: string
): Promise<RecoveryResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { success: false, creditsRecovered: 0, error: "User not found" };
  }

  const client = createPublicClient({
    chain: base,
    transport: http(config.CHAIN_RPC_URL),
  });

  let txAmount = "0";
  try {
    const receipt = await client.getTransactionReceipt({ hash: wrongNetworkTxHash as `0x${string}` });
    
    if (receipt.status !== "success") {
      return { success: false, creditsRecovered: 0, error: "Original transaction failed" };
    }

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === USDC_BASE.toLowerCase()) {
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
          const amountHex = log.data;
          txAmount = formatUnits(BigInt(amountHex), USDC_DECIMALS);
          break;
        }
      }
    }
  } catch (error) {
    logger.error({ error, wrongNetworkTxHash }, "[recovery] Failed to verify original transaction");
    return { success: false, creditsRecovered: 0, error: "Failed to verify original transaction" };
  }

  const amountUsd = parseFloat(txAmount);
  if (amountUsd <= 0) {
    return { success: false, creditsRecovered: 0, error: "Invalid deposit amount" };
  }

  const [recovery] = await db
    .insert(depositRecoveries)
    .values({
      id: crypto.randomUUID(),
      userId,
      originalTxHash: wrongNetworkTxHash,
      recoveryTxHash,
      amountUsd: txAmount,
      status: "pending",
      createdAt: new Date(),
    })
    .returning();

  return {
    success: true,
    originalDepositId: undefined,
    recoveryDepositId: recovery.id,
    creditsRecovered: Math.round(amountUsd * 100),
  };
}

export async function completeRecovery(recoveryId: string, adminUserId: string): Promise<RecoveryResult> {
  const [recovery] = await db
    .select()
    .from(depositRecoveries)
    .where(eq(depositRecoveries.id, recoveryId))
    .limit(1);

  if (!recovery) {
    return { success: false, creditsRecovered: 0, error: "Recovery request not found" };
  }

  if (recovery.status !== "pending") {
    return { success: false, creditsRecovered: 0, error: "Recovery already processed" };
  }

  const creditsCents = Math.round(parseFloat(recovery.amountUsd) * 100);

  await db
    .insert(deposits)
    .values({
      userId: recovery.userId,
      type: "wrong_network_recovery",
      status: "completed",
      amountUsd: recovery.amountUsd,
      creditsIssued: String(creditsCents / 100),
      txHash: recovery.recoveryTxHash,
    })
    .returning();

  await db
    .update(depositRecoveries)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedBy: adminUserId,
    })
    .where(eq(depositRecoveries.id, recoveryId));

  return {
    success: true,
    recoveryDepositId: recoveryId,
    creditsRecovered: creditsCents,
  };
}

export async function rejectRecovery(recoveryId: string, reason: string): Promise<boolean> {
  const result = await db
    .update(depositRecoveries)
    .set({
      status: "rejected",
      rejectionReason: reason,
      completedAt: new Date(),
    })
    .where(eq(depositRecoveries.id, recoveryId))
    .returning();

  return result.length > 0;
}

export async function getUserRecoveries(userId: string) {
  return db
    .select()
    .from(depositRecoveries)
    .where(eq(depositRecoveries.userId, userId))
    .orderBy(depositRecoveries.createdAt);
}

export async function getPendingRecoveries() {
  return db
    .select({
      recovery: depositRecoveries,
      user: users,
    })
    .from(depositRecoveries)
    .leftJoin(users, eq(depositRecoveries.userId, users.id))
    .where(eq(depositRecoveries.status, "pending"))
    .orderBy(depositRecoveries.createdAt);
}

// In-process scheduling removed — this job is triggered externally via
// POST /internal/jobs/deposit-recovery (see routes/jobs.ts) so NEON can
// scale to zero between runs.

export async function processPendingRecoveries(): Promise<void> {
  const pending = await db
    .select()
    .from(depositRecoveries)
    .where(eq(depositRecoveries.status, "pending"))
    .limit(50);

  const now = Date.now();

  for (const _recovery of pending) {
    const age = now - new Date(_recovery.createdAt).getTime();
    const ONE_HOUR = 60 * 60 * 1000;

    if (age > ONE_HOUR) {
      await db
        .update(depositRecoveries)
        .set({
          status: "expired",
          rejectionReason: "Auto-expired: not processed within 1 hour",
          completedAt: new Date(),
        })
        .where(eq(depositRecoveries.id, _recovery.id));

      // Send to DLQ so ops can investigate stuck recoveries
      await addToDlq(
        "deposit-recovery",
        JSON.stringify({ recoveryId: _recovery.id, originalTxHash: _recovery.originalTxHash, status: "expired" }),
        "Auto-expired: not processed within 1 hour",
      );

      logger.info({ recoveryId: _recovery.id }, "[recovery] Auto-expired pending recovery, sent to DLQ");
    }
  }
}

import crypto from "crypto";
