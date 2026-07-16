/**
 * Admin API namespace.
 * Server: /Users/tyson/Desktop/Code/OMA-AI/app/server/src/routes/admin/
 */
import { getCached, request, setCache } from "./client.js";
import type { User as ApiUser } from "./types.js";

export type AdminUser = ApiUser & {
	lastActivityAt: string | null;
	balanceCredits: number;
	totalDeposited: number;
	totalUsed: number;
	totalRequests: number;
};

const CACHE_ADMINS = "admins";

export const admin = {
	async getUsers(page: number, limit: number) {
		const cached = await getCached<{
			users: AdminUser[];
			pagination?: { total: number; page: number; limit: number };
		}>(CACHE_ADMINS);
		if (cached) return cached;
		const data = (await request(
			`/admin/users?page=${page}&limit=${limit}`,
		)) as unknown as {
			users: AdminUser[];
			pagination?: { total: number; page: number; limit: number };
		};
		setCache(CACHE_ADMINS, data);
		return data;
	},

	async getUsage(period: string) {
		return request<{
			period: string;
			summary: {
				totalRequests: number;
				totalInputTokens: number;
				totalOutputTokens: number;
				totalRevenue: number;
				totalCost: number;
				grossProfit: number;
				margin: string;
			};
			byProvider: Array<{
				provider: string;
				totalRequests: number;
				totalInputTokens: number;
				totalOutputTokens: number;
				totalRevenue: number;
				totalCost: number;
				profit: number;
			}>;
			byModel: Array<{
				model: string;
				provider: string;
				totalRequests: number;
				totalInputTokens: number;
				totalOutputTokens: number;
				totalRevenue: number;
			}>;
			dailyUsage: Array<{
				date: string;
				totalRequests: number;
				totalRevenue: number;
			}>;
		}>(`/admin/usage?period=${period}`);
	},

	async getRevenue(period: string) {
		return request<{
			period: string;
			summary: {
				totalRevenue: number;
				totalCost: number;
				grossProfit: number;
				totalDeposits: number;
				depositCount: number;
				newUsers: number;
			};
			monthlyRevenue: Array<{
				month: string;
				totalRevenue: number;
				depositCount: number;
			}>;
			dailyRevenue?: Array<{ date: string; revenue: number; cost: number }>;
		}>(`/admin/revenue?period=${period}`);
	},

	async getKeys(page: number, limit: number) {
		return request<unknown>(`/admin/keys?page=${page}&limit=${limit}`);
	},

	async getAuditLogs(params: {
		limit?: number;
		offset?: number;
		userId?: string;
		action?: string;
		resource?: string;
		startDate?: string;
		endDate?: string;
	}) {
		const qs = new URLSearchParams();
		if (params.limit != null) qs.set("limit", String(params.limit));
		if (params.offset != null) qs.set("offset", String(params.offset));
		if (params.userId) qs.set("userId", params.userId);
		if (params.action) qs.set("action", params.action);
		if (params.resource) qs.set("resource", params.resource);
		if (params.startDate) qs.set("startDate", params.startDate);
		if (params.endDate) qs.set("endDate", params.endDate);
		return request<{
			logs: Array<{
				id: string;
				userId: string | null;
				action: string;
				resource: string;
				resourceId: string | null;
				ipAddress: string | null;
				userAgent: string | null;
				metadata: Record<string, unknown> | null;
				createdAt: string;
			}>;
			pagination: { limit: number; offset: number; total: number };
		}>(`/v1/admin/audit-logs?${qs.toString()}`);
	},

	async getDlq(page = 1, limit = 50) {
		return request<{
			entries: Array<{
				orderId: string;
				amount: string;
				chain: string;
				attempts: number;
				lastError: string;
				createdAt: string;
				status: "retryable" | "permanently_failed";
			}>;
			pagination: { page: number; limit: number; total: number; pages: number };
			summary: { total: number; retryable: number; permanentlyFailed: number };
		}>(`/v1/admin/dlq/settlements?page=${page}&limit=${limit}`);
	},

	async retryDlq(id: string) {
		return request<{
			orderId: string;
			success: boolean;
			attempts: number;
			error: string | null;
			permanentlyFailed: boolean;
		}>(`/v1/admin/dlq/settlements/${id}/retry`, { method: "POST" });
	},

	async discardDlq(id: string) {
		return request<{ orderId: string; discarded: boolean }>(
			`/v1/admin/dlq/settlements/${id}/discard`,
			{ method: "POST" },
		);
	},

	async processDlq() {
		return request<{
			processed: number;
			results: Array<{
				orderId: string;
				success: boolean;
				attempts: number;
				error?: string;
				permanentlyFailed: boolean;
			}>;
		}>(`/v1/admin/dlq/settlements/process`, { method: "POST" });
	},

	async getRefunds(status = "pending", limit = 50, offset = 0) {
		return request<{
			status: string;
			refunds: Array<{
				id: string;
				userId: string;
				depositId: string | null;
				amountCents: number;
				reason: string | null;
				status: "pending" | "granted" | "denied";
				notes: string | null;
				decidedBy: string | null;
				decidedAt: string | null;
				createdAt: string;
			}>;
			pagination: { limit: number; offset: number; total: number; hasMore: boolean };
		}>(`/admin/refunds?status=${status}&limit=${limit}&offset=${offset}`);
	},

	async grantRefund(id: string, notes?: string) {
		return request<{
			ok: boolean;
			refundId: string;
			status: string;
			decidedBy: string;
			decidedAt: string;
			creditDebitStatus: string;
		}>(`/admin/refunds/${id}/grant`, {
			method: "POST",
			body: JSON.stringify({ notes: notes ?? null }),
		});
	},

	async denyRefund(id: string, notes: string) {
		return request<{
			ok: boolean;
			refundId: string;
			status: string;
			decidedBy: string;
			decidedAt: string;
		}>(`/admin/refunds/${id}/deny`, {
			method: "POST",
			body: JSON.stringify({ notes }),
		});
	},

	async getInvoices(page = 1, limit = 50, status?: string, userId?: string) {
		const qs = new URLSearchParams();
		qs.set("page", String(page));
		qs.set("limit", String(limit));
		if (status) qs.set("status", status);
		if (userId) qs.set("userId", userId);
		return request<{
			invoices: Array<{
				id: string;
				invoiceNumber: string;
				userId: string;
				amount: number;
				status: string;
				dueDate: string;
				createdAt: string;
				userAddress: string | null;
			}>;
			pagination: { page: number; limit: number; total: number; pages: number };
		}>(`/admin/invoices?${qs.toString()}`);
	},

	async getInvoice(id: string) {
		return request<{
			invoice: {
				id: string;
				invoiceNumber: string;
				userId: string;
				amount: number;
				status: string;
				lineItems: Record<string, unknown>[];
				dueDate: string;
				createdAt: string;
				user: { id: string; address: string; accountNumber: string } | null;
			};
		}>(`/admin/invoices/${id}`);
	},

	async createInvoice(body: {
		userId: string;
		amount: number;
		lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
		dueDate: string;
	}) {
		return request<{ invoice: Record<string, unknown> }>(`/admin/invoices`, {
			method: "POST",
			body: JSON.stringify(body),
		});
	},

	async getSurplusModels() {
		return request<unknown>(`/admin/surplus/models`);
	},

	async getSurplusHealth() {
		return request<{ isUp: boolean; latencyMs?: number; error?: string }>(
			`/admin/surplus/health`,
		);
	},

	async getSurplusConfig() {
		return request<{
			minDiscountPct: number;
			defaultScheme: string;
			settlementContract: string;
			permit2Contract: string;
			usdcContract: string;
			chainId: number;
			legacyVerifierContract: string | null;
		}>(`/admin/surplus/config`);
	},
};
