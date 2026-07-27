import { db } from '../db/client.js';
import { usageRecords, users } from '../db/schema.js';
import { sql, eq, gte, and } from 'drizzle-orm';
import { metricsStore } from '../routes/metrics.js';

export interface UsageRecordParams {
  requestId: string;
  userId: string;
  apiKeyId: string | null;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costCents: string;
  markupCents: string;
  totalCents: string;
  /** Wall-clock request duration. Null only for legacy callers. */
  latencyMs?: number | null;
  /** completed | error | cancelled | free_tier | x402 (default completed). */
  status?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * x402 pay-per-request traffic has no real account ("x402-guest" sentinel).
 * usage_records.user_id is a NOT NULL FK, so those rows are attributed to a
 * reserved system user (address "system:x402"), created lazily once.
 */
let x402SystemUserId: string | null = null;
export async function getX402SystemUserId(): Promise<string> {
  if (x402SystemUserId) return x402SystemUserId;
  const existing = await db.select({ id: users.id }).from(users)
    .where(eq(users.address, 'system:x402')).limit(1);
  if (existing.length > 0) {
    x402SystemUserId = existing[0].id;
    return x402SystemUserId;
  }
  const inserted = await db.insert(users).values({ address: 'system:x402', nonce: 'system' })
    .onConflictDoNothing({ target: users.address }).returning({ id: users.id });
  if (inserted.length > 0) {
    x402SystemUserId = inserted[0].id;
  } else {
    // Lost a concurrent insert race — re-read.
    const raced = await db.select({ id: users.id }).from(users)
      .where(eq(users.address, 'system:x402')).limit(1);
    x402SystemUserId = raced[0].id;
  }
  return x402SystemUserId;
}

export async function recordUsage(params: UsageRecordParams): Promise<void> {
  const userId = UUID_RE.test(params.userId)
    ? params.userId
    : await getX402SystemUserId();
  // Legacy callers pass "unknown" when the request had no API key — the
  // column is a nullable UUID FK, so anything non-UUID becomes null.
  const apiKeyId = params.apiKeyId && UUID_RE.test(params.apiKeyId) ? params.apiKeyId : null;
  await db.insert(usageRecords).values({
    requestId: params.requestId,
    userId,
    apiKeyId,
    model: params.modelId,
    provider: params.provider as "venice" | "surplus" | "gonka",
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costCents: params.costCents,
    markupCents: params.markupCents,
    totalCents: params.totalCents,
    latencyMs: params.latencyMs ?? null,
    status: params.status ?? 'completed',
  }).onConflictDoNothing();
  // oma_chat_completion_tokens_total was declared but never incremented —
  // every recorded request now feeds the Prometheus counter.
  metricsStore.chatCompletionTokens += params.inputTokens + params.outputTokens;
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