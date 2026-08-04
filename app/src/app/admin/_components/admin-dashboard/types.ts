/**
 * Admin dashboard shared types and constants.
 */

export type TimeWindow = "7d" | "24h" | "30d";

export type UsageTotals = {
	requests: number;
	inputTokens: number;
	outputTokens: number;
	costCents: number;
	markupCents: number;
	totalCents: number;
};

export type PerModel = {
	model: string;
	provider: string;
	requests: number;
	inputTokens: number;
	outputTokens: number;
	totalCents: number;
};

export type UsageResponse = {
	window: string;
	since: string;
	totals: UsageTotals;
	perModel: PerModel[];
};

export type ModelRow = {
	id: string;
	displayName: string;
	provider: string;
	gonkaId: string | null;
	category: string;
	inputPricePer1M: number;
	outputPricePer1M: number;
	markupPercent: number;
	contextWindow: number | null;
	maxTokens: number;
	supportsStreaming: boolean;
	supportsTools: boolean;
	override: { inputPricePer1M: number; outputPricePer1M: number; updatedAt: string } | null;
};

export type RecentRow = {
	id: string;
	requestId: string;
	userId: string;
	model: string;
	provider: string;
	inputTokens: number;
	outputTokens: number;
	costCents: string;
	totalCents: string;
	status: string;
	createdAt: string;
};

export type AdminSettings = {
	maintenanceMode: boolean;
	cardPaymentsEnabled: boolean;
	cryptoPaymentsEnabled: boolean;
};

export type AdminUser = {
	id: string;
	name: string | null;
	email: string | null;
	evmAddress: string | null;
	role: string;
	banned: boolean;
	suspended: boolean;
	isAnonymous: boolean;
	createdAt: string;
	balanceCents: number;
	totalUsedCents: number;
	totalDepositedCents: number;
};

export type AuditEntry = {
	id: string;
	userId: string | null;
	action: string;
	resource: string;
	resourceId: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
};

export type AuditPage = {
	data: AuditEntry[];
	count: number;
	nextCursor: string | null;
	filters: {
		action: string | null;
		userId: string | null;
		from: string | null;
		to: string | null;
		limit: number;
	};
};

/** Values in the audit_action enum — for the action filter <select>. */
export const AUDIT_ACTIONS = [
	"USER_LOGIN",
	"USER_LOGOUT",
	"API_KEY_CREATED",
	"API_KEY_REVOKED",
	"USER_CREATED",
	"USER_UPDATED",
	"USER_DELETED",
	"USER_SUSPENDED",
	"USER_UNSUSPENDED",
	"CREDIT_ADJUSTED",
	"REFUND_ISSUED",
	"REFUND_GRANTED",
	"REFUND_DENIED",
	"DEPOSIT_CREATED",
	"DEPOSIT_COMPLETED",
	"DEPOSIT_FAILED",
	"WALLET_LINKED",
	"WALLET_UNLINKED",
	"WALLET_ROTATED",
	"ACCOUNT_NUMBER_ROTATED",
	"ACCOUNT_NUMBER_RECOVERED",
	"PROVIDER_TEST_SUCCESS",
	"PROVIDER_TEST_FAILED",
	"RATE_LIMIT_OVERRIDE_SET",
	"RATE_LIMIT_OVERRIDE_REMOVED",
	"ACCOUNT_LOGIN_RATE_LIMITED",
	"ACCOUNT_DELETE_REQUESTED",
	"ACCOUNT_DELETE_COMPLETED",
	"DATA_EXPORT_REQUESTED",
	"HISTORY_CLEARED",
] as const;

export type Integration = {
	polar: {
		configured: boolean;
		server: string;
		organizationId: string | null;
		note: string;
	};
	gonka: {
		configured: boolean;
		url: string;
		health: {
			status: "healthy" | "degraded" | "down";
			latencyMs?: number;
			note?: string;
			supportedModels?: string[];
		};
	};
	venice: {
		configured: boolean;
		url: string;
		private: boolean;
	};
	resend: { configured: boolean; from: string };
	node_env: string;
	dailyLimits: { anonymous: number; registered: number };
};

export type Health = {
	status: string;
	version: string;
	env: string;
	uptime_s: number;
	memory: { rss_mb: number; heap_used_mb: number };
	db: string;
	timestamp: string;
};

export type PolarPayment = {
	id: string;
	amount: number;
	currency: string;
	status: string;
	customer_email: string;
	metadata: Record<string, unknown>;
};
export type PolarCustomer = {
	id: string;
	email: string;
	name: string;
	metadata: Record<string, unknown>;
};
export type PolarProduct = {
	id: string;
	name: string;
	description: string;
	type: string;
	pricing: { type: string; amount?: number; currency?: string; interval?: string };
};
export type PolarSubscription = {
	id: string;
	customer_id: string;
	product_id: string;
	status: string;
	started_at: string;
	current_period_end: string;
};
export type PolarCheckout = {
	id: string;
	checkout_url: string;
	product_id: string;
	customer_email: string;
	status: string;
};

export type PolarTab = "payments" | "customers" | "checkouts" | "products" | "subscriptions";
