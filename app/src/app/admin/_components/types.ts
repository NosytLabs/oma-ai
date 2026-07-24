/**
 * Shared types for the admin page tab components.
 *
 * `AdminUser` lives in `@/lib/api/admin` because it mirrors the server API
 * contract — re-exporting it here would risk drift, so we import it directly.
 */

export type UsageStats = {
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
};

export type RevenueStats = {
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
};

export type ApiKey = {
	id: string;
	userId: string;
	userAddress: string;
	keyPrefix: string;
	name: string;
	active: boolean;
	createdAt: string;
	totalRequests: number;
	totalSpend: number;
	lastUsedAt: string | null;
};

export type AdminStats = {
	totalUsers: number;
	totalApiKeys: number;
	totalDollarsPurchased: number;
	totalUsageThisMonth: number;
	revenue: number;
	activeUsersLast24h: number;
	providerCosts: {
		venice: number;
		gonka: number;
	};
};

/**
 * `exportCSV` is small enough that we just thread it through props rather than
 * building a shared util. The shape matches the implementation in page.tsx.
 */
export type ExportCSV = (data: unknown[], filename: string) => void;