import { getRedisClient } from "./redis-client.js";
import { logger } from "./logger.js";

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

// ponytail: redact common PII patterns; upgrade to structured logging if audit demands it
function redactPii(body: string): string {
  const redacted = body
    .replace(/(sk-[a-zA-Z0-9]{20,})/g, "[REDACTED_API_KEY]")
    .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/g, "$1[REDACTED_TOKEN]")
    .replace(/(Authorization:\s*)[a-zA-Z0-9._-]+/g, "$1[REDACTED_TOKEN]")
    .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "[REDACTED_EMAIL]")
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[REDACTED_IP]");
  return redacted.length > 500 ? redacted.slice(0, 500) : redacted;
}

export async function addToDlq(provider: string, rawBody: string, errorMessage: string, listName: keyof typeof DLQ_LISTS = "webhook"): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    logger.error({ provider }, "[DLQ] Failed to connect to Redis. Could not save DLQ entry");
    return;
  }

  const entry: DlqEntry = {
    provider,
    body: redactPii(rawBody),
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };

  try {
    await redis.lPush(DLQ_LISTS[listName], JSON.stringify(entry));
  } catch (err) {
    logger.error({ err, provider }, "[DLQ] Error pushing to DLQ");
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
    logger.error({ orderId }, "[DLQ] Failed to connect to Redis. Could not save settlement DLQ entry");
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
    logger.error({ err, orderId }, "[DLQ] Error pushing settlement to DLQ");
  }
}

export async function getDlqEntries(start: number, count: number, listName: keyof typeof DLQ_LISTS = "webhook"): Promise<DlqEntry[]> {
  const redis = await getRedisClient();
  if (!redis) return [];

  try {
    const entries = await redis.lRange(DLQ_LISTS[listName], start, start + count - 1);
    return entries.map((e) => JSON.parse(e) as DlqEntry);
  } catch (err) {
    logger.error({ err, listName }, "[DLQ] Error reading from DLQ");
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
    logger.error({ err }, "[DLQ] Error reading settlement DLQ");
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
    logger.error({ err }, "[DLQ] Error retrying from DLQ");
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
    logger.error({ err }, "[DLQ] Error retrying settlement from DLQ");
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
    logger.error({ err, listName }, "[DLQ] Error clearing DLQ");
    return false;
  }
}

export async function removeSettlementDlqEntry(index: number): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    // Read ALL entries in the list (LRANGE 0 -1) so we can rebuild it
    // without the target entry. lTrim cannot remove a single element
    // by index — it only KEEPS a range. We must DEL + RPUSH.
    const allEntries = await redis.lRange(DLQ_LISTS.settlement, 0, -1);
    if (allEntries.length === 0) return false;
    if (index < 0 || index >= allEntries.length) return false;

    const remaining = allEntries.filter((_, i) => i !== index);

    // Atomically replace the list: DEL + RPUSH preserves the original
    // insertion order (lPush on the producer side, so consumers iterate
    // oldest-first; rPush here restores the same order from oldest to newest).
    await redis.del(DLQ_LISTS.settlement);
    if (remaining.length > 0) {
      await redis.rPush(DLQ_LISTS.settlement, remaining);
    }
    return true;
  } catch (err) {
    logger.error({ err, index }, "[DLQ] Error removing settlement DLQ entry");
    return false;
  }
}

export async function getSettlementDlqLength(): Promise<number> {
  const redis = await getRedisClient();
  if (!redis) return 0;

  try {
    return await redis.lLen(DLQ_LISTS.settlement);
  } catch (err) {
    logger.error({ err }, "[DLQ] Error getting settlement DLQ length");
    return 0;
  }
}
