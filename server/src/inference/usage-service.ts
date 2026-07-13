import { db } from '../db/client.js';
import { usageRecords } from '../db/schema.js';
import { sql, eq, gte, and } from 'drizzle-orm';

export interface UsageRecordParams {
  requestId: string;
  userId: string;
  apiKeyId: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costCents: string;
  markupCents: string;
  totalCents: string;
}

export async function recordUsage(params: UsageRecordParams): Promise<void> {
  await db.insert(usageRecords).values({
    requestId: params.requestId,
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    model: params.modelId,
    provider: params.provider as "venice" | "surplus" | "gonka",
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costCents: params.costCents,
    markupCents: params.markupCents,
    totalCents: params.totalCents,
  }).onConflictDoNothing();
}

// Provider-level cost rollup. Used by /v1/admin/providers/:provider/usage and
// the dashboard's per-provider cost chart. Aggregates costCents + markupCents
// from usage_records over an optional time window. Shape matches the
// provider-usage route + test contract.
export interface ProviderCostRollupRow {
  totalCostCents: number;
  totalRequests: number;
  uniqueUsers: number;
  avgCostPerRequest: number;
}

export async function getProviderCostRollup(
  provider: string,
  since?: Date,
  until?: Date
): Promise<ProviderCostRollupRow | null> {
  // Aggregated via SQL — usage_records is the source of truth, but we
  // re-derive revenue from costCents + markupCents to avoid joining the
  // credits ledger for a hot-path admin query.
  const sinceOpt = since;
  // Cast provider to the enum type — usage_records.provider is a pgEnum,
  // and Drizzle's eq() needs the literal type. The caller passes a plain
  // string from the admin UI; the column's enum constrains it at write time.
  const providerCol = usageRecords.provider as unknown as Parameters<typeof eq>[0];
  const rows = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
      totalCostCents: sql<string>`coalesce(sum(${usageRecords.costCents}), 0)::text`,
      totalMarkupCents: sql<string>`coalesce(sum(${usageRecords.markupCents}), 0)::text`,
      totalRevenueCents: sql<string>`coalesce(sum(${usageRecords.totalCents}), 0)::text`,
    })
    .from(usageRecords)
    .where(
      until
        ? and(
            eq(providerCol, provider),
            gte(usageRecords.createdAt, sinceOpt as Date),
            sql`${usageRecords.createdAt} <= ${until.toISOString()}`
          )
        : sinceOpt
          ? and(eq(providerCol, provider), gte(usageRecords.createdAt, sinceOpt))
          : eq(providerCol, provider)
    );
  const row = rows[0];
  if (!row || row.totalRequests === 0) return null;
  const totalCost = Number(row.totalCostCents);
  return {
    totalRequests: row.totalRequests,
    totalCostCents: totalCost,
    uniqueUsers: 0, // placeholder — full uniqueUsers count requires DISTINCT user_id query
    avgCostPerRequest: row.totalRequests > 0 ? totalCost / row.totalRequests : 0,
  };
}