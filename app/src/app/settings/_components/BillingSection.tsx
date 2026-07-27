"use client";

import Link from "next/link";
import { Bell, CreditCard, DollarSign, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { api, PolarNotConfiguredError } from "@/lib/api";
import { request } from "@/lib/api/client";
import type {
	PolarPlan,
	PolarSubscription,
} from "@/lib/api";
import type { AutoReloadSettings } from "@/lib/api/types";

interface BudgetAlerts {
	budgetLimitCents: number;
	alertThresholds: number[];
	emailEnabled: boolean;
	webhookEnabled: boolean;
	webhookUrl?: string;
}

export function BillingSection() {
	const toast = useToast();

	// Auto-reload state
	const [autoReload, setAutoReload] = useState<AutoReloadSettings | null>(null);
	const [savingReload, setSavingReload] = useState(false);

	// Budget alerts state
	const [budget, setBudget] = useState<BudgetAlerts | null>(null);
	const [savingBudget, setSavingBudget] = useState(false);
	const [budgetLimit, setBudgetLimit] = useState("");
	const [emailEnabled, setEmailEnabled] = useState(false);

	// Polar subscription state. null = not configured on the server;
	// loaded = present in our DB.
	const [polarUnavailable, setPolarUnavailable] = useState(false);
	const [plans, setPlans] = useState<PolarPlan[]>([]);
	const [subscription, setSubscription] = useState<PolarSubscription | null>(null);
	const [openingPortal, setOpeningPortal] = useState(false);
	const [checkingOut, setCheckingOut] = useState<string | null>(null);

	const loadPolar = useCallback(async () => {
		try {
			const [plansResp, subResp] = await Promise.all([
				api.polar.plans(),
				api.polar.subscription(),
			]);
			setPlans(plansResp.plans);
			setSubscription(subResp.subscription);
			setPolarUnavailable(false);
		} catch (e: unknown) {
			if (e instanceof PolarNotConfiguredError) {
				setPolarUnavailable(true);
			} else {
				// Non-503 errors get logged but don't hide the section — the
				// plans list is best-effort context for the user.
				console.warn("[billing] failed to load polar state", e);
			}
		}
	}, []);

	useEffect(() => {
		loadPolar();
	}, [loadPolar]);

	const handleCheckout = useCallback(
		async (planId: string) => {
			setCheckingOut(planId);
			try {
				const { url } = await api.polar.checkout(planId);
				window.location.href = url;
			} catch (e: unknown) {
				toast.error(e instanceof Error ? e.message : "Failed to start checkout");
				setCheckingOut(null);
			}
		},
		[toast],
	);

	const handleOpenPortal = useCallback(async () => {
		setOpeningPortal(true);
		try {
			const { url } = await api.polar.portal();
			window.location.href = url;
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : "Failed to open billing portal");
			setOpeningPortal(false);
		}
	}, [toast]);

	const load = useCallback(async () => {
		try {
			const [reload, budgetData] = await Promise.all([
				api.credits.getAutoReload(),
				request<{ budgetLimitCents: number; alertThresholds: number[]; emailEnabled: boolean; webhookEnabled: boolean; webhookUrl?: string }>("/v1/credits/budget-alerts"),
			]);
			setAutoReload(reload);
			setBudget(budgetData);
			setBudgetLimit(budgetData.budgetLimitCents > 0 ? String(budgetData.budgetLimitCents / 100) : "");
			setEmailEnabled(budgetData.emailEnabled);
		} catch {
			// Non-critical — section just shows defaults
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const handleSaveAutoReload = async () => {
		if (!autoReload) return;
		setSavingReload(true);
		try {
			const updated = await api.credits.updateAutoReload(autoReload);
			setAutoReload(updated);
			toast.success("Auto-reload settings saved");
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : "Failed to save");
		} finally {
			setSavingReload(false);
		}
	};

	const handleSaveBudget = async () => {
		setSavingBudget(true);
		try {
			const limitCents = Math.round(parseFloat(budgetLimit || "0") * 100);
			await request("/v1/credits/budget-alerts", {
				method: "POST",
				body: JSON.stringify({
					budgetLimitCents: limitCents,
					alertThresholds: [50, 80, 100],
					emailEnabled,
					webhookEnabled: false,
				}),
			});
			toast.success("Budget alert saved");
			load();
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : "Failed to save budget alert");
		} finally {
			setSavingBudget(false);
		}
	};

	return (
		<div className="space-y-8">
			{/* Auto-reload */}
			<section className="space-y-4">
				<div className="flex items-center gap-2">
					<RefreshCw className="h-4 w-4 text-text-muted" />
					<h3 className="text-sm font-medium">Auto-reload</h3>
				</div>
				<p className="text-xs text-text-muted">
					Automatically reload credits when your balance drops below a threshold.
				</p>

				{autoReload && (
					<div className="space-y-3 rounded-lg border border-border p-4">
						<label className="flex items-center justify-between">
							<span className="text-sm">Enabled</span>
							<input
								type="checkbox"
								checked={autoReload.enabled}
								onChange={(e) =>
									setAutoReload({ ...autoReload, enabled: e.target.checked })
								}
								className="h-4 w-4 accent-accent"
							/>
						</label>
						<label className="flex items-center justify-between gap-4">
							<span className="text-sm">Threshold ($)</span>
							<input
								type="number"
								min="0.01"
								step="0.01"
								value={autoReload.thresholdCents / 100}
								onChange={(e) =>
									setAutoReload({
										...autoReload,
										thresholdCents: Math.round(parseFloat(e.target.value || "0") * 100),
									})
								}
								className="w-24 rounded border border-border bg-surface px-2 py-1 text-sm"
							/>
						</label>
						<label className="flex items-center justify-between gap-4">
							<span className="text-sm">Reload amount ($)</span>
							<input
								type="number"
								min="0.01"
								step="0.01"
								value={autoReload.reloadAmountCents / 100}
								onChange={(e) =>
									setAutoReload({
										...autoReload,
										reloadAmountCents: Math.round(parseFloat(e.target.value || "0") * 100),
									})
								}
								className="w-24 rounded border border-border bg-surface px-2 py-1 text-sm"
							/>
						</label>
						<Button
							size="sm"
							onClick={handleSaveAutoReload}
							disabled={savingReload}
						>
							{savingReload ? "Saving…" : "Save auto-reload"}
						</Button>
					</div>
				)}
			</section>

			{/* Budget alerts */}
			<section className="space-y-4">
				<div className="flex items-center gap-2">
					<Bell className="h-4 w-4 text-text-muted" />
					<h3 className="text-sm font-medium">Budget alerts</h3>
				</div>
				<p className="text-xs text-text-muted">
					Get notified when your monthly spend reaches a limit.
				</p>

				<div className="space-y-3 rounded-lg border border-border p-4">
					<label className="flex items-center justify-between gap-4">
						<span className="text-sm">Monthly budget limit ($)</span>
						<input
							type="number"
							min="1"
							step="1"
							placeholder="e.g. 50"
							value={budgetLimit}
							onChange={(e) => setBudgetLimit(e.target.value)}
							className="w-24 rounded border border-border bg-surface px-2 py-1 text-sm"
						/>
					</label>
					<label className="flex items-center justify-between">
						<span className="text-sm">Email notifications</span>
						<input
							type="checkbox"
							checked={emailEnabled}
							onChange={(e) => setEmailEnabled(e.target.checked)}
							className="h-4 w-4 accent-accent"
						/>
					</label>
					{budget && budget.budgetLimitCents > 0 && (
						<p className="text-xs text-text-muted">
							Current limit: ${(budget.budgetLimitCents / 100).toFixed(2)} · Alerts at 50%, 80%, 100%
						</p>
					)}
					<Button
						size="sm"
						onClick={handleSaveBudget}
						disabled={savingBudget}
					>
						{savingBudget ? "Saving…" : "Save budget alert"}
					</Button>
				</div>
			</section>

			{/* Polar.sh subscriptions */}
			{!polarUnavailable && (
				<section className="space-y-4">
					<div className="flex items-center gap-2">
						<CreditCard className="h-4 w-4 text-text-muted" />
						<h3 className="text-sm font-medium">Monthly subscription</h3>
					</div>
					<p className="text-xs text-text-muted">
						Recurring billing via Polar.sh. Each plan includes a credit
						allowance; usage above the allowance is billed per-token.
					</p>

					{subscription && (
						<div className="rounded-lg border border-accent/30 bg-accent-dim/30 p-4 space-y-3">
							<div className="flex items-center justify-between gap-2">
								<div>
									<p className="text-sm font-semibold">
										{subscription.planName ?? "Active subscription"}
									</p>
									<p className="text-xs text-text-muted font-mono">
										Status: {subscription.status}
										{subscription.currentPeriodEnd &&
											` · renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
									</p>
								</div>
								{subscription.cancelAtPeriodEnd === 1 && (
									<span className="text-[10px] uppercase tracking-wider text-warning font-mono">
										cancels at period end
									</span>
								)}
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={handleOpenPortal}
								disabled={openingPortal}
							>
								<ExternalLink className="h-3 w-3 mr-1.5" />
								{openingPortal ? "Opening…" : "Manage in Polar"}
							</Button>
						</div>
					)}

					{plans.filter((p) => p.available).length > 0 && (
						<div className="grid gap-3 sm:grid-cols-3">
							{plans
								.filter((p) => p.available)
								.map((plan) => (
									<div
										key={plan.id}
										className="rounded-lg border border-border p-4 flex flex-col gap-2"
									>
										<div className="flex items-baseline justify-between gap-2">
											<h4 className="text-sm font-semibold">{plan.name}</h4>
											<span className="text-base font-bold font-mono">
												${(plan.priceCents / 100).toFixed(0)}
												<span className="text-[10px] text-text-muted font-normal">
													/mo
												</span>
											</span>
										</div>
										<p className="text-xs text-text-muted flex-1">
											{plan.description}
										</p>
										<ul className="text-xs text-text-secondary space-y-1">
											{plan.features.map((f) => (
												<li key={f} className="flex items-start gap-1.5">
													<span className="text-accent">·</span>
													{f}
												</li>
											))}
										</ul>
										<Button
											size="sm"
											onClick={() => handleCheckout(plan.id)}
											disabled={checkingOut === plan.id}
											className="w-full"
										>
											{checkingOut === plan.id ? "Opening…" : "Subscribe"}
										</Button>
									</div>
								))}
						</div>
					)}
				</section>
			)}

			{/* Spend summary link */}
			<section className="flex items-center gap-2 text-sm text-text-muted">
				<DollarSign className="h-4 w-4" />
				<span>
					View detailed usage on the{" "}
					<Link href="/dashboard" className="text-accent underline underline-offset-2">
						dashboard
					</Link>
				</span>
			</section>
		</div>
	);
}
