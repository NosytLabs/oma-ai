"use client";

import { Bell, DollarSign, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { request } from "@/lib/api/client";
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
					<RefreshCw className="h-4 w-4 text-muted-foreground" />
					<h3 className="text-sm font-medium">Auto-reload</h3>
				</div>
				<p className="text-xs text-muted-foreground">
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
								className="h-4 w-4 accent-primary"
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
								className="w-24 rounded border border-border bg-background px-2 py-1 text-sm"
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
								className="w-24 rounded border border-border bg-background px-2 py-1 text-sm"
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
					<Bell className="h-4 w-4 text-muted-foreground" />
					<h3 className="text-sm font-medium">Budget alerts</h3>
				</div>
				<p className="text-xs text-muted-foreground">
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
							className="w-24 rounded border border-border bg-background px-2 py-1 text-sm"
						/>
					</label>
					<label className="flex items-center justify-between">
						<span className="text-sm">Email notifications</span>
						<input
							type="checkbox"
							checked={emailEnabled}
							onChange={(e) => setEmailEnabled(e.target.checked)}
							className="h-4 w-4 accent-primary"
						/>
					</label>
					{budget && budget.budgetLimitCents > 0 && (
						<p className="text-xs text-muted-foreground">
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

			{/* Spend summary link */}
			<section className="flex items-center gap-2 text-sm text-muted-foreground">
				<DollarSign className="h-4 w-4" />
				<span>
					View detailed usage on the{" "}
					<a href="/dashboard" className="text-primary underline underline-offset-2">
						dashboard
					</a>
				</span>
			</section>
		</div>
	);
}
