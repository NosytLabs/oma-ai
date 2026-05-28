import { Hono } from "hono";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { deposits, withdrawals, usageRecords, creditBalances } from "../db/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import type { OmaEnv } from "../types.js";

export const exportRoutes = new Hono<OmaEnv>();

function formatCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerLine = headers.join(",");
  const rows = data.map(row => headers.map(h => {
    const val = row[h];
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(","));
  return [headerLine, ...rows].join("\n");
}

function formatJSON(data: Record<string, unknown>[]): string {
  return JSON.stringify(data, null, 2);
}

exportRoutes.get("/v1/export/deposits", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const format = c.req.query("format") || "csv";
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 1000);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const depositsData = await db.select().from(deposits)
    .where(eq(deposits.userId, userId))
    .orderBy(desc(deposits.createdAt))
    .limit(limit)
    .offset(offset);

  const formatted = depositsData.map(d => ({
    id: d.id,
    type: d.type,
    amount_usd: d.amountUsd,
    credits_issued: d.creditsIssued,
    status: d.status,
    tx_hash: d.txHash || "",
    created_at: d.createdAt.toISOString(),
    completed_at: d.completedAt?.toISOString() || "",
  }));

  if (format === "json") {
    c.header("Content-Type", "application/json");
    c.header("Content-Disposition", `attachment; filename="deposits-${Date.now()}.json"`);
    return c.body(formatJSON(formatted));
  }

  const csv = formatCSV(formatted, ["id", "type", "amount_usd", "credits_issued", "status", "tx_hash", "created_at", "completed_at"]);
  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="deposits-${Date.now()}.csv"`);
  return c.body(csv);
});

exportRoutes.get("/v1/export/withdrawals", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const format = c.req.query("format") || "csv";

  const withdrawalsData = await db.select().from(withdrawals)
    .where(eq(withdrawals.userId, userId))
    .orderBy(desc(withdrawals.createdAt))
    .limit(100);

  const formatted = withdrawalsData.map(w => ({
    id: w.id,
    type: w.type,
    amount_cents: w.amountCents,
    net_amount_cents: w.netAmountCents,
    fee_cents: w.feeCents,
    to_address: w.toAddress,
    status: w.status,
    tx_hash: w.txHash || "",
    created_at: w.createdAt.toISOString(),
    completed_at: w.completedAt?.toISOString() || "",
  }));

  if (format === "json") {
    c.header("Content-Type", "application/json");
    c.header("Content-Disposition", `attachment; filename="withdrawals-${Date.now()}.json"`);
    return c.body(formatJSON(formatted));
  }

  const csv = formatCSV(formatted, ["id", "type", "amount_cents", "net_amount_cents", "fee_cents", "to_address", "status", "tx_hash", "created_at", "completed_at"]);
  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="withdrawals-${Date.now()}.csv"`);
  return c.body(csv);
});

exportRoutes.get("/v1/export/usage", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const format = c.req.query("format") || "csv";
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  let query = db.select().from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(1000);

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    query = db.select().from(usageRecords)
      .where(and(
        eq(usageRecords.userId, userId),
        sql`${usageRecords.createdAt} BETWEEN ${start} AND ${end}`
      ))
      .orderBy(desc(usageRecords.createdAt))
      .limit(1000);
  }

  const usageData = await query;

  const formatted = usageData.map(u => ({
    id: u.id,
    request_id: u.requestId,
    model: u.model,
    provider: u.provider,
    input_tokens: u.inputTokens,
    output_tokens: u.outputTokens,
    cost_cents: u.costCents,
    markup_cents: u.markupCents,
    total_cents: u.totalCents,
    latency_ms: u.latencyMs || "",
    status: u.status,
    created_at: u.createdAt.toISOString(),
  }));

  if (format === "json") {
    c.header("Content-Type", "application/json");
    c.header("Content-Disposition", `attachment; filename="usage-${Date.now()}.json"`);
    return c.body(formatJSON(formatted));
  }

  const csv = formatCSV(formatted, ["id", "request_id", "model", "provider", "input_tokens", "output_tokens", "cost_cents", "markup_cents", "total_cents", "latency_ms", "status", "created_at"]);
  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="usage-${Date.now()}.csv"`);
  return c.body(csv);
});

exportRoutes.get("/v1/export/summary", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const format = c.req.query("format") || "json";

  const balance = await db.select().from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  const totalDeposits = await db.select({
    count: sql<string>`COUNT(*)`,
    total: sql<string>`SUM(${deposits.amountUsd}::numeric)`,
  }).from(deposits)
    .where(and(eq(deposits.userId, userId), eq(deposits.status, "completed")));

  const totalUsage = await db.select({
    totalInputTokens: sql<string>`SUM(${usageRecords.inputTokens})`,
    totalOutputTokens: sql<string>`SUM(${usageRecords.outputTokens})`,
    totalCost: sql<string>`SUM(${usageRecords.totalCents})`,
    requestCount: sql<string>`COUNT(*)`,
  }).from(usageRecords)
    .where(eq(usageRecords.userId, userId));

  const summary = {
    generated_at: new Date().toISOString(),
    balance: {
      current_cents: balance[0]?.balanceCents || "0",
      total_deposited_cents: balance[0]?.totalDepositedCents || "0",
      total_used_cents: balance[0]?.totalUsedCents || "0",
    },
    deposits: {
      count: parseInt(totalDeposits[0]?.count || "0", 10),
      total_usd: parseFloat(totalDeposits[0]?.total || "0"),
    },
    usage: {
      request_count: parseInt(totalUsage[0]?.requestCount || "0", 10),
      total_input_tokens: parseInt(totalUsage[0]?.totalInputTokens || "0", 10),
      total_output_tokens: parseInt(totalUsage[0]?.totalOutputTokens || "0", 10),
      total_cost_cents: totalUsage[0]?.totalCost || "0",
    },
  };

  if (format === "csv") {
    const csv = formatCSV([summary], Object.keys(summary));
    c.header("Content-Type", "text/csv");
    c.header("Content-Disposition", `attachment; filename="summary-${Date.now()}.csv"`);
    return c.body(csv);
  }

  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="summary-${Date.now()}.json"`);
  return c.body(formatJSON([summary]));
});