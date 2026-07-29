import { Hono } from "hono";
import { eq, desc, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { usageRecords, creditBalances, deposits } from "../db/schema.js";

export const exportRoutes = new Hono<OmaEnv>();

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function jsonResponse(data: unknown, filename: string) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

exportRoutes.get("/v1/export/usage", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const format = c.req.query("format") === "json" ? "json" : "csv";
  const rows = await db
    .select({
      request_id: usageRecords.requestId,
      model: usageRecords.model,
      provider: usageRecords.provider,
      input_tokens: usageRecords.inputTokens,
      output_tokens: usageRecords.outputTokens,
      cost_cents: usageRecords.costCents,
      markup_cents: usageRecords.markupCents,
      total_cents: usageRecords.totalCents,
      status: usageRecords.status,
      created_at: usageRecords.createdAt,
    })
    .from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(10000);

  const filename = `oma-usage-${new Date().toISOString().slice(0, 10)}.${format}`;
  return format === "json"
    ? jsonResponse(rows, filename)
    : csvResponse(toCsv(rows as unknown as Record<string, unknown>[]), filename);
});

exportRoutes.get("/v1/export/deposits", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const format = c.req.query("format") === "json" ? "json" : "csv";
  const rows = await db
    .select({
      id: deposits.id,
      type: deposits.type,
      amount_usd: deposits.amountUsd,
      credits_issued: deposits.creditsIssued,
      status: deposits.status,
      tx_hash: deposits.txHash,
      created_at: deposits.createdAt,
    })
    .from(deposits)
    .where(eq(deposits.userId, userId))
    .orderBy(desc(deposits.createdAt))
    .limit(10000);

  const filename = `oma-deposits-${new Date().toISOString().slice(0, 10)}.${format}`;
  return format === "json"
    ? jsonResponse(rows, filename)
    : csvResponse(toCsv(rows as unknown as Record<string, unknown>[]), filename);
});

exportRoutes.get("/v1/export/summary", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const format = c.req.query("format") === "json" ? "json" : "csv";

  const [balance] = await db
    .select({
      balance_cents: creditBalances.balanceCents,
      total_deposited_cents: creditBalances.totalDepositedCents,
      total_used_cents: creditBalances.totalUsedCents,
    })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  const [usageSummary] = await db
    .select({
      total_requests: sql<number>`count(*)::int`,
      total_input_tokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
      total_output_tokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
      total_cost_cents: sql<string>`coalesce(sum(${usageRecords.totalCents}), 0)::numeric`,
    })
    .from(usageRecords)
    .where(eq(usageRecords.userId, userId));

  const summary = {
    balance_cents: balance?.balance_cents ?? "0",
    total_deposited_cents: balance?.total_deposited_cents ?? "0",
    total_used_cents: balance?.total_used_cents ?? "0",
    total_requests: usageSummary?.total_requests ?? 0,
    total_input_tokens: usageSummary?.total_input_tokens ?? 0,
    total_output_tokens: usageSummary?.total_output_tokens ?? 0,
    total_cost_cents: usageSummary?.total_cost_cents ?? "0",
    exported_at: new Date().toISOString(),
  };

  const filename = `oma-summary-${new Date().toISOString().slice(0, 10)}.${format}`;
  return format === "json"
    ? jsonResponse(summary, filename)
    : csvResponse(toCsv([summary]), filename);
});
