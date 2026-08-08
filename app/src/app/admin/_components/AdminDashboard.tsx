"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
	AlertTriangle,
	ChevronRight,
	CircleDot,
	Coins,
	CreditCard,
	Loader2,
	Settings2,
	ShieldCheck,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/ui/Toast";
import type {
	AdminSettings,
	AdminUser,
	AuditPage,
	Health,
	Integration,
	ModelRow,
	PolarCheckout,
	PolarCustomer,
	PolarPayment,
	PolarProduct,
	PolarSubscription,
	PolarTab,
	RecentRow,
	TimeWindow,
	UsageResponse,
} from "./admin-dashboard/types";
import {
	adminFetch,
	centsToDollars,
	formatTokens,
	timeAgo,
} from "./admin-dashboard/api";
import { IntegrationCard, StatCard } from "./admin-dashboard/cards";
import {
	AdminDashboardProvider,
	type AdminDashboardContextValue,
} from "./admin-dashboard/context";
import { UsersSection } from "./admin-dashboard/UsersSection";
import { PolarSection } from "./admin-dashboard/PolarSection";
import { RefundSection } from "./admin-dashboard/RefundSection";
import { AuditSection } from "./admin-dashboard/AuditSection";
import { AdminModals } from "./admin-dashboard/AdminModals";

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
	const [togglingSetting, setTogglingSetting] = useState<
		keyof AdminSettings | null
	>(null);
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
	const [deleteUserModal, setDeleteUserModal] = useState<{ userId: string; name: string } | null>(null);
	const [deleteUserConfirmation, setDeleteUserConfirmation] = useState("");
	const [deleteUserReason, setDeleteUserReason] = useState("");
	const [deletingUser, setDeletingUser] = useState(false);
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
			// Bound getSession so a hung auth proxy never leaves the page on
			// "Loading admin panel…" forever.
			const sessionData = await Promise.race([
				authClient.getSession(),
				new Promise<null>((resolve) => {
					window.setTimeout(() => resolve(null), 5_000);
				}),
			]);
			const userRole =
				((sessionData?.data?.user as { role?: string } | undefined)?.role ??
					null) as string | null;
			setRole(userRole);
			const admin = userRole === "admin";
			setIsAdmin(admin);

			if (!admin) {
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
			setSettings({
				maintenanceMode: Boolean(s.maintenanceMode),
				cardPaymentsEnabled: Boolean(s.cardPaymentsEnabled),
				cryptoPaymentsEnabled: Boolean(s.cryptoPaymentsEnabled),
			});
			setUsers(uData.data);
		} catch (err) {
			// Ensure the gate renders even when session/API fails.
			setIsAdmin((prev) => (prev === null ? false : prev));
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

	const handleToggleSetting = async (
		key: "maintenanceMode" | "cardPaymentsEnabled" | "cryptoPaymentsEnabled",
	) => {
		if (!settings || togglingSetting) return;
		setTogglingSetting(key);
		const newValue = !settings[key];
		// Optimistic UI so the operator sees immediate feedback.
		const previous = settings;
		setSettings({ ...settings, [key]: newValue });
		try {
			const res = await adminFetch<{ success: boolean; settings: AdminSettings }>(
				"/v1/admin/settings",
				{
					method: "PATCH",
					body: JSON.stringify({ [key]: newValue }),
				},
			);
			if (res.success && res.settings) {
				// Normalize — server may return the full site_settings row.
				setSettings({
					maintenanceMode: Boolean(res.settings.maintenanceMode),
					cardPaymentsEnabled: Boolean(res.settings.cardPaymentsEnabled),
					cryptoPaymentsEnabled: Boolean(res.settings.cryptoPaymentsEnabled),
				});
				toast.success("Platform setting updated.");
			} else {
				setSettings(previous);
				toast.error("Setting update was not confirmed by the server.");
			}
		} catch (err) {
			setSettings(previous);
			toast.error(`Failed to update setting: ${(err as Error).message}`);
		} finally {
			setTogglingSetting(null);
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

const handleDeleteUser = async () => {
	if (!deleteUserModal || deleteUserConfirmation !== "DELETE") return;
	const reason = deleteUserReason.trim();
	if (!reason) {
		toast.error("A deletion reason is required");
		return;
	}
	setDeletingUser(true);
	try {
		await adminFetch<{ success: boolean }>(`/v1/admin/users/${deleteUserModal.userId}`, {
			method: "DELETE",
			body: JSON.stringify({ confirmation: "DELETE", reason }),
		});
		toast.success("User anonymized and access revoked.");
		setUsers((prev) => prev.filter((u) => u.id !== deleteUserModal.userId));
		setSelectedUserId((current) => current === deleteUserModal.userId ? null : current);
		setSelectedUserHistory(null);
		setDeleteUserModal(null);
		setDeleteUserConfirmation("");
		setDeleteUserReason("");
	} catch (err) {
		toast.error(`User deletion failed: ${(err as Error).message}`);
	} finally {
		setDeletingUser(false);
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
			<div
				className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-10 text-text-secondary sm:px-6"
				aria-busy="true"
				aria-live="polite"
			>
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				<span>Loading admin panel…</span>
			</div>
		);
	}

	if (!isAdmin) {
		const signedIn = role !== null;
		return (
			<div className="mx-auto mt-12 max-w-xl rounded-[var(--radius-lg)] border border-border bg-surface-elevated/40 p-6 text-center">
				<ShieldCheck className="mx-auto mb-3 h-8 w-8 text-accent" aria-hidden="true" />
				<h1 className="mb-2 text-lg font-medium text-text-bright">
					Admin access required
				</h1>
				<p className="mb-4 text-sm text-text-muted">
					{signedIn ? (
						<>
							You are signed in as{""}
							<span className="font-mono text-text">{role || "user"}</span>.
							Admins can edit model pricing, view usage analytics, and manage
							integrations.
						</>
					) : (
						<>
							Sign in with an admin account to edit model pricing, view usage
							analytics, and manage platform settings.
						</>
					)}
				</p>
				<div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
					{!signedIn && (
						<a
							href="/login?next=/admin"
							className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-accent bg-accent px-4 py-2 text-sm font-semibold text-void transition hover:bg-accent-bright"
						>
							Sign in
						</a>
					)}
					{/* Dev-only bootstrap: promote-self is rejected in production. */}
					{process.env.NODE_ENV !== "production" && signedIn && (
						<button
							type="button"
							onClick={handlePromote}
							disabled={promoting}
							title="Development only — promotes the current session to admin"
							className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
						>
							{promoting ? (
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
							) : (
								<ShieldCheck className="h-4 w-4" aria-hidden="true" />
							)}
							Promote me to admin (dev)
						</button>
					)}
				</div>
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


	const dashboardValue: AdminDashboardContextValue = {
		windowSel,
		setWindowSel,
		usage,
		models,
		recent,
		health,
		integrations,
		settings,
		users,
		loading,
		refreshAll,
		totalMarginPct,
		togglingSetting,
		handleToggleSetting,
		editingId,
		editInput,
		editOutput,
		setEditingId,
		setEditInput,
		setEditOutput,
		handleEdit,
		startEdit,
		userSearch,
		setUserSearch,
		selectedUserId,
		selectedUserHistory,
		loadingHistory,
		handleViewUserHistory,
		creditAdjustAmount,
		setCreditAdjustAmount,
		handleCreditAdjust,
		handleSuspendAction,
		setDeleteUserModal,
		updatingSettings,
		setSelectedUserId,
		setSelectedUserHistory,
		polarTab,
		setPolarTab,
		polarPayments,
		setPolarPayments,
		polarCustomers,
		setPolarCustomers,
		polarProducts,
		setPolarProducts,
		polarSubscriptions,
		setPolarSubscriptions,
		polarLoading,
		setPolarLoading,
		polarError,
		setPolarError,
		checkoutProduct,
		setCheckoutProduct,
		checkoutEmail,
		setCheckoutEmail,
		checkoutName,
		setCheckoutName,
		checkoutSuccess,
		setCheckoutSuccess,
		checkoutCancel,
		setCheckoutCancel,
		checkoutResult,
		setCheckoutResult,
		refundForm,
		setRefundForm,
		refundSubmitting,
		handleRefundSubmit,
		auditEntries,
		auditFilters,
		setAuditFilters,
		auditLoading,
		loadAudit,
		handleAuditPrev,
		auditCursor,
		auditCursorStack,
		creditAdjustModal,
		setCreditAdjustModal,
		creditAdjustReason,
		setCreditAdjustReason,
		handleConfirmCreditAdjust,
		suspendModal,
		setSuspendModal,
		suspendReason,
		setSuspendReason,
		handleConfirmSuspend,
		deleteUserModal,
		deleteUserConfirmation,
		setDeleteUserConfirmation,
		deleteUserReason,
		setDeleteUserReason,
		deletingUser,
		handleDeleteUser,
	};

	return (
		<AdminDashboardProvider value={dashboardValue}>
		<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0">
					<h1 className="text-2xl font-semibold tracking-tight text-text-bright">
						Operator dashboard
					</h1>
					<p className="text-sm text-text-muted">
						Live OMA-AI usage, pricing, and integration health.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex rounded-[var(--radius-md)] border border-border bg-surface-elevated/40 p-1 text-xs">
						{(["24h", "7d", "30d"] as TimeWindow[]).map((w) => (
							<button
								key={w}
								type="button"
								onClick={() => setWindowSel(w)}
								className={`rounded-[var(--radius-sm)] px-3 py-1 transition ${
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
						className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface-elevated/40 px-3 py-1.5 text-xs hover:bg-surface-elevated disabled:opacity-50"
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

			<section className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated/30 p-4">
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
												{m.id} {m.oma_aiId ? `→ ${m.oma_aiId}` : ""}
											</div>
										</td>
										<td className="py-2">
											<span className="rounded-[var(--radius-sm)] bg-surface-elevated px-2 py-0.5 text-xs uppercase">
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
													className="w-20 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-1.5 py-1 text-right text-xs"
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
													className="w-20 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-1.5 py-1 text-right text-xs"
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
														className="rounded-[var(--radius-sm)] bg-accent/20 px-2 py-1 text-xs text-accent hover:bg-accent/30"
													>
														Save
													</button>
													<button
														type="button"
														onClick={() => setEditingId(null)}
														className="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-text-muted hover:text-text"
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
				<section className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated/30 p-4 space-y-4">
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
						<div className="flex min-h-[10.5rem] flex-col justify-between rounded-[var(--radius-lg)] border border-border bg-surface-elevated/40 p-4">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<AlertTriangle
										className={`h-4 w-4 shrink-0 ${settings.maintenanceMode ? "animate-pulse text-error" : "text-text-muted"}`}
										aria-hidden="true"
									/>
									<span className="text-sm font-medium">Maintenance Mode</span>
								</div>
								<p className="text-xs text-text-muted">
									Blocks all non-admin gateway requests with a 503 message.
								</p>
							</div>
							<div className="mt-4 flex items-center justify-between gap-2">
								<span
									className={`rounded-[var(--radius-sm)] px-2 py-0.5 font-mono text-[10px] sm:text-xs ${
										settings.maintenanceMode
											? "bg-error/10 text-error"
											: "bg-text-muted/10 text-text-muted"
									}`}
								>
									{settings.maintenanceMode ? "ACTIVE" : "ONLINE"}
								</span>
								<button
									type="button"
									disabled={togglingSetting !== null}
									aria-pressed={settings.maintenanceMode}
									aria-label={
										settings.maintenanceMode
											? "Disable maintenance mode"
											: "Enable maintenance mode"
									}
									onClick={() => handleToggleSetting("maintenanceMode")}
									className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
										settings.maintenanceMode
											? "border-error/40 bg-error/10 text-error hover:bg-error/20"
											: "border-border bg-surface hover:bg-surface-elevated"
									}`}
								>
									{togglingSetting === "maintenanceMode"
										? "Saving…"
										: settings.maintenanceMode
											? "Disable"
											: "Enable"}
								</button>
							</div>
						</div>

						{/* Card Payments */}
						<div className="flex min-h-[10.5rem] flex-col justify-between rounded-[var(--radius-lg)] border border-border bg-surface-elevated/40 p-4">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<CreditCard
										className={`h-4 w-4 shrink-0 ${settings.cardPaymentsEnabled ? "text-success" : "text-text-muted"}`}
										aria-hidden="true"
									/>
									<span className="text-sm font-medium">Card Payments (Polar)</span>
								</div>
								<p className="text-xs text-text-muted">
									Controls whether users can purchase credits with card via Polar.
								</p>
							</div>
							<div className="mt-4 flex items-center justify-between gap-2">
								<span
									className={`rounded-[var(--radius-sm)] px-2 py-0.5 font-mono text-[10px] sm:text-xs ${
										settings.cardPaymentsEnabled
											? "bg-success/10 text-success"
											: "bg-error/10 text-error"
									}`}
								>
									{settings.cardPaymentsEnabled ? "ENABLED" : "DISABLED"}
								</span>
								<button
									type="button"
									disabled={togglingSetting !== null}
									aria-pressed={settings.cardPaymentsEnabled}
									aria-label={
										settings.cardPaymentsEnabled
											? "Disable card payments"
											: "Enable card payments"
									}
									onClick={() => handleToggleSetting("cardPaymentsEnabled")}
									className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
										!settings.cardPaymentsEnabled
											? "border-error/40 bg-error/10 text-error hover:bg-error/20"
											: "border-border bg-surface hover:bg-surface-elevated"
									}`}
								>
									{togglingSetting === "cardPaymentsEnabled"
										? "Saving…"
										: settings.cardPaymentsEnabled
											? "Disable"
											: "Enable"}
								</button>
							</div>
						</div>

						{/* USDC deposits (Base) — not x402 */}
						<div className="flex min-h-[10.5rem] flex-col justify-between rounded-[var(--radius-lg)] border border-border bg-surface-elevated/40 p-4">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<Coins
										className={`h-4 w-4 shrink-0 ${settings.cryptoPaymentsEnabled ? "text-success" : "text-text-muted"}`}
										aria-hidden="true"
									/>
									<span className="text-sm font-medium">USDC deposits (Base)</span>
								</div>
								<p className="text-xs text-text-muted">
									Controls on-chain USDC credit deposits on Base. x402
									pay-per-request is separate and is not gated by this toggle.
								</p>
							</div>
							<div className="mt-4 flex items-center justify-between gap-2">
								<span
									className={`rounded-[var(--radius-sm)] px-2 py-0.5 font-mono text-[10px] sm:text-xs ${
										settings.cryptoPaymentsEnabled
											? "bg-success/10 text-success"
											: "bg-error/10 text-error"
									}`}
								>
									{settings.cryptoPaymentsEnabled ? "ENABLED" : "DISABLED"}
								</span>
								<button
									type="button"
									disabled={togglingSetting !== null}
									aria-pressed={settings.cryptoPaymentsEnabled}
									aria-label={
										settings.cryptoPaymentsEnabled
											? "Disable USDC deposits on Base"
											: "Enable USDC deposits on Base"
									}
									onClick={() => handleToggleSetting("cryptoPaymentsEnabled")}
									className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
										!settings.cryptoPaymentsEnabled
											? "border-error/40 bg-error/10 text-error hover:bg-error/20"
											: "border-border bg-surface hover:bg-surface-elevated"
									}`}
								>
									{togglingSetting === "cryptoPaymentsEnabled"
										? "Saving…"
										: settings.cryptoPaymentsEnabled
											? "Disable"
											: "Enable"}
								</button>
							</div>
						</div>
					</div>
				</section>
			)}

			{integrations && (
				<section className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated/30 p-4">
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
							name="OMA-AI / OpenBroker"
							icon={<ChevronRight className="h-4 w-4" />}
							configured={integrations.oma_ai.configured}
							health={integrations.oma_ai.health.status}
							notes={[
								integrations.oma_ai.health.latencyMs
									? `latency: ${integrations.oma_ai.health.latencyMs}ms`
									: null,
								integrations.oma_ai.health.note,
								integrations.oma_ai.health.supportedModels?.length
									? `models: ${integrations.oma_ai.health.supportedModels.join(", ")}`
									: null,
								integrations.oma_ai.url.replace("https://", ""),
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
							Free chat: anon {integrations.dailyLimits.anonymous}/day · signed-in{""}
							{integrations.dailyLimits.registered}/day
						</span>
						<span>·</span>
						<span>env: {integrations.node_env}</span>
						{health && (
							<>
								<span>·</span>
								<span>
									uptime {Math.floor(health.uptime_s / 60)}m · RAM{""}
									{health.memory.heap_used_mb} MB · db {health.db}
								</span>
							</>
						)}
					</div>
				</section>
			)}

			{usage?.perModel && usage.perModel.length > 0 && (
				<section className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated/30 p-4">
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
											{m.model}{""}
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

			<section className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated/30 p-4">
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
												className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] ${
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

			<UsersSection />
			<PolarSection />
			<RefundSection />
			<AuditSection />
			<AdminModals />
		</div>
		</AdminDashboardProvider>
	);
}
