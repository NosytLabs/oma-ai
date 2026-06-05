import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { lt, and, ne } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function processExpiredNoncesInternal(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  await db.update(users)
    .set({ nonce: "" })
    .where(
      and(
        lt(users.updatedAt, tenMinutesAgo),
        ne(users.nonce, "")
      )
    );
}

export async function processExpiredNonces(): Promise<void> {
  try {
    await processExpiredNoncesInternal();
    logger.info(`[nonce-cleanup] Cleared expired nonces`);
  } catch (err: unknown) {
    logger.info(`[nonce-cleanup] Skipped: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function scheduleNonceCleanup(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  const run = async () => {
    await processExpiredNonces();
  };
  run();
  intervalHandle = setInterval(run, CLEANUP_INTERVAL_MS);
}

export function stopNonceCleanup(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}