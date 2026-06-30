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
			`/v1/admin/users?page=${page}&limit=${limit}`,
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
		}>(`/v1/admin/usage?period=${period}`);
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
		}>(`/v1/admin/revenue?period=${period}`);
	},

	async getKeys(page: number, limit: number) {
		return request<unknown>(`/v1/admin/keys?page=${page}&limit=${limit}`);
	},
};
