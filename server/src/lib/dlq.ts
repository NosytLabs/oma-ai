import { and, asc, eq, lt, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { settlementDlq, settlements } from "../db/schema.js";
import { logger } from "./logger.js";
import type { SettlementRecord } from "../x402/types.js";
import { databaseErrorMetadata } from "./database-error.js";

/**
 * Durable retry queue for x402 settlements.
 *
 * ## Why Postgres and not Redis
 *
 * The entry exists because a settlement was accepted on-chain but could NOT be
 * written to `settlements`. Queueing that work in a separate store is fragile
 * for two independent reasons:
 *
 *  1. Production runs no Redis. `getRedisClient()` returned null, so the old
 *     `addSettlementToDlq` logged and returned -- the payment record was
 *     discarded entirely and nothing was ever recoverable.
 *  2. Even with Redis, the stored entry omitted `payee` and `receipt`, which
 *     are NOT NULL on `settlements`. The row could not have been rebuilt.
 *
 * So the retry queue now lives beside the table it repairs, and stores the
 * complete payload.
 *
 * ## Semantics
 *
 * - Enqueue is idempotent on (txHash, networkId): re-enqueueing the same
 *   failed settlement refreshes the error rather than creating duplicate work.
 * - Drain inserts into `settlements` with ON CONFLICT DO NOTHING, so running
 *   it concurrently (or re-running after a crash between insert and delete)
 *   cannot double-credit.
 * - Failures back off exponentially. Exhausted entries remain for manual
 *   reconciliation; rows are deleted only once the settlement is durable.
 */


/** Exponential backoff, capped, plus a ceiling on retries before we give up. */
const MAX_ATTEMPTS = 12;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60_000;

function backoffMs(attempts: number): number {
	return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
}

/**
 * Record a settlement that was accepted on-chain but could not be persisted.
 * Never throws: the caller is already on an error path and must surface the
 * original failure, not this one.
 */
export async function addSettlementToDlq(
	record: SettlementRecord & { receipt: string },
	lastError: unknown,
	attempts: number = 1,
): Promise<boolean> {
	// This queue is entered after database persistence failed. Never duplicate
	// a query/receipt/credential-bearing message into logs or diagnostic storage.
	const errorMetadata = databaseErrorMetadata(lastError);
	const errorText = JSON.stringify(errorMetadata);
	if (!record.receipt) {
		// settlements.receipt is NOT NULL, so an entry without one could never
		// be replayed. Refuse loudly rather than queueing a dead row.
		logger.error(
			{ txHash: record.txHash },
			"[DLQ] Refusing to queue settlement without a receipt",
		);
		return false;
	}
	try {
		await db
			.insert(settlementDlq)
			.values({
				txHash: record.txHash,
				networkId: record.networkId,
				amount: record.amount,
				payee: record.payee,
				receipt: record.receipt,
				settledAt: new Date(record.settledAt),
				attempts,
				lastError: errorText,
				nextAttemptAt: new Date(),
			})
			// A settlement already queued only needs its error text refreshed;
			// duplicating the row would double the replay work.
			.onConflictDoUpdate({
				target: [settlementDlq.txHash, settlementDlq.networkId],
				set: {
					lastError: errorText,
					attempts: sql`GREATEST(${settlementDlq.attempts}, ${attempts})`,
				},
			});

		logger.error(
			{ txHash: record.txHash, networkId: record.networkId, err: errorMetadata },
			"[DLQ] Settlement persisted to queue for retry",
		);
		return true;
	} catch (err) {
		// Nothing left to fall back to: the DB that failed to accept the
		// settlement also refused the queue row. Say so loudly -- this is the
		// one case where a human must reconcile manually.
		logger.error(
			{ err, txHash: record.txHash, networkId: record.networkId },
			"[DLQ] CRITICAL: could not queue failed settlement -- manual reconciliation required",
		);
		return false;
	}
}

export interface DrainResult {
	scanned: number;
	recovered: number;
	failed: number;
	abandoned: number;
}

/**
 * Replay queued settlements into `settlements`. Safe to call concurrently and
 * repeatedly: the insert is ON CONFLICT DO NOTHING and rows are only deleted
 * after the settlement is durably present.
 */
export async function drainSettlementDlq(batchSize = 25): Promise<DrainResult> {
	const result: DrainResult = { scanned: 0, recovered: 0, failed: 0, abandoned: 0 };

	let due: (typeof settlementDlq.$inferSelect)[];
	try {
		due = await db
			.select()
			.from(settlementDlq)
			.where(and(lte(settlementDlq.nextAttemptAt, new Date()), lt(settlementDlq.attempts, MAX_ATTEMPTS)))
			.orderBy(asc(settlementDlq.nextAttemptAt))
			.limit(batchSize);
	} catch (err) {
		logger.error({ err }, "[DLQ] Could not read settlement queue");
		return result;
	}

	result.scanned = due.length;

	for (const entry of due) {
		try {
			await db
				.insert(settlements)
				.values({
					txHash: entry.txHash,
					amount: entry.amount,
					networkId: entry.networkId,
					payee: entry.payee,
					receipt: entry.receipt,
					settledAt: entry.settledAt,
				})
				// Already settled by a concurrent drain or a late original
				// write -- treat as success and drop the queue row.
				.onConflictDoNothing();

			await db.delete(settlementDlq).where(eq(settlementDlq.id, entry.id));
			result.recovered++;
			logger.info(
				{ txHash: entry.txHash, networkId: entry.networkId, attempts: entry.attempts },
				"[DLQ] Recovered settlement",
			);
		} catch (err) {
			result.failed++;
			const attempts = entry.attempts + 1;
			const errorText = JSON.stringify(databaseErrorMetadata(err));

			await db
				.update(settlementDlq)
				.set({
					attempts,
					lastError: errorText,
					nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
				})
				.where(eq(settlementDlq.id, entry.id));
			if (attempts >= MAX_ATTEMPTS) {
				result.abandoned++;
				logger.error(
					{ err, txHash: entry.txHash, attempts },
					"[DLQ] EXHAUSTED settlement retries -- receipt retained for manual reconciliation",
				);
			}
		}
	}

	return result;
}

/** Queue depth, for health/ops surfaces. */
export async function getSettlementDlqLength(): Promise<number> {
	try {
		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(settlementDlq);
		return row?.count ?? 0;
	} catch (err) {
		logger.error({ err }, "[DLQ] Could not read settlement queue depth");
		return 0;
	}
}


// ---------------------------------------------------------------------------
// Webhook DLQ -- still Redis-backed. Kept separate from the settlement queue
// because a webhook entry is replayed to the PROVIDER, not into Postgres.
// ---------------------------------------------------------------------------

export interface DlqEntry {
	provider: string;
	body: string;
	error: string;
	timestamp: string;
}

const WEBHOOK_DLQ_KEY = "webhook:dlq";

// redact common PII patterns; upgrade to structured logging if audit demands it
function redactPii(body: string): string {
	const redacted = body
		.replace(/(sk-[a-zA-Z0-9]{20,})/g, "[REDACTED_API_KEY]")
		.replace(/(Bearer\s+)[a-zA-Z0-9._-]+/g, "$1[REDACTED_TOKEN]")
		.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "[REDACTED_EMAIL]")
		.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[REDACTED_IP]");
	return redacted.length > 500 ? redacted.slice(0, 500) : redacted;
}

export async function addToDlq(
	provider: string,
	rawBody: string,
	errorMessage: string,
): Promise<void> {
	const { getRedisClient } = await import("./redis-client.js");
	const redis = await getRedisClient();
	if (!redis) {
		if (process.env.NODE_ENV !== "test") {
			logger.error({ provider }, "[DLQ] Failed to connect to Redis. Could not save DLQ entry");
		}
		return;
	}

	const entry: DlqEntry = {
		provider,
		body: redactPii(rawBody),
		error: errorMessage,
		timestamp: new Date().toISOString(),
	};

	try {
		await redis.lpush(WEBHOOK_DLQ_KEY, JSON.stringify(entry));
	} catch (err) {
		logger.error({ err, provider }, "[DLQ] Error pushing to DLQ");
	}
}

export async function getDlqEntries(start: number, count: number): Promise<DlqEntry[]> {
	const { getRedisClient } = await import("./redis-client.js");
	const redis = await getRedisClient();
	if (!redis) return [];

	try {
		const entries = await redis.lrange(WEBHOOK_DLQ_KEY, start, start + count - 1);
		return entries.map((e: string) => JSON.parse(e) as DlqEntry);
	} catch (err) {
		logger.error({ err }, "[DLQ] Error reading from DLQ");
		return [];
	}
}

export async function retryFromDlq(): Promise<DlqEntry | null> {
	const { getRedisClient } = await import("./redis-client.js");
	const redis = await getRedisClient();
	if (!redis) return null;

	try {
		const entries = await redis.lrange(WEBHOOK_DLQ_KEY, 0, 0);
		if (entries.length === 0) return null;

		const entry = JSON.parse(entries[0]) as DlqEntry;
		await redis.ltrim(WEBHOOK_DLQ_KEY, 1, -1);
		return entry;
	} catch (err) {
		logger.error({ err }, "[DLQ] Error retrying from DLQ");
		return null;
	}
}

export async function clearDlq(): Promise<boolean> {
	const { getRedisClient } = await import("./redis-client.js");
	const redis = await getRedisClient();
	if (!redis) return false;

	try {
		await redis.del(WEBHOOK_DLQ_KEY);
		return true;
	} catch (err) {
		logger.error({ err }, "[DLQ] Error clearing DLQ");
		return false;
	}
}
