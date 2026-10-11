import { Hono } from "hono";
import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import {
		usageRecords,
		creditBalances,
		deposits,
		apiKeys,
		auditLogs,
		session as sessionTable,
		user as userTable,
} from "../db/schema.js";
import { auditLog } from "../middleware/audit.js";
import { logger } from "../lib/logger.js";
import { extractClientIpOrNull } from "../middleware/rate-limit/utils.js";
import { toCsv } from "../lib/csv.js";

export const exportRoutes = new Hono<OmaEnv>();

const USAGE_EXPORT_LIMIT = 10000;
const usageExportQuery = z.object({
	format: z.enum(["csv", "json"]).default("csv"),
	since: z.string().datetime({ offset: true }).optional(),
	until: z.string().datetime({ offset: true }).optional(),
}).refine(q => !q.since || !q.until || Date.parse(q.since) <= Date.parse(q.until));

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
		const parsed = usageExportQuery.safeParse(c.req.query());
		if (!parsed.success) return c.json({ error: { message: "Invalid usage export range or format", type: "invalid_request_error" } }, 400);
		const { format, since, until } = parsed.data;
		const conditions = [eq(usageRecords.userId, userId)];
		if (since) conditions.push(gte(usageRecords.createdAt, new Date(since)));
		if (until) conditions.push(lte(usageRecords.createdAt, new Date(until)));
		const fields = {
						request_id: usageRecords.requestId,
						api_key_id: usageRecords.apiKeyId,
						model: usageRecords.model,
						requested_model: usageRecords.requestedModel,
						provider: usageRecords.provider,
						input_tokens: usageRecords.inputTokens,
						output_tokens: usageRecords.outputTokens,
						cost_cents: usageRecords.costCents,
						markup_cents: usageRecords.markupCents,
						total_cents: usageRecords.totalCents,
						billed_cents: sql<string>`CASE WHEN ${usageRecords.refundedAt} IS NULL THEN ${usageRecords.totalCents} ELSE 0 END::text`,
						refunded_at: usageRecords.refundedAt,
						status: usageRecords.status,
						latency_ms: usageRecords.latencyMs,
						created_at: usageRecords.createdAt,
		};
		const result = await db.select(fields)
				.from(usageRecords)
				.where(and(...conditions))
				.orderBy(desc(usageRecords.createdAt), desc(usageRecords.id))
				.limit(USAGE_EXPORT_LIMIT + 1);
		const rows = result.slice(0, USAGE_EXPORT_LIMIT);

		const filename = `oma-usage-${new Date().toISOString().slice(0, 10)}.${format}`;
		const response = format === "json"
				? jsonResponse(rows, filename)
				: csvResponse(toCsv(rows as unknown as Record<string, unknown>[], Object.keys(fields)), filename);
		response.headers.set("Cache-Control", "private, no-store");
		response.headers.set("X-Export-Row-Count", String(rows.length));
		response.headers.set("X-Export-Truncated", String(result.length > USAGE_EXPORT_LIMIT));
		return response;
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
						total_input_tokens: sql<string>`coalesce(sum(${usageRecords.inputTokens}), 0)::text`,
						total_output_tokens: sql<string>`coalesce(sum(${usageRecords.outputTokens}), 0)::text`,
						total_cost_cents: sql<string>`coalesce(sum(${usageRecords.totalCents}) FILTER (WHERE ${usageRecords.refundedAt} IS NULL), 0)::numeric`,
				})
				.from(usageRecords)
				.where(eq(usageRecords.userId, userId));

		const summary = {
				balance_cents: balance?.balance_cents ?? "0",
				total_deposited_cents: balance?.total_deposited_cents ?? "0",
				total_used_cents: balance?.total_used_cents ?? "0",
				total_requests: usageSummary?.total_requests ?? 0,
				total_input_tokens: Number(usageSummary?.total_input_tokens ?? 0),
				total_output_tokens: Number(usageSummary?.total_output_tokens ?? 0),
				total_cost_cents: usageSummary?.total_cost_cents ?? "0",
				exported_at: new Date().toISOString(),
		};

		const filename = `oma-summary-${new Date().toISOString().slice(0, 10)}.${format}`;
		return format === "json"
				? jsonResponse(summary, filename)
				: csvResponse(toCsv([summary]), filename);
});

// ============================================================
// /v1/export/account — GDPR Article 15 / 20 (Right to Access &
// Data Portability). One-shot JSON dump of everything tied to
// the current user: identity, API keys (NO secrets), usage
// records, deposits, credit transactions, audit log entries,
// and active Better Auth sessions. The endpoint itself does
// NOT require additional confirmation — the user is downloading
// THEIR data — but every invocation is written to the audit
// log so we have a compliance trail of access events.
// ============================================================
exportRoutes.get("/v1/export/account", sessionAuth, async (c) => {
		const userId = c.get("userId");
		const ipAddress = extractClientIpOrNull(c) ?? undefined;
		const userAgent = c.req.header("user-agent") ?? undefined;

		// Pull every slice in parallel — each query is indexed on userId.
		const [
				[profile],
				keys,
				usage,
				depositsRows,
				creditLedger,
				auditRows,
				sessions,
		] = await Promise.all([
				db
						.select({
								id: userTable.id,
								name: userTable.name,
								email: userTable.email,
								emailVerified: userTable.emailVerified,
								image: userTable.image,
								evmAddress: userTable.evmAddress,
								isAnonymous: userTable.isAnonymous,
								role: userTable.role,
								createdAt: userTable.createdAt,
								updatedAt: userTable.updatedAt,
						})
						.from(userTable)
						.where(eq(userTable.id, userId))
						.limit(1),
				db
						.select({
								id: apiKeys.id,
								name: apiKeys.name,
								prefix: apiKeys.keyPrefix,
								active: apiKeys.active,
								lastUsedAt: apiKeys.lastUsedAt,
								expiresAt: apiKeys.expiresAt,
								createdAt: apiKeys.createdAt,
						})
						.from(apiKeys)
						.where(eq(apiKeys.userId, userId))
						.orderBy(desc(apiKeys.createdAt)),
				db
						.select({
								id: usageRecords.id,
								requestId: usageRecords.requestId,
								model: usageRecords.model,
								provider: usageRecords.provider,
								inputTokens: usageRecords.inputTokens,
								outputTokens: usageRecords.outputTokens,
								costCents: usageRecords.costCents,
								markupCents: usageRecords.markupCents,
								totalCents: usageRecords.totalCents,
								latencyMs: usageRecords.latencyMs,
								status: usageRecords.status,
								createdAt: usageRecords.createdAt,
						})
						.from(usageRecords)
						.where(eq(usageRecords.userId, userId))
						.orderBy(desc(usageRecords.createdAt))
						.limit(50_000),
				db
						.select({
								id: deposits.id,
								type: deposits.type,
								amountUsd: deposits.amountUsd,
								creditsIssued: deposits.creditsIssued,
								txHash: deposits.txHash,
								fromCoin: deposits.fromCoin,
								toCoin: deposits.toCoin,
								depositAddress: deposits.depositAddress,
								status: deposits.status,
								createdAt: deposits.createdAt,
								completedAt: deposits.completedAt,
						})
						.from(deposits)
						.where(eq(deposits.userId, userId))
						.orderBy(desc(deposits.createdAt)),
				db
						.select({
								balance_cents: creditBalances.balanceCents,
								total_deposited_cents: creditBalances.totalDepositedCents,
								total_used_cents: creditBalances.totalUsedCents,
								last_activity_at: creditBalances.lastActivityAt,
						})
						.from(creditBalances)
						.where(eq(creditBalances.userId, userId))
						.limit(1),
				db
						.select({
								id: auditLogs.id,
								action: auditLogs.action,
								resource: auditLogs.resource,
								resourceId: auditLogs.resourceId,
								ipAddress: auditLogs.ipAddress,
								userAgent: auditLogs.userAgent,
								metadata: auditLogs.metadata,
								createdAt: auditLogs.createdAt,
						})
						.from(auditLogs)
						.where(eq(auditLogs.userId, userId))
						.orderBy(desc(auditLogs.createdAt))
						.limit(10_000),
				db
						.select({
								id: sessionTable.id,
								token: sessionTable.token,
								ipAddress: sessionTable.ipAddress,
								userAgent: sessionTable.userAgent,
								createdAt: sessionTable.createdAt,
								updatedAt: sessionTable.updatedAt,
								expiresAt: sessionTable.expiresAt,
						})
						.from(sessionTable)
						.where(eq(sessionTable.userId, userId))
						.orderBy(desc(sessionTable.updatedAt)),
		]);

		const payload = {
				exportedAt: new Date().toISOString(),
				format: "oma-data-export.v1",
				profile: profile
						? {
										id: profile.id,
										name: profile.name,
										email: profile.email,
										emailVerified: profile.emailVerified,
										image: profile.image,
										evmAddress: profile.evmAddress,
										isAnonymous: profile.isAnonymous,
										role: profile.role,
										createdAt: profile.createdAt?.toISOString() ?? null,
										updatedAt: profile.updatedAt?.toISOString() ?? null,
								}
						: null,
				apiKeys: keys.map((k) => ({
						id: k.id,
						name: k.name,
						prefix: k.prefix,
						active: k.active,
						lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
						expiresAt: k.expiresAt?.toISOString() ?? null,
						createdAt: k.createdAt?.toISOString() ?? null,
				})),
				usageRecords: usage.map((u) => ({
						id: u.id,
						requestId: u.requestId,
						model: u.model,
						provider: u.provider,
						inputTokens: u.inputTokens,
						outputTokens: u.outputTokens,
						costCents: u.costCents,
						markupCents: u.markupCents,
						totalCents: u.totalCents,
						latencyMs: u.latencyMs,
						status: u.status,
						createdAt: u.createdAt?.toISOString() ?? null,
				})),
				deposits: depositsRows.map((d) => ({
						id: d.id,
						type: d.type,
						amountUsd: d.amountUsd,
						creditsIssued: d.creditsIssued,
						txHash: d.txHash,
						fromCoin: d.fromCoin,
						toCoin: d.toCoin,
						depositAddress: d.depositAddress,
						status: d.status,
						createdAt: d.createdAt?.toISOString() ?? null,
						completedAt: d.completedAt?.toISOString() ?? null,
				})),
				creditBalance: creditLedger[0]
						? {
										balanceCents: creditLedger[0].balance_cents,
										totalDepositedCents: creditLedger[0].total_deposited_cents,
										totalUsedCents: creditLedger[0].total_used_cents,
										lastActivityAt:
												creditLedger[0].last_activity_at?.toISOString() ?? null,
								}
						: null,
				auditLogs: auditRows.map((a) => ({
						id: a.id,
						action: a.action,
						resource: a.resource,
						resourceId: a.resourceId,
						ipAddress: a.ipAddress,
						userAgent: a.userAgent,
						metadata: a.metadata,
						createdAt: a.createdAt?.toISOString() ?? null,
				})),
				sessions: sessions.map((s) => ({
						id: s.id,
						ipAddress: s.ipAddress,
						userAgent: s.userAgent,
						createdAt: s.createdAt?.toISOString() ?? null,
						updatedAt: s.updatedAt?.toISOString() ?? null,
						expiresAt: s.expiresAt?.toISOString() ?? null,
				})),
		};

		// Compliance trail — every export is logged. We do NOT include
		// the payload itself; the user already has it.
		await auditLog({
				userId,
				action: "DATA_EXPORT_REQUESTED",
				resource: "data_export",
				resourceId: userId,
				metadata: {
						counts: {
								apiKeys: keys.length,
								usageRecords: usage.length,
								deposits: depositsRows.length,
								auditLogs: auditRows.length,
								sessions: sessions.length,
						},
				},
				ipAddress,
				userAgent,
		});

		const filename = `oma-data-export-${userId}.json`;
		logger.info(
				{
						userId,
						counts: {
								apiKeys: keys.length,
								usageRecords: usage.length,
								deposits: depositsRows.length,
								auditLogs: auditRows.length,
								sessions: sessions.length,
						},
				},
				"[export] full account data export",
		);

		return new Response(JSON.stringify(payload, null, 2), {
				headers: {
						"Content-Type": "application/json",
						"Content-Disposition": `attachment; filename="${filename}"`,
						"Cache-Control": "no-store",
				},
		});
});
