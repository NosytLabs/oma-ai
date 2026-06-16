/**
 * Bounded retention for unbounded tables.
 *
 * Four tables were growing without limit:
 *   - usage_records         (per-request AI billing records)
 *   - audit_logs            (security + admin action log)
 *   - oracle_prices         (time-series USD price data)
 *   - deposit_notifications (webhook delivery audit)
 *
 * This job is invoked by .github/workflows/retention.yml on a daily
 * 03:00 UTC schedule. It runs DELETE ... WHERE <timestamp> < cutoff and
 * returns the count of rows deleted per table so the workflow log records
 * it. DELETE is run as four separate statements (one per table) so a
 * failure on one table does not roll back the others.
 *
 * Retention windows:
 *   usage_records         —  90 days (billing reconciliation only needs 90d)
 *   audit_logs            — 365 days (compliance: 1 year minimum)
 *   oracle_prices         —  30 days (time-series; older samples not needed)
 *   deposit_notifications —  90 days (recent customer support context)
 *
 * Indexes on the timestamp columns (see schema.ts) keep the DELETE
 * predicates cheap. For very large tables, swap to a `DELETE ... USING
 * (SELECT ... LIMIT 10000)` loop to avoid long locks, but the current
 * 4 tables are expected to stay < 1M rows / month at our scale.
 */

import { db } from "../db/client.js";
import {
  usageRecords,
  auditLogs,
  oraclePrices,
  depositNotifications,
} from "../db/schema.js";
import { lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const DAY_MS = 86_400_000;

const RETENTION_DAYS = {
  usageRecords: 90,
  auditLogs: 365,
  oraclePrices: 30,
  depositNotifications: 90,
} as const;

export interface RetentionResult {
  usageRecordsDeleted: number;
  auditLogsDeleted: number;
  oraclePricesDeleted: number;
  depositNotificationsDeleted: number;
  durationMs: number;
}

export async function runRetention(): Promise<RetentionResult> {
  const startedAt = Date.now();
  const now = new Date();

  const cutoffUsageRecords = new Date(now.getTime() - RETENTION_DAYS.usageRecords * DAY_MS);
  const cutoffAuditLogs = new Date(now.getTime() - RETENTION_DAYS.auditLogs * DAY_MS);
  const cutoffOraclePrices = new Date(now.getTime() - RETENTION_DAYS.oraclePrices * DAY_MS);
  const cutoffDepositNotifications = new Date(
    now.getTime() - RETENTION_DAYS.depositNotifications * DAY_MS,
  );

  const usageDeleted = await db
    .delete(usageRecords)
    .where(lt(usageRecords.createdAt, cutoffUsageRecords))
    .returning({ id: usageRecords.id });

  const auditDeleted = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoffAuditLogs))
    .returning({ id: auditLogs.id });

  const oracleDeleted = await db
    .delete(oraclePrices)
    .where(lt(oraclePrices.capturedAt, cutoffOraclePrices))
    .returning({ id: oraclePrices.id });

  const depositNotifDeleted = await db
    .delete(depositNotifications)
    .where(lt(depositNotifications.createdAt, cutoffDepositNotifications))
    .returning({ id: depositNotifications.id });

  const result: RetentionResult = {
    usageRecordsDeleted: usageDeleted.length,
    auditLogsDeleted: auditDeleted.length,
    oraclePricesDeleted: oracleDeleted.length,
    depositNotificationsDeleted: depositNotifDeleted.length,
    durationMs: Date.now() - startedAt,
  };

  logger.info(result, "[retention] bounded retention sweep complete");
  return result;
}
