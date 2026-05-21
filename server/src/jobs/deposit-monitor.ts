import { Queue, Worker } from "bullmq";
import { houdiniClient, OrderStatus } from "../credits/houdini-client.js";
import { completeHoudiniDeposit } from "../credits/deposit.js";
import { db } from "../db/client.js";
import { deposits } from "../db/schema.js";
import { config } from "../config.js";
import { eq, lt, and } from "drizzle-orm";

const QUEUE_NAME = "houdini-deposits";
const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 60;
const EXPIRED_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEPOSIT_EXPIRY_MS = 2 * 60 * 60 * 1000;

const redisConnection = { url: config.REDIS_URL ?? "redis://localhost:6379" };

const depositQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

export async function createDepositJob(depositId: string, houdiniId: string): Promise<void> {
  await depositQueue.add("monitor", { depositId, houdiniId }, {
    attempts: MAX_ATTEMPTS,
    backoff: { type: "fixed", delay: POLL_INTERVAL_MS },
    removeOnComplete: true,
    removeOnFail: false,
  });
}

export async function processDepositJob(job: { data: { depositId: string; houdiniId: string } }): Promise<void> {
  const { depositId, houdiniId } = job.data;
  const order = await houdiniClient.getOrder(houdiniId);

  if (order.status === OrderStatus.FINISHED) {
    const toAmount = Number(order.toAmount ?? 0);
    const [deposit] = await db.select({ userId: deposits.userId }).from(deposits).where(eq(deposits.id, depositId)).limit(1);
    if (!deposit) throw new Error(`Deposit ${depositId} not found`);
    await completeHoudiniDeposit(depositId, toAmount, "", deposit.userId);
    return;
  }

  if (order.status === OrderStatus.FAILED || order.status === OrderStatus.REFUNDED || order.status === OrderStatus.EXPIRED) {
    await db.update(deposits).set({ status: "failed", completedAt: new Date() }).where(eq(deposits.id, depositId));
    return;
  }

  throw new Error(`Order ${houdiniId} still pending with status ${order.status}, will retry`);
}

export function startDepositWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, async (job) => processDepositJob(job), {
    connection: redisConnection,
    concurrency: 10,
  });

  worker.on("failed", (job, err) => {
    console.error(`[houdini-deposits] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  });

  worker.on("completed", (job) => {
    console.log(`[houdini-deposits] Job ${job?.id} completed`);
  });

  return worker;
}

export function scheduleExpiredDepositCheck(): NodeJS.Timeout {
  const check = async () => {
    try {
      const cutoff = new Date(Date.now() - DEPOSIT_EXPIRY_MS);
      const expired = await db.select({ id: deposits.id }).from(deposits)
        .where(and(eq(deposits.status, "pending"), lt(deposits.createdAt, cutoff)));

      for (const row of expired) {
        await db.update(deposits).set({ status: "expired", completedAt: new Date() }).where(eq(deposits.id, row.id));
      }

      if (expired.length > 0) console.log(`[houdini-deposits] Marked ${expired.length} expired deposits`);
    } catch (err: unknown) {
      console.error(`[houdini-deposits] Expired deposit check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  check();
  return setInterval(check, EXPIRED_CHECK_INTERVAL_MS);
}
