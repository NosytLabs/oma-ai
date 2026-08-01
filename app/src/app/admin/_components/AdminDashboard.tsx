
type TimeWindow = "7d" | "24h" | "30d";

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
	AlertTriangle,
	ArrowUpRight,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	CircleDot,
	Coins,
	CreditCard,
	Filter,
	Loader2,
	Lock,
	RefreshCcw,
	Search,
	Settings2,
	ShieldCheck,
	Unlock,
	XCircle,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/ui/Toast";

type UsageTotals = {
	requests: number;
	inputTokens: number;
	outputTokens: number;
	costCents: number;
	markupCents: number;
	totalCents: number;
};

type PerModel = {
	model: string;
	provider: string;
	requests: number;
	inputTokens: number;
	outputTokens: number;
	totalCents: number;
};

type UsageResponse = {
	window: string;
	since: string;
	totals: UsageTotals;
	perModel: PerModel[];
};

type ModelRow = {
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

type RecentRow = {
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

type AdminSettings = {
	maintenanceMode: boolean;
	cardPaymentsEnabled: boolean;
	cryptoPaymentsEnabled: boolean;
};

type AdminUser = {
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

type AuditEntry = {
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

type AuditPage = {
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

// All values currently in the audit_action enum — populated by the
// server migration 0037 + earlier migrations. Used to render the action
// filter <select> so admins don't have to type enum values by hand.
const AUDIT_ACTIONS = [
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

type Integration = {
	polar: {
		configured: boolean;
		server: string;
		organizationId: string | null;
		note: string;
	};
	gonka: {
		configured: boolean;
		url: string;
		health: { status: "healthy" | "degraded" | "down"; latencyMs?: number; note?: string };
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

type Health = {
	status: string;
	version: string;
	env: string;
	uptime_s: number;
	memory: { rss_mb: number; heap_used_mb: number };
	db: string;
	timestamp: string;
};

type PolarPayment = { id: string; amount: number; currency: string; status: string; customer_email: string; metadata: Record<string, unknown> };
type PolarCustomer = { id: string; email: string; name: string; metadata: Record<string, unknown> };
type PolarProduct = { id: string; name: string; description: string; type: string; pricing: { type: string; amount?: number; currency?: string; interval?: string } };
type PolarSubscription = { id: string; customer_id: string; product_id: string; status: string; started_at: string; current_period_end: string };
type PolarCheckout = { id: string; checkout_url: string; product_id: string; customer_email: string; status: string };

type PolarTab = "payments" | "customers" | "checkouts" | "products" | "subscriptions";

const ADMIN_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${ADMIN_BASE}${path}`, {
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status}: ${text || res.statusText}`);
	}
	return res.json() as Promise<T>;
}

function centsToDollars(cents: number) {
	if (!isFinite(cents)) return "$0.00";
	return `$${(cents / 100).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	})}`;
}

function formatTokens(n: number) {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function timeAgo(iso: string) {
	const ms = Date.now() - new Date(iso).getTime();
	if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
	if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
	if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
	return `${Math.floor(ms / 86_400_000)}d ago`;
}

async function polarFetch<T>(path: string): Promise<T> {
	const res = await fetch(`${ADMIN_BASE}${path}`, {
		credentials: "include",
		headers: { "Content-Type": "application/json" },
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status}: ${text || res.statusText}`);
	}
	return res.json() as Promise<T>;
}

export function AdminDashboard() {
	const toast = useToast();
	const [windowSel, setWindowSel] = useState<TimeWindow>("7d");
	const [usage, setUsage] = useState<UsageResponse | null>(null);
	const [models, setModels] = useState<ModelRow[]>([]);
	const [recent, setRecent] = useState<RecentRow[]>([]);
	const [health, setHealth] = useState<Health | null>(null);
	const [integrations, setIntegrations] = useState<Integration | null>(null);
	const [role, setRole] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
	const [promoting, setPromoting] = useState(false);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editInput, setEditInput] = useState("");
	const [editOutput, setEditOutput] = useState("");
	// Polar management state
	const [polarTab, setPolarTab] = useState<PolarTab>("payments");
	const [polarPayments, setPolarPayments] = useState<PolarPayment[]>([]);
	const [polarCustomers, setPolarCustomers] = useState<PolarCustomer[]>([]);
	const [polarProducts, setPolarProducts] = useState<PolarProduct[]>([]);
	const [polarSubscriptions, setPolarSubscriptions] = useState<PolarSubscription[]>([]);
	const [polarLoading, setPolarLoading] = useState(false);
	const [polarError, setPolarError] = useState<string | null>(null);
	// Checkout form
	const [checkoutProduct, setCheckoutProduct] = useState("");
	const [checkoutEmail, setCheckoutEmail] = useState("");
	const [checkoutName, setCheckoutName] = useState("");
	const [checkoutSuccess, setCheckoutSuccess] = useState("");
	const [checkoutCancel, setCheckoutCancel] = useState("");
	const [checkoutResult, setCheckoutResult] = useState<PolarCheckout | null>(null);
	const [settings, setSettings] = useState<AdminSettings | null>(null);
	const [updatingSettings, setUpdatingSettings] = useState(false);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [userSearch, setUserSearch] = useState("");
	const [selectedUserHistory, setSelectedUserHistory] = useState<RecentRow[] | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [creditAdjustAmount, setCreditAdjustAmount] = useState<Record<string, string>>({});
	// Slice 6 — modals + audit log + refund form
	const [creditAdjustModal, setCreditAdjustModal] = useState<{ userId: string; direction: "add" | "remove" } | null>(null);
	const [creditAdjustReason, setCreditAdjustReason] = useState("");
	const [suspendModal, setSuspendModal] = useState<{ userId: string; action: "suspend" | "unsuspend"; suspended: boolean } | null>(null);
	const [suspendReason, setSuspendReason] = useState("");
	const [auditEntries, setAuditEntries] = useState<AuditPage | null>(null);
	const [auditCursor, setAuditCursor] = useState<string | null>(null);
	const [auditCursorStack, setAuditCursorStack] = useState<string[]>([]);
	const [auditFilters, setAuditFilters] = useState<{
		action: string;
		userId: string;
		from: string;
		to: string;
	}>({
		action: "",
		userId: "",
		from: "",
		to: "",
	});
	const [auditLoading, setAuditLoading] = useState(false);
	const [refundForm, setRefundForm] = useState({
		paymentId: "",
		amountCents: "",
		reason: "",
		userId: "",
	});
	const [refundSubmitting, setRefundSubmitting] = useState(false);

	const refreshAll = useCallback(async () => {
		setLoading(true);
		try {
			const sessionData = await authClient.getSession();
			const userRole =
				((sessionData?.data?.user as { role?: string } | undefined)?.role ??
					null) as string | null;
			setRole(userRole);
			setIsAdmin(userRole === "admin");

			if (userRole !== "admin") {
				setLoading(false);
				return;
			}

			const qParam = userSearch.trim()
				? `?q=${encodeURIComponent(userSearch.trim())}`
				: "";
			const [u, m, r, h, i, s, uData] = await Promise.all([
				adminFetch<UsageResponse>(`/v1/admin/usage?window=${windowSel}`),
				adminFetch<{ data: ModelRow[] }>(`/v1/admin/models`),
				adminFetch<{ data: RecentRow[] }>(
					`/v1/admin/usage/recent?limit=30`,
				),
				adminFetch<Health>(`/v1/admin/health`),
				adminFetch<Integration>(`/v1/admin/integrations`),
			adminFetch<AdminSettings & { id?: string }>("/v1/admin/settings"),
			adminFetch<{ data: AdminUser[] }>(`/v1/admin/users${qParam}`),
			]);
			setUsage(u);
			setModels(m.data);
			setRecent(r.data);
			setHealth(h);
			setIntegrations(i);
			setSettings(s);
			setUsers(uData.data);
		} catch (err) {
			toast.error(`Failed to load admin data: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	}, [toast, windowSel, userSearch]);

	useEffect(() => {
		void refreshAll();
	}, [refreshAll]);

	const handlePromote = async () => {
		setPromoting(true);
		try {
			await adminFetch("/v1/admin/promote-self", { method: "POST" });
			toast.success("Promoted to admin — refresh to see the panel.");
			await refreshAll();
		} catch (err) {
			toast.error(`Promote failed: ${(err as Error).message}`);
		} finally {
			setPromoting(false);
		}
	};

	const handleToggleSetting = async (key: "maintenanceMode" | "cardPaymentsEnabled" | "cryptoPaymentsEnabled") => {
		if (!settings) return;
		setUpdatingSettings(true);
		const newValue = !settings[key];
		try {
			const res = await adminFetch<{ success: boolean; settings: AdminSettings }>("/v1/admin/settings", {
				method: "PATCH",
				body: JSON.stringify({ [key]: newValue }),
			});
			if (res.success) {
				setSettings(res.settings);
				toast.success(`Platform setting updated successfully.`);
			}
		} catch (err) {
			toast.error(`Failed to update setting: ${(err as Error).message}`);
		} finally {
			setUpdatingSettings(false);
		}
	};

	const handleCreditAdjust = async (userId: string, isTopUp: boolean) => {
		const amountStr = creditAdjustAmount[userId] || "";
		const amountCents = Math.round(parseFloat(amountStr) * 100);
		if (isNaN(amountCents) || amountCents <= 0) {
			toast.error("Please enter a valid USD amount");
			return;
		}
		// Open the modal so the operator confirms with a reason before
		// the dedicated /credits endpoint is hit. The reason is required
		// for audit logging (Slice 6).
		setCreditAdjustModal({ userId, direction: isTopUp ? "add" : "remove" });
	};

const handleConfirmCreditAdjust = async () => {
	if (!creditAdjustModal) return;
	const { userId, direction } = creditAdjustModal;
	const amountStr = creditAdjustAmount[userId] || "";
	const baseCents = Math.round(parseFloat(amountStr) * 100);
	if (isNaN(baseCents) || baseCents <= 0) {
		toast.error("Please enter a valid USD amount");
		return;
	}
	const reason = creditAdjustReason.trim();
	if (reason.length === 0) {
		toast.error("Reason is required for credit adjustments");
		return;
	}
	const signedAmount = direction === "add" ? baseCents : -baseCents;
	setUpdatingSettings(true);
	try {
		const res = await adminFetch<{
			success: boolean;
			balanceCents: number;
			totalDepositedCents: number;
			totalUsedCents: number;
		}>(`/v1/admin/users/${userId}/credits`, {
			method: "POST",
			body: JSON.stringify({ amountCents: signedAmount, reason }),
		});
		if (res.success) {
			setUsers((prev) =>
				prev.map((u) =>
					u.id === userId
						? {
								...u,
								balanceCents: res.balanceCents,
								totalDepositedCents: res.totalDepositedCents,
								totalUsedCents: res.totalUsedCents,
							}
						: u,
				),
			);
			toast.success(`Credits ${direction === "add" ? "added" : "drained"} successfully.`);
			setCreditAdjustAmount((prev) => ({ ...prev, [userId]: "" }));
			setCreditAdjustReason("");
			setCreditAdjustModal(null);
		}
	} catch (err) {
		toast.error(`Credit adjustment failed: ${(err as Error).message}`);
	} finally {
		setUpdatingSettings(false);
	}
};

const handleSuspendAction = (
	userId: string,
	suspended: boolean,
) => {
	setSuspendModal({ userId, action: suspended ? "suspend" : "unsuspend", suspended });
};

const handleConfirmSuspend = async () => {
	if (!suspendModal) return;
	const { userId, action } = suspendModal;
	const reason = suspendReason.trim();
	const endpoint =
		action === "suspend"
			? `/v1/admin/users/${userId}/suspend`
			: `/v1/admin/users/${userId}/unsuspend`;
	setUpdatingSettings(true);
	try {
		const res = await adminFetch<{
			success: boolean;
			revokedApiKeyCount?: number;
		}>(endpoint, {
			method: "POST",
			body: JSON.stringify(reason ? { reason } : {}),
		});
		if (res.success) {
			setUsers((prev) =>
				prev.map((u) =>
					u.id === userId ? { ...u, suspended: action === "suspend" } : u,
				),
			);
			toast.success(
				action === "suspend"
					? `User suspended${res.revokedApiKeyCount ? ` — ${res.revokedApiKeyCount} API key(s) revoked` : ""}.`
					: "User unsuspended.",
			);
			setSuspendModal(null);
			setSuspendReason("");
		}
	} catch (err) {
		toast.error(`Suspend failed: ${(err as Error).message}`);
	} finally {
		setUpdatingSettings(false);
	}
};

const handleRefundSubmit = async () => {
	if (!refundForm.paymentId.trim() || !refundForm.amountCents.trim() || !refundForm.reason.trim()) {
		toast.error("paymentId, amount (cents), and reason are required");
		return;
	}
	const amountCents = parseInt(refundForm.amountCents, 10);
	if (isNaN(amountCents) || amountCents <= 0) {
		toast.error("Amount must be a positive integer (cents)");
		return;
	}
	setRefundSubmitting(true);
	try {
		const res = await adminFetch<{
			success: boolean;
			polarRefundId: string | null;
			drainedUserId: string | null;
			drainedBalanceCents: number | null;
			warning: string | null;
		}>("/v1/admin/polar/refund", {
			method: "POST",
			body: JSON.stringify({
				paymentId: refundForm.paymentId.trim(),
				amountCents,
				reason: refundForm.reason.trim(),
				userId: refundForm.userId.trim() || undefined,
			}),
		});
		if (res.success) {
			if (res.warning) {
				toast.info(res.warning);
			} else {
				toast.success(
					`Refund issued${res.polarRefundId ? ` (Polar ${res.polarRefundId.slice(0, 10)}…)` : ""}.`,
				);
			}
			setRefundForm({ paymentId: "", amountCents: "", reason: "", userId: "" });
		}
	} catch (err) {
		toast.error(`Refund failed: ${(err as Error).message}`);
	} finally {
		setRefundSubmitting(false);
	}
};

const loadAudit = useCallback(
	async (cursor: string | null, pushStack: boolean) => {
		setAuditLoading(true);
		try {
			const params = new URLSearchParams();
			if (auditFilters.action) params.set("action", auditFilters.action);
			if (auditFilters.userId) params.set("userId", auditFilters.userId);
			if (auditFilters.from) params.set("from", new Date(auditFilters.from).toISOString());
			if (auditFilters.to) params.set("to", new Date(auditFilters.to).toISOString());
			params.set("limit", "50");
			if (cursor) params.set("cursor", cursor);
			const url = `/v1/admin/audit${params.toString() ? `?${params.toString()}` : ""}`;
			const page = await adminFetch<AuditPage>(url);
			setAuditEntries(page);
			setAuditCursor(page.nextCursor);
			if (pushStack && cursor) {
				setAuditCursorStack((prev) => [...prev, cursor]);
			} else if (!pushStack && cursor === null) {
				setAuditCursorStack([]);
			}
		} catch (err) {
			toast.error(`Audit log failed: ${(err as Error).message}`);
		} finally {
			setAuditLoading(false);
		}
	},
	[auditFilters, toast],
);

const handleAuditPrev = () => {
	const stack = auditCursorStack;
	if (stack.length === 0) return;
	const prevCursor = stack[stack.length - 1];
	const next = stack.slice(0, -1);
	setAuditCursorStack(next);
	void loadAudit(prevCursor, false);
};

	const handleViewUserHistory = async (userId: string) => {
		setSelectedUserId(userId);
		setLoadingHistory(true);
		try {
			const res = await adminFetch<{ data: RecentRow[] }>(`/v1/admin/usage/recent?limit=50&userId=${userId}`);
			setSelectedUserHistory(res.data);
		} catch (err) {
			toast.error(`Failed to load user history: ${(err as Error).message}`);
		} finally {
			setLoadingHistory(false);
		}
	};

	const handleEdit = async (modelId: string) => {
		try {
			await adminFetch(`/v1/admin/models/${modelId}`, {
				method: "PATCH",
				body: JSON.stringify({
					inputPricePer1M: Number(editInput),
					outputPricePer1M: Number(editOutput),
				}),
			});
			toast.success(`Updated pricing for ${modelId}`);
			setEditingId(null);
			await refreshAll();
		} catch (err) {
			toast.error(`Update failed: ${(err as Error).message}`);
		}
	};

	const startEdit = (m: ModelRow) => {
		setEditingId(m.id);
		setEditInput(String(m.inputPricePer1M));
		setEditOutput(String(m.outputPricePer1M));
	};

	const totalMarginPct = useMemo(() => {
		if (!usage) return 0;
		const { costCents, markupCents } = usage.totals;
		const base = costCents + markupCents;
		if (base <= 0) return 0;
		return (markupCents / base) * 100;
	}, [usage]);

	if (isAdmin === null) {
		return (
			<div className="flex items-center gap-2 text-text-muted">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading admin panel…
			</div>
		);
	}

	if (!isAdmin) {
		return (
			<div className="mx-auto mt-12 max-w-xl rounded-lg border border-border bg-surface-elevated/40 p-6 text-center">
				<ShieldCheck className="mx-auto mb-3 h-8 w-8 text-accent" />
				<h2 className="mb-2 text-lg font-medium">Admin access required</h2>
				<p className="mb-4 text-sm text-text-muted">
					You are signed in as <span className="font-mono">{role ?? "user"}</span>.
					Admins can edit model pricing, view usage analytics, and manage
					integrations.
				</p>
				<button
					type="button"
					onClick={handlePromote}
					disabled={promoting}
					className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium hover:bg-accent/20 disabled:opacity-50"
				>
					{promoting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<ShieldCheck className="h-4 w-4" />
					)}
					{role === "admin" ? "Already admin" : "Promote me to admin (dev)"}
				</button>
			</div>
		);
	}

	if (loading && !usage) {
		return (
			<div className="flex items-center gap-2 text-text-muted">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading dashboard…
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold">Operator dashboard</h1>
					<p className="text-sm text-text-muted">
						Live OMA-AI usage, pricing, and integration health.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex rounded-md border border-border bg-surface-elevated/40 p-1 text-xs">
						{(["24h", "7d", "30d"] as TimeWindow[]).map((w) => (
							<button
								key={w}
								type="button"
								onClick={() => setWindowSel(w)}
								className={`rounded px-3 py-1 transition ${
									w === windowSel
										? "bg-accent/20 text-accent"
										: "text-text-muted hover:text-text"
								}`}
							>
								{w}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={() => void refreshAll()}
						disabled={loading}
						className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated/40 px-3 py-1.5 text-xs hover:bg-surface-elevated disabled:opacity-50"
					>
						<Loader2 className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
						Refresh
					</button>
				</div>
			</header>

			<section className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<StatCard
					label="Requests"
					value={usage ? usage.totals.requests.toLocaleString() : "—"}
					icon={<CircleDot className="h-4 w-4" />}
					trend={windowSel}
				/>
				<StatCard
					label="Input tokens"
					value={usage ? formatTokens(usage.totals.inputTokens) : "—"}
					icon={<Coins className="h-4 w-4" />}
					trend={windowSel}
				/>
				<StatCard
					label="Output tokens"
					value={usage ? formatTokens(usage.totals.outputTokens) : "—"}
					icon={<Coins className="h-4 w-4" />}
					trend={windowSel}
				/>
				<StatCard
					label="Revenue (marked-up)"
					value={usage ? centsToDollars(usage.totals.totalCents) : "—"}
					icon={<CreditCard className="h-4 w-4" />}
					trend={`${totalMarginPct.toFixed(1)}% margin`}
				/>
			</section>

			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Model catalog & pricing
					</h2>
					<span className="text-xs text-text-muted">
						Edit input/output $/1M tokens. Live — affects every /v1/models response.
					</span>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="border-b border-border text-xs uppercase text-text-muted">
							<tr>
								<th className="py-2 text-left">Model</th>
								<th className="py-2 text-left">Provider</th>
								<th className="py-2 text-right">Input $/1M</th>
								<th className="py-2 text-right">Output $/1M</th>
								<th className="py-2 text-right">Markup</th>
								<th className="py-2"></th>
							</tr>
						</thead>
						<tbody>
							{models.map((m) => {
								const isEditing = editingId === m.id;
								return (
									<tr key={m.id} className="border-b border-border/30">
										<td className="py-2 font-medium">
											{m.displayName}
											<div className="font-mono text-[10px] text-text-muted">
												{m.id} {m.gonkaId ? `→ ${m.gonkaId}` : ""}
											</div>
										</td>
										<td className="py-2">
											<span className="rounded bg-surface-elevated px-2 py-0.5 text-xs uppercase">
												{m.provider}
											</span>
										</td>
										<td className="py-2 text-right font-mono">
											{isEditing ? (
												<input
													type="number"
													step="0.001"
													min="0"
													value={editInput}
													onChange={(e) => setEditInput(e.target.value)}
													className="w-20 rounded border border-border bg-surface-elevated px-1.5 py-1 text-right text-xs"
												/>
											) : (
												`$${m.inputPricePer1M.toFixed(4)}`
											)}
											{m.override && (
												<div className="text-[10px] text-text-muted">
													override · {timeAgo(m.override.updatedAt)}
												</div>
											)}
										</td>
										<td className="py-2 text-right font-mono">
											{isEditing ? (
												<input
													type="number"
													step="0.001"
													min="0"
													value={editOutput}
													onChange={(e) => setEditOutput(e.target.value)}
													className="w-20 rounded border border-border bg-surface-elevated px-1.5 py-1 text-right text-xs"
												/>
											) : (
												`$${m.outputPricePer1M.toFixed(4)}`
											)}
										</td>
										<td className="py-2 text-right text-text-muted">
											{m.markupPercent}%
										</td>
										<td className="py-2 text-right">
											{isEditing ? (
												<div className="flex justify-end gap-1">
													<button
														type="button"
														onClick={() => void handleEdit(m.id)}
														className="rounded bg-accent/20 px-2 py-1 text-xs text-accent hover:bg-accent/30"
													>
														Save
													</button>
													<button
														type="button"
														onClick={() => setEditingId(null)}
														className="rounded px-2 py-1 text-xs text-text-muted hover:text-text"
													>
														Cancel
													</button>
												</div>
											) : (
												<button
													type="button"
													onClick={() => startEdit(m)}
													className="text-xs text-text-muted hover:text-text"
												>
													edit
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</section>

			{settings && (
				<section className="rounded-lg border border-border bg-surface-elevated/30 p-4 space-y-4">
					<div>
						<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
							Platform Controls
						</h2>
						<p className="text-xs text-text-muted mt-0.5">
							Toggle runtime gates, payments, and global maintenance mode.
						</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-3">
						{/* Maintenance Mode */}
						<div className="flex flex-col justify-between p-4 rounded-lg border border-border bg-surface-elevated/40">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<AlertTriangle className={`h-4 w-4 ${settings.maintenanceMode ? "text-error animate-pulse" : "text-text-muted"}`} />
									<span className="text-sm font-medium">Maintenance Mode</span>
								</div>
								<p className="text-xs text-text-muted">
									Blocks all non-admin gateway requests with a 503 message.
								</p>
							</div>
							<div className="mt-4 flex items-center justify-between">
								<span className={`text-xs font-mono px-2 py-0.5 rounded ${settings.maintenanceMode ? "bg-error/10 text-error" : "bg-text-muted/10 text-text-muted"}`}>
									{settings.maintenanceMode ? "ACTIVE (BLOCKED)" : "INACTIVE (ONLINE)"}
								</span>
								<button
									type="button"
									disabled={updatingSettings}
									onClick={() => handleToggleSetting("maintenanceMode")}
									className={`text-xs px-3 py-1.5 rounded-md border font-medium transition ${
										settings.maintenanceMode
											? "bg-error/10 border-error/40 text-error hover:bg-error/20"
											: "bg-surface border-border hover:bg-surface-elevated"
									}`}
								>
									Toggle
								</button>
							</div>
						</div>

						{/* Card Payments */}
						<div className="flex flex-col justify-between p-4 rounded-lg border border-border bg-surface-elevated/40">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<CreditCard className={`h-4 w-4 ${settings.cardPaymentsEnabled ? "text-success" : "text-text-muted"}`} />
									<span className="text-sm font-medium">Card Payments (Polar)</span>
								</div>
								<p className="text-xs text-text-muted">
									Controls if users can purchase Credits using Stripe / Card.
								</p>
							</div>
							<div className="mt-4 flex items-center justify-between">
								<span className={`text-xs font-mono px-2 py-0.5 rounded ${settings.cardPaymentsEnabled ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
									{settings.cardPaymentsEnabled ? "ENABLED" : "DISABLED"}
								</span>
								<button
									type="button"
									disabled={updatingSettings}
									onClick={() => handleToggleSetting("cardPaymentsEnabled")}
									className={`text-xs px-3 py-1.5 rounded-md border font-medium transition ${
										!settings.cardPaymentsEnabled
											? "bg-error/10 border-error/40 text-error hover:bg-error/20"
											: "bg-surface border-border hover:bg-surface-elevated"
									}`}
								>
									Toggle
								</button>
							</div>
						</div>

						{/* Crypto Payments */}
						<div className="flex flex-col justify-between p-4 rounded-lg border border-border bg-surface-elevated/40">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<Coins className={`h-4 w-4 ${settings.cryptoPaymentsEnabled ? "text-success" : "text-text-muted"}`} />
									<span className="text-sm font-medium">Crypto Payments (x402)</span>
								</div>
								<p className="text-xs text-text-muted">
									Controls if users can make USDC direct deposits on Base.
								</p>
							</div>
							<div className="mt-4 flex items-center justify-between">
								<span className={`text-xs font-mono px-2 py-0.5 rounded ${settings.cryptoPaymentsEnabled ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
									{settings.cryptoPaymentsEnabled ? "ENABLED" : "DISABLED"}
								</span>
								<button
									type="button"
									disabled={updatingSettings}
									onClick={() => handleToggleSetting("cryptoPaymentsEnabled")}
									className={`text-xs px-3 py-1.5 rounded-md border font-medium transition ${
										!settings.cryptoPaymentsEnabled
											? "bg-error/10 border-error/40 text-error hover:bg-error/20"
											: "bg-surface border-border hover:bg-surface-elevated"
									}`}
								>
									Toggle
								</button>
							</div>
						</div>
					</div>
				</section>
			)}

			{integrations && (
				<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
					<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
						Integrations
					</h2>
					<div className="grid gap-3 md:grid-cols-3">
						<IntegrationCard
							name="Polar"
							icon={<CreditCard className="h-4 w-4" />}
							configured={integrations.polar.configured}
							notes={[
								`server: ${integrations.polar.server}`,
								integrations.polar.organizationId
									? `org: ${integrations.polar.organizationId.slice(0, 8)}…`
									: null,
								integrations.polar.note,
						 ].filter(Boolean) as string[]}
						/>
						<IntegrationCard
							name="Gonka / OpenBroker"
							icon={<ChevronRight className="h-4 w-4" />}
							configured={integrations.gonka.configured}
							health={integrations.gonka.health.status}
							notes={[
								integrations.gonka.health.latencyMs
									? `latency: ${integrations.gonka.health.latencyMs}ms`
									: null,
								integrations.gonka.health.note,
								integrations.gonka.url.replace("https://", ""),
							].filter(Boolean) as string[]}
						/>
						<IntegrationCard
							name="Venice"
							icon={<Settings2 className="h-4 w-4" />}
							configured={integrations.venice.configured}
							notes={[
								integrations.venice.private
									? "private mode enforced"
									: "non-private mode enabled",
								integrations.venice.url.replace("https://", ""),
							]}
						/>
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
						<span>
							Free chat: anon {integrations.dailyLimits.anonymous}/day · signed-in{" "}
							{integrations.dailyLimits.registered}/day
						</span>
						<span>·</span>
						<span>env: {integrations.node_env}</span>
						{health && (
							<>
								<span>·</span>
								<span>
									uptime {Math.floor(health.uptime_s / 60)}m · RAM{" "}
									{health.memory.heap_used_mb} MB · db {health.db}
								</span>
							</>
						)}
					</div>
				</section>
			)}

			{usage?.perModel && usage.perModel.length > 0 && (
				<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
					<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
						Top models ({windowSel})
					</h2>
					<div className="space-y-2">
						{usage.perModel.slice(0, 8).map((m) => {
							const max = Math.max(...usage.perModel.map((x) => x.totalCents));
							const pct = max > 0 ? (m.totalCents / max) * 100 : 0;
							return (
								<div key={`${m.model}-${m.provider}`} className="text-sm">
									<div className="mb-1 flex items-center justify-between text-xs">
										<span className="font-mono">
											{m.model}{" "}
											<span className="text-text-muted">· {m.provider}</span>
										</span>
										<span>
											{m.requests.toLocaleString()} req · {formatTokens(m.inputTokens)}/
											{formatTokens(m.outputTokens)} tok · {centsToDollars(m.totalCents)}
										</span>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
										<div
											className="h-full rounded-full bg-accent/60"
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</section>
			)}

			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Recent requests
					</h2>
					<span className="text-xs text-text-muted">
						{recent.length} of last {Math.min(recent.length, 30)}
					</span>
				</div>
				{recent.length === 0 ? (
					<p className="py-6 text-center text-sm text-text-muted">
						No chat usage yet — get someone to send a message to populate this
						view.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-xs">
							<thead className="border-b border-border text-text-muted">
								<tr>
									<th className="py-1.5 text-left">When</th>
									<th className="py-1.5 text-left">Model</th>
									<th className="py-1.5 text-right">Tokens</th>
									<th className="py-1.5 text-right">Cost</th>
									<th className="py-1.5 text-left">Status</th>
									<th className="py-1.5 text-left">User</th>
								</tr>
							</thead>
							<tbody>
								{recent.map((r) => (
									<tr key={r.id} className="border-b border-border/30">
										<td className="py-1.5 text-text-muted">
											{timeAgo(r.createdAt)}
										</td>
										<td className="py-1.5 font-mono">{r.model}</td>
										<td className="py-1.5 text-right font-mono">
											{r.inputTokens.toLocaleString()}/
											{r.outputTokens.toLocaleString()}
										</td>
										<td className="py-1.5 text-right font-mono">
											{centsToDollars(Number(r.totalCents))}
										</td>
										<td className="py-1.5">
											<span
												className={`rounded px-1.5 py-0.5 text-[10px] ${
													r.status === "completed" || r.status === "free_tier"
														? "bg-accent/15 text-accent"
														: "bg-error/15 text-error"
												}`}
											>
												{r.status}
											</span>
										</td>
										<td className="py-1.5 text-text-muted">
											{r.userId.slice(0, 8)}…
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* User Directory */}
			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4 space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
								User Directory
							</h2>
							<p className="text-xs text-text-muted mt-0.5">
								Manage permissions, edit Credits, and audit individual user request logs.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<div className="relative">
								<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
								<input
									type="text"
									value={userSearch}
									onChange={(e) => setUserSearch(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") void refreshAll();
									}}
									placeholder="email / wallet / id / account #"
									className="w-56 rounded border border-border bg-surface-elevated pl-7 pr-2 py-1 text-xs focus:border-accent outline-none"
								/>
							</div>
							<button
								type="button"
								onClick={() => void refreshAll()}
								disabled={loading}
								className="inline-flex items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface disabled:opacity-50"
							>
								<Filter className="h-3 w-3" />
								Filter
							</button>
							<span className="text-xs text-text-muted">
								{users.length} {userSearch.trim() ? "match" : "registered accounts"}
							</span>
						</div>
					</div>

					{users.length === 0 ? (
						<p className="py-6 text-center text-sm text-text-muted">
							{userSearch.trim()
								? `No users match "${userSearch.trim()}".`
								: "No users yet."}
						</p>
					) : (
					<>
					<div className="overflow-x-auto">
						<table className="w-full text-xs text-left">
							<thead className="border-b border-border text-text-muted uppercase tracking-wider text-[10px]">
								<tr>
									<th className="py-2 text-left">User details</th>
									<th className="py-2 text-center">Status</th>
									<th className="py-2 text-right">Deposited</th>
									<th className="py-2 text-right">Used</th>
									<th className="py-2 text-right">Credits</th>
									<th className="py-2 text-center">Credit Adjust (USD)</th>
									<th className="py-2 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{users.map((u) => {
									const isTargetHistory = selectedUserId === u.id;
									return (
										<tr key={u.id} className="border-b border-border/30 hover:bg-surface-elevated/20 transition-colors">
											<td className="py-3">
												<div className="font-semibold text-text-bright flex items-center gap-1.5">
													{u.name || "Anonymous User"}
													{u.role === "admin" && (
														<span className="bg-accent/15 text-accent border border-accent/20 rounded px-1.5 py-0.5 text-[9px] font-mono uppercase">
															Admin
														</span>
													)}
												</div>
												<div className="text-text-muted font-mono text-[10px] mt-0.5 space-y-0.5">
													{u.email && <div>email: {u.email}</div>}
													{u.evmAddress && <div className="break-all">wallet: {u.evmAddress}</div>}
													<div className="text-[9px]">ID: {u.id} · joined {new Date(u.createdAt).toLocaleDateString()}</div>
												</div>
											</td>
											<td className="py-3 text-center">
												<span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
													u.suspended || u.banned
														? "bg-error/15 text-error border border-error/25"
														: "bg-success/15 text-success border border-success/25"
												}`}>
													{u.suspended ? "Suspended (admin)" : u.banned ? "Suspended" : "Active"}
												</span>
											</td>
											<td className="py-3 text-right font-mono font-medium">
												{centsToDollars(u.totalDepositedCents)}
											</td>
											<td className="py-3 text-right font-mono text-text-secondary">
												{centsToDollars(u.totalUsedCents)}
											</td>
											<td className="py-3 text-right font-mono font-semibold text-text-bright">
												{centsToDollars(u.balanceCents)}
											</td>
											<td className="py-3">
												<div className="flex items-center justify-center gap-1 max-w-[160px] mx-auto">
													<input
														type="number"
														step="0.1"
														min="0.01"
														placeholder="$5.00"
														value={creditAdjustAmount[u.id] || ""}
														onChange={(e) => setCreditAdjustAmount((prev) => ({ ...prev, [u.id]: e.target.value }))}
														className="w-16 rounded border border-border bg-surface-elevated px-2 py-1 text-right text-xs focus:border-accent outline-none"
													/>
													<button
														type="button"
														disabled={updatingSettings}
														onClick={() => handleCreditAdjust(u.id, true)}
														className="rounded border border-success/30 bg-success/10 px-1.5 py-1 text-[10px] font-semibold text-success hover:bg-success/20"
													>
														+
													</button>
													<button
														type="button"
														disabled={updatingSettings}
														onClick={() => handleCreditAdjust(u.id, false)}
														className="rounded border border-error/30 bg-error/10 px-1.5 py-1 text-[10px] font-semibold text-error hover:bg-error/20"
													>
														-
													</button>
												</div>
											</td>
											<td className="py-3 text-right space-y-1.5">
												<div className="flex justify-end gap-1.5">
													<button
														type="button"
														disabled={updatingSettings}
														onClick={() => handleSuspendAction(u.id, !u.suspended)}
														title={u.suspended ? "Unsuspend user" : "Suspend user (revokes API keys)"}
														className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium border transition-colors ${
															u.suspended
																? "bg-success/10 border-success/30 text-success hover:bg-success/20"
																: "bg-error/10 border-error/30 text-error hover:bg-error/20"
														}`}
													>
														{u.suspended ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
														{u.suspended ? "Unsuspend" : "Suspend"}
													</button>
													<button
														type="button"
														disabled={updatingSettings || loadingHistory}
														onClick={() => handleViewUserHistory(u.id)}
														className={`rounded px-2.5 py-1 text-[10px] font-medium border border-border bg-surface hover:bg-surface-elevated transition-colors ${
															isTargetHistory ? "border-accent text-accent" : "text-text"
														}`}
													>
														History
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Individual User History Portal */}
					{selectedUserId && (
						<div className="border-t border-border pt-4 mt-2 space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
									<ChevronRight className="w-3.5 h-3.5" />
									History logs for user: <span className="font-mono text-[10px] text-accent font-normal bg-accent/10 px-1.5 py-0.5 rounded">{selectedUserId}</span>
								</h3>
								<button
									type="button"
									onClick={() => {
										setSelectedUserId(null);
										setSelectedUserHistory(null);
									}}
									className="text-xs text-text-muted hover:text-text"
								>
									Close history
								</button>
							</div>

							{loadingHistory ? (
								<div className="flex items-center gap-1.5 text-xs text-text-muted py-2">
									<Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching logs...
								</div>
							) : selectedUserHistory === null || selectedUserHistory.length === 0 ? (
								<p className="text-xs text-text-muted py-2">
									No request history found for this user in the specified limit.
								</p>
							) : (
								<div className="overflow-x-auto max-h-[250px] overflow-y-auto rounded border border-border bg-panel/30">
									<table className="w-full text-[11px] text-left">
										<thead className="border-b border-border bg-surface-elevated/40 text-[9px] uppercase text-text-muted">
											<tr>
												<th className="p-2">When</th>
												<th className="p-2">Request ID</th>
												<th className="p-2">Model</th>
												<th className="p-2 text-right">Tokens</th>
												<th className="p-2 text-right">Cost</th>
												<th className="p-2">Status</th>
											</tr>
										</thead>
										<tbody>
											{selectedUserHistory.map((h) => (
												<tr key={h.id} className="border-b border-border/20 hover:bg-surface-elevated/10">
													<td className="p-2 text-text-muted">{timeAgo(h.createdAt)}</td>
													<td className="p-2 font-mono text-[9px] text-text-secondary">{h.requestId.slice(0, 16)}…</td>
													<td className="p-2 font-mono">{h.model}</td>
													<td className="p-2 text-right font-mono">
														{h.inputTokens.toLocaleString()}/{h.outputTokens.toLocaleString()}
													</td>
													<td className="p-2 text-right font-mono">{centsToDollars(Number(h.totalCents))}</td>
													<td className="p-2">
														<span className={`rounded px-1 py-0.2 text-[9px] ${
															h.status === "completed" || h.status === "free_tier"
																? "bg-accent/15 text-accent"
																: "bg-error/15 text-error"
														}`}>
															{h.status}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}
					</>
					)}
				</section>

			{/* Polar Management */}
			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Polar Payments
					</h2>
					<div className="flex gap-1 text-xs">
						{(
							[
								"payments",
								"customers",
								"products",
								"subscriptions",
								"checkouts",
							] as PolarTab[]
						).map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => {
									setPolarTab(tab);
									setPolarError(null);
								}}
								className={`rounded px-2 py-1 transition ${
									polarTab === tab
										? "bg-accent/20 text-accent"
										: "text-text-muted hover:text-text"
								}`}
							>
								{tab}
							</button>
						))}
					</div>
				</div>
				{polarError && (
					<div className="mb-3 rounded-md bg-error/10 p-2 text-xs text-error">
						{polarError}
					</div>
				)}
				{polarLoading ? (
					<div className="flex items-center gap-2 text-text-muted">
						<Loader2 className="h-4 w-4 animate-spin" /> Loading…
					</div>
				) : polarTab === "payments" ? (
					polarPayments.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No payments yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-right">Amount</th>
										<th className="py-1.5 text-left">Status</th>
										<th className="py-1.5 text-left">Customer</th>
									</tr>
								</thead>
								<tbody>
									{polarPayments.map((p) => (
										<tr
											key={p.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{p.id.slice(0, 12)}…
											</td>
											<td className="py-1.5 text-right font-mono">
												{(p.amount / 100).toFixed(2)}{" "}
												{p.currency.toUpperCase()}
											</td>
											<td className="py-1.5">
												<span
													className={`rounded px-1.5 py-0.5 text-[10px] ${
														p.status === "paid" || p.status === "completed"
															? "bg-accent/15 text-accent"
															: "bg-warning/15 text-warning"
													}`}
												>
													{p.status}
												</span>
											</td>
											<td className="py-1.5 text-text-muted">
												{p.customer_email}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "customers" ? (
					polarCustomers.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No customers yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Name</th>
										<th className="py-1.5 text-left">Email</th>
									</tr>
								</thead>
								<tbody>
									{polarCustomers.map((c) => (
										<tr
											key={c.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{c.id.slice(0, 12)}…
											</td>
											<td className="py-1.5">{c.name || "—"}</td>
											<td className="py-1.5 text-text-muted">
												{c.email}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "products" ? (
					polarProducts.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No products yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Name</th>
										<th className="py-1.5 text-left">Type</th>
										<th className="py-1.5 text-right">Price</th>
									</tr>
								</thead>
								<tbody>
									{polarProducts.map((p) => (
										<tr
											key={p.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{p.id.slice(0, 12)}…
											</td>
											<td className="py-1.5">{p.name}</td>
											<td className="py-1.5">
												<span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] uppercase">
													{p.type}
												</span>
											</td>
											<td className="py-1.5 text-right font-mono">
												{p.pricing?.amount !== undefined
													? `${(p.pricing.amount / 100).toFixed(2)} ${p.pricing.currency?.toUpperCase() ?? "USD"}`
													: "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "subscriptions" ? (
					polarSubscriptions.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No subscriptions yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Customer</th>
										<th className="py-1.5 text-left">Product</th>
										<th className="py-1.5 text-left">Status</th>
									</tr>
								</thead>
								<tbody>
									{polarSubscriptions.map((s) => (
										<tr
											key={s.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{s.id.slice(0, 12)}…
											</td>
											<td className="py-1.5 font-mono text-text-muted">
												{s.customer_id.slice(0, 12)}…
											</td>
											<td className="py-1.5 font-mono text-text-muted">
												{s.product_id.slice(0, 12)}…
											</td>
											<td className="py-1.5">
												<span
													className={`rounded px-1.5 py-0.5 text-[10px] ${
														s.status === "active"
															? "bg-accent/15 text-accent"
															: "bg-text-muted/15 text-text-muted"
													}`}
												>
													{s.status}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "checkouts" ? (
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Product ID
								</label>
								<input
									type="text"
									value={checkoutProduct}
									onChange={(e) => setCheckoutProduct(e.target.value)}
									placeholder="prod_xxx"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Customer Email
								</label>
								<input
									type="email"
									value={checkoutEmail}
									onChange={(e) => setCheckoutEmail(e.target.value)}
									placeholder="user@example.com"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Customer Name (optional)
								</label>
								<input
									type="text"
									value={checkoutName}
									onChange={(e) => setCheckoutName(e.target.value)}
									placeholder="John Doe"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Success URL (optional)
								</label>
								<input
									type="url"
									value={checkoutSuccess}
									onChange={(e) => setCheckoutSuccess(e.target.value)}
									placeholder="https://example.com/success"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
						</div>
						<div>
							<label className="mb-1 block text-xs text-text-muted">
								Cancel URL (optional)
							</label>
							<input
								type="url"
								value={checkoutCancel}
								onChange={(e) => setCheckoutCancel(e.target.value)}
								placeholder="https://example.com/cancel"
								className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<button
							type="button"
							onClick={async () => {
								setPolarError(null);
								setPolarLoading(true);
								try {
									const result = await polarFetch<{
										data: PolarCheckout;
									}>(`/v1/admin/polar/checkouts`);
									setCheckoutResult(result.data);
								} catch (err) {
									setPolarError(String((err as Error).message ?? err));
								} finally {
									setPolarLoading(false);
								}
							}}
							disabled={polarLoading || !checkoutProduct}
							className="rounded-md bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
						>
							{polarLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Create Checkout Link"
							)}
						</button>
						{checkoutResult && (
							<div className="rounded-md border border-border bg-surface-elevated/50 p-3">
								<p className="text-xs text-text-muted mb-2">
									Checkout created — share this link:
								</p>
								<a
									href={checkoutResult.checkout_url}
									target="_blank"
									rel="noopener noreferrer"
									className="break-all text-sm font-mono text-accent hover:underline"
								>
									{checkoutResult.checkout_url}
								</a>
							</div>
						)}
					</div>
				) : null}
				{polarTab !== "checkouts" && (polarPayments.length > 0 || polarCustomers.length > 0 || polarProducts.length > 0 || polarSubscriptions.length > 0) && (
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={async () => {
								setPolarError(null);
								setPolarLoading(true);
								try {
									if (polarTab === "payments") {
										const data = await polarFetch<{ data: PolarPayment[] }>("/v1/admin/polar/payments");
										setPolarPayments(data.data);
									} else if (polarTab === "customers") {
										const data = await polarFetch<{ data: PolarCustomer[] }>("/v1/admin/polar/customers");
										setPolarCustomers(data.data);
									} else if (polarTab === "products") {
										const data = await polarFetch<{ data: PolarProduct[] }>("/v1/admin/polar/products");
										setPolarProducts(data.data);
									} else if (polarTab === "subscriptions") {
										const data = await polarFetch<{ data: PolarSubscription[] }>("/v1/admin/polar/subscriptions");
										setPolarSubscriptions(data.data);
									}
								} catch (err) {
									setPolarError(String((err as Error).message ?? err));
								} finally {
									setPolarLoading(false);
								}
							}}
							disabled={polarLoading}
							className="rounded-md border border-border bg-surface-elevated/40 px-3 py-1.5 text-xs hover:bg-surface-elevated disabled:opacity-50"
						>
							{polarLoading ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								"Refresh"
							)}
						</button>
					</div>
				)}
			</section>

			{/* Refund Tool — Slice 6 */}
			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4 space-y-4">
				<div>
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Issue Refund
					</h2>
					<p className="text-xs text-text-muted mt-0.5">
						Refund a Polar payment and drain the corresponding credits from the
						user&rsquo;s balance. Every refund writes a REFUND_ISSUED audit entry.
					</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<label className="mb-1 block text-xs text-text-muted">
							Payment / Order ID
						</label>
						<input
							type="text"
							value={refundForm.paymentId}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, paymentId: e.target.value }))}
							placeholder="pay_xxx / ord_xxx"
							className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-text-muted">
							Amount (cents)
						</label>
						<input
							type="number"
							min={1}
							value={refundForm.amountCents}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, amountCents: e.target.value }))}
							placeholder="500 = $5.00"
							className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div className="sm:col-span-2">
						<label className="mb-1 block text-xs text-text-muted">
							Reason (required)
						</label>
						<input
							type="text"
							value={refundForm.reason}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, reason: e.target.value }))}
							placeholder="customer request, fraud, ..."
							className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div className="sm:col-span-2">
						<label className="mb-1 block text-xs text-text-muted">
							User ID (optional — pin refund to a specific user)
						</label>
						<input
							type="text"
							value={refundForm.userId}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, userId: e.target.value }))}
							placeholder="usr_xxx (leave blank to auto-resolve from Polar)"
							className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm font-mono outline-none focus:border-accent"
						/>
					</div>
				</div>
				<div className="flex justify-end">
					<button
						type="button"
						onClick={() => void handleRefundSubmit()}
						disabled={refundSubmitting}
						className="inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-medium text-warning hover:bg-warning/20 disabled:opacity-50"
					>
						{refundSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCcw className="h-4 w-4" />
						)}
						Issue refund
					</button>
				</div>
			</section>

			{/* Audit Log Viewer — Slice 6 (filters + cursor pagination) */}
			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4 space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
							Audit Log
						</h2>
						<p className="text-xs text-text-muted mt-0.5">
							Filterable, paginated view of every admin and operator action.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void loadAudit(null, false)}
						disabled={auditLoading}
						className="inline-flex items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface disabled:opacity-50"
					>
						{auditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Filter className="h-3 w-3" />}
						Load
					</button>
				</div>
				<div className="grid gap-2 sm:grid-cols-4">
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							Action
						</label>
						<select
							value={auditFilters.action}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, action: e.target.value }))
							}
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						>
							<option value="">All actions</option>
							{AUDIT_ACTIONS.map((a) => (
								<option key={a} value={a}>
									{a}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							User ID
						</label>
						<input
							type="text"
							value={auditFilters.userId}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, userId: e.target.value }))
							}
							placeholder="usr_xxx"
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							From
						</label>
						<input
							type="datetime-local"
							value={auditFilters.from}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, from: e.target.value }))
							}
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							To
						</label>
						<input
							type="datetime-local"
							value={auditFilters.to}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, to: e.target.value }))
							}
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						/>
					</div>
				</div>

				{auditEntries ? (
					<div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded border border-border">
						<table className="w-full text-[11px] text-left">
							<thead className="border-b border-border bg-surface-elevated/40 text-[9px] uppercase text-text-muted sticky top-0">
								<tr>
									<th className="p-2">When</th>
									<th className="p-2">Action</th>
									<th className="p-2">Resource</th>
									<th className="p-2">User</th>
									<th className="p-2">Metadata</th>
								</tr>
							</thead>
							<tbody>
								{auditEntries.data.length === 0 ? (
									<tr>
										<td colSpan={5} className="p-3 text-center text-text-muted">
											No audit entries match these filters.
										</td>
									</tr>
								) : (
									auditEntries.data.map((entry) => (
										<tr
											key={entry.id}
											className="border-b border-border/20 hover:bg-surface-elevated/10"
										>
											<td className="p-2 text-text-muted">{timeAgo(entry.createdAt)}</td>
											<td className="p-2">
												<span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px]">
													{entry.action}
												</span>
											</td>
											<td className="p-2 font-mono text-text-secondary">
												{entry.resource}
												{entry.resourceId ? (
													<span className="ml-1 text-text-muted">
														· {entry.resourceId.slice(0, 12)}…
													</span>
												) : null}
											</td>
											<td className="p-2 font-mono text-text-muted">
												{entry.userId ? entry.userId.slice(0, 12) + "…" : "—"}
											</td>
											<td className="p-2 font-mono text-[10px] text-text-muted truncate max-w-[280px]">
												{entry.metadata
													? JSON.stringify(entry.metadata).slice(0, 80) +
													  (JSON.stringify(entry.metadata).length > 80 ? "…" : "")
													: "—"}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-xs text-text-muted py-3">
						Click <span className="font-mono">Load</span> to fetch audit entries.
					</p>
				)}

				{auditEntries && (
					<div className="flex items-center justify-between text-xs text-text-muted">
						<span>
							{auditEntries.count} entries
							{auditEntries.filters.action ? ` · action: ${auditEntries.filters.action}` : ""}
							{auditEntries.filters.userId ? ` · user: ${auditEntries.filters.userId.slice(0, 12)}…` : ""}
						</span>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => void handleAuditPrev()}
								disabled={auditCursorStack.length === 0 || auditLoading}
								className="inline-flex items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface disabled:opacity-30"
							>
								<ChevronLeft className="h-3 w-3" /> Prev
							</button>
							<button
								type="button"
								onClick={() => void loadAudit(auditCursor, true)}
								disabled={!auditCursor || auditLoading}
								className="inline-flex items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface disabled:opacity-30"
							>
								Next <ChevronRight className="h-3 w-3" />
							</button>
						</div>
					</div>
				)}
			</section>

			{/* Credit Adjust Confirmation Modal — Slice 6 */}
			{creditAdjustModal && (
				<div
					role="dialog"
					aria-modal="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
				>
					<div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-lg">
						<div className="flex items-start justify-between">
							<div>
								<h3 className="text-sm font-semibold">
									{creditAdjustModal.direction === "add" ? "Add credits" : "Drain credits"}
								</h3>
								<p className="text-xs text-text-muted mt-0.5">
									{creditAdjustModal.direction === "add"
										? `Adds ${centsToDollars(parseFloat(creditAdjustAmount[creditAdjustModal.userId] || "0") * 100)} to this user's balance and bumps totalDeposited.`
										: `Drains up to ${centsToDollars(parseFloat(creditAdjustAmount[creditAdjustModal.userId] || "0") * 100)} from this user's balance (capped at current balance).`}
								</p>
							</div>
						</div>
						<div>
							<label className="mb-1 block text-xs text-text-muted">
								Reason (required, audit-logged)
							</label>
							<input
								type="text"
								autoFocus
								value={creditAdjustReason}
								onChange={(e) => setCreditAdjustReason(e.target.value)}
								placeholder="Promo top-up, good-faith dispute, ..."
								className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setCreditAdjustModal(null);
									setCreditAdjustReason("");
								}}
								className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={updatingSettings || creditAdjustReason.trim().length === 0}
								onClick={() => void handleConfirmCreditAdjust()}
								className={`rounded-md px-3 py-1.5 text-xs font-medium ${
									creditAdjustModal.direction === "add"
										? "bg-success/15 text-success border border-success/30 hover:bg-success/25"
										: "bg-error/15 text-error border border-error/30 hover:bg-error/25"
								} disabled:opacity-50`}
							>
								{creditAdjustModal.direction === "add" ? "Add credits" : "Drain credits"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Suspend / Unsuspend Confirmation Modal — Slice 6 */}
			{suspendModal && (
				<div
					role="dialog"
					aria-modal="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
				>
					<div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-lg">
						<div>
							<h3 className="text-sm font-semibold">
								{suspendModal.action === "suspend" ? "Suspend user" : "Unsuspend user"}
							</h3>
							<p className="text-xs text-text-muted mt-0.5">
								{suspendModal.action === "suspend"
									? "Suspending will reject login + API requests with 403 and revoke all active API keys for this user."
									: "Unsuspending clears the suspended flag; the user can log in again. API keys are NOT auto-reissued."}
							</p>
						</div>
						<div>
							<label className="mb-1 block text-xs text-text-muted">
								Reason (optional, audit-logged)
							</label>
							<input
								type="text"
								autoFocus
								value={suspendReason}
								onChange={(e) => setSuspendReason(e.target.value)}
								placeholder="chargeback / abuse / customer request / ..."
								className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setSuspendModal(null);
									setSuspendReason("");
								}}
								className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={updatingSettings}
								onClick={() => void handleConfirmSuspend()}
								className={`rounded-md px-3 py-1.5 text-xs font-medium ${
									suspendModal.action === "suspend"
										? "bg-error/15 text-error border border-error/30 hover:bg-error/25"
										: "bg-success/15 text-success border border-success/30 hover:bg-success/25"
								} disabled:opacity-50`}
							>
								{suspendModal.action === "suspend" ? "Suspend" : "Unsuspend"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function StatCard({
	label,
	value,
	icon,
	trend,
}: {
	label: string;
	value: string;
	icon: React.ReactNode;
	trend?: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-surface-elevated/30 p-4">
			<div className="mb-1 flex items-center justify-between text-xs text-text-muted">
				<span className="flex items-center gap-1.5 uppercase tracking-wide">
					{icon}
					{label}
				</span>
				{trend && <span className="font-mono">{trend}</span>}
			</div>
			<div className="text-2xl font-semibold">{value}</div>
		</div>
	);
}

function IntegrationCard({
	name,
	icon,
	configured,
	health,
	notes,
}: {
	name: string;
	icon: React.ReactNode;
	configured: boolean;
	health?: "healthy" | "degraded" | "down";
	notes: string[];
}) {
	return (
		<div className="rounded-md border border-border bg-surface-elevated/30 p-3">
			<div className="mb-1.5 flex items-center justify-between">
				<span className="flex items-center gap-1.5 text-sm font-medium">
					{icon}
					{name}
				</span>
				{configured ? (
					health ? (
						<span
							className={`flex items-center gap-1 text-xs ${
								health === "healthy"
									? "text-accent"
									: health === "degraded"
										? "text-warning"
										: "text-error"
							}`}
						>
							{health === "healthy" ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<XCircle className="h-3 w-3" />
							)}
							{health}
						</span>
					) : (
						<span className="flex items-center gap-1 text-xs text-accent">
							<CheckCircle2 className="h-3 w-3" /> configured
						</span>
					)
				) : (
					<span className="flex items-center gap-1 text-xs text-text-muted">
						<AlertTriangle className="h-3 w-3" /> not configured
					</span>
				)}
			</div>
			<ul className="space-y-0.5 text-xs text-text-muted">
				{notes.map((n, i) => (
					<li key={i} className="flex items-start gap-1">
						<ArrowUpRight className="mt-0.5 h-2.5 w-2.5 flex-none text-text-muted/50" />
						<span>{n}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
