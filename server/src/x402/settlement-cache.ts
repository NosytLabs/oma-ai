import { db } from "../db/client.js";
import { settlements } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { addSettlementToDlq } from "../lib/dlq.js";
import type { SettlementRecord } from "./types.js";
import { CACHE_TTL_MS, CACHE_CLEANUP_INTERVAL_MS } from "../constants.js";

const MAX_CACHE_SIZE = 1_000;

const settlementCache = new Map<string, SettlementRecord>();
const cacheAccessOrder: string[] = [];

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, record] of settlementCache) {
    if (now - record.settledAt > CACHE_TTL_MS) {
      settlementCache.delete(key);
      const idx = cacheAccessOrder.indexOf(key);
      if (idx !== -1) cacheAccessOrder.splice(idx, 1);
    }
  }
}

function evictLRU(): void {
  if (settlementCache.size >= MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
    const firstKey = cacheAccessOrder.shift();
    if (firstKey !== undefined) {
      settlementCache.delete(firstKey);
    }
  }
}

setInterval(cleanExpiredCache, CACHE_CLEANUP_INTERVAL_MS).unref();

export function getSettlementFromCache(cacheKey: string): SettlementRecord | undefined {
  return settlementCache.get(cacheKey);
}

export function setSettlementInCache(cacheKey: string, record: SettlementRecord): void {
  evictLRU();
  settlementCache.set(cacheKey, record);
  cacheAccessOrder.push(cacheKey);
}

export async function getSettlementFromDb(txHash: string, networkId: string): Promise<SettlementRecord | null> {
  const existing = await db.select().from(settlements).where(and(eq(settlements.txHash, txHash), eq(settlements.networkId, networkId))).limit(1);
  if (existing.length === 0) return null;
  return {
    txHash: existing[0].txHash,
    amount: existing[0].amount,
    networkId: existing[0].networkId,
    payee: existing[0].payee,
    settledAt: existing[0].settledAt.getTime(),
    receipt: existing[0].receipt,
  };
}

export async function saveSettlementToDb(
  txHash: string,
  amount: string,
  networkId: string,
  payee: string,
  receipt: string,
  settledAt: number,
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.insert(settlements).values({
        txHash,
        amount,
        networkId,
        payee,
        receipt,
        settledAt: new Date(settledAt),
      });
      return;
    } catch (err) {
      if (attempt === 1) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return;
        }
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Failed to persist settlement to DB (attempt ${attempt}/3):`, lastError);
      if (attempt < 3) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  await addSettlementToDlq(txHash, amount, networkId, lastError?.message || "Unknown error", 1);
  throw new Error(`Failed to persist settlement to DB after 3 attempts: ${lastError?.message}`);
}

export function isSettledInCache(txHash: string, networkId: string): boolean {
  return settlementCache.has(`${networkId}:${txHash}`);
}

export function getReceiptFromCache(txHash: string, networkId: string): string | null {
  const record = settlementCache.get(`${networkId}:${txHash}`);
  return record?.receipt ?? null;
}