import { getRedisClient } from "./redis-client.js";

export interface DlqEntry {
  provider: string;
  body: string;
  error: string;
  timestamp: string;
}

export interface SettlementDlqEntry {
  orderId: string;
  amount: string;
  chain: string;
  attempts: number;
  lastError: string;
  createdAt: string;
}

export interface DlqListName {
  listName: string;
}

const DLQ_LISTS: Record<string, string> = {
  webhook: "webhook:dlq",
  settlement: "settlement:dlq",
};

export async function addToDlq(provider: string, rawBody: string, errorMessage: string, listName: keyof typeof DLQ_LISTS = "webhook"): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    console.error(`[DLQ] Failed to connect to Redis. Could not save DLQ entry for provider ${provider}`);
    return;
  }

  const entry: DlqEntry = {
    provider,
    body: rawBody,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };

  try {
    await redis.lPush(DLQ_LISTS[listName], JSON.stringify(entry));
  } catch (err) {
    console.error(`[DLQ] Error pushing to DLQ:`, err);
  }
}

export async function addSettlementToDlq(
  orderId: string,
  amount: string,
  chain: string,
  lastError: string,
  attempts: number = 1
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    console.error("[DLQ] Failed to connect to Redis. Could not save settlement DLQ entry");
    return;
  }

  const entry: SettlementDlqEntry = {
    orderId,
    amount,
    chain,
    attempts,
    lastError,
    createdAt: new Date().toISOString(),
  };

  try {
    await redis.lPush(DLQ_LISTS.settlement, JSON.stringify(entry));
  } catch (err) {
    console.error("[DLQ] Error pushing settlement to DLQ:", err);
  }
}

export async function getDlqEntries(start: number, count: number, listName: keyof typeof DLQ_LISTS = "webhook"): Promise<DlqEntry[]> {
  const redis = await getRedisClient();
  if (!redis) return [];

  try {
    const entries = await redis.lRange(DLQ_LISTS[listName], start, start + count - 1);
    return entries.map((e) => JSON.parse(e) as DlqEntry);
  } catch (err) {
    console.error(`[DLQ] Error reading from DLQ:`, err);
    return [];
  }
}

export async function getSettlementDlqEntries(start: number, count: number): Promise<SettlementDlqEntry[]> {
  const redis = await getRedisClient();
  if (!redis) return [];

  try {
    const entries = await redis.lRange(DLQ_LISTS.settlement, start, start + count - 1);
    return entries.map((e) => JSON.parse(e) as SettlementDlqEntry);
  } catch (err) {
    console.error("[DLQ] Error reading settlement DLQ:", err);
    return [];
  }
}

export async function retryFromDlq(): Promise<DlqEntry | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const entries = await redis.lRange(DLQ_LISTS.webhook, 0, 0);
    if (entries.length === 0) return null;

    const entry = JSON.parse(entries[0]) as DlqEntry;
    await redis.lTrim(DLQ_LISTS.webhook, 1, -1);
    return entry;
  } catch (err) {
    console.error(`[DLQ] Error retrying from DLQ:`, err);
    return null;
  }
}

export async function retrySettlementFromDlq(): Promise<SettlementDlqEntry | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const entries = await redis.lRange(DLQ_LISTS.settlement, 0, 0);
    if (entries.length === 0) return null;

    const entry = JSON.parse(entries[0]) as SettlementDlqEntry;
    await redis.lTrim(DLQ_LISTS.settlement, 1, -1);
    return entry;
  } catch (err) {
    console.error("[DLQ] Error retrying settlement from DLQ:", err);
    return null;
  }
}

export async function clearDlq(listName: keyof typeof DLQ_LISTS = "webhook"): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    await redis.del(DLQ_LISTS[listName]);
    return true;
  } catch (err) {
    console.error(`[DLQ] Error clearing DLQ:`, err);
    return false;
  }
}

export async function removeSettlementDlqEntry(index: number): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    const entries = await redis.lRange(DLQ_LISTS.settlement, index, index);
    if (entries.length === 0) return false;

    await redis.lTrim(DLQ_LISTS.settlement, index, index);
    return true;
  } catch (err) {
    console.error("[DLQ] Error removing settlement DLQ entry:", err);
    return false;
  }
}

export async function getSettlementDlqLength(): Promise<number> {
  const redis = await getRedisClient();
  if (!redis) return 0;

  try {
    return await redis.lLen(DLQ_LISTS.settlement);
  } catch (err) {
    console.error("[DLQ] Error getting settlement DLQ length:", err);
    return 0;
  }
}