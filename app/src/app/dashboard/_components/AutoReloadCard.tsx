"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DashboardCard, DashboardCardChip } from "@/components/dashboard/DashboardCard";
import { useToast } from "@/components/ui/Toast";
import { toDollars } from "@/lib/utils";
import { cn } from "@/components/ui/utils";
import type { AutoReloadSettings } from "@/lib/api";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ *
	*  Auto-Reload Card
	*  ---------------------------------------------------------------- */

interface AutoReloadCardProps {
	/** Demo tours have no live backend; render a friendly empty state. */
	isDemo?: boolean;
}

function AutoReloadCardComponent({ isDemo = false }: AutoReloadCardProps) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [saving, setSaving] = useState(false);

	const {
		data: settings,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["autoReload"],
		queryFn: () => api.credits.getAutoReload(),
		staleTime: 60_000,
		enabled: !isDemo,
		retry: false,
	});

	const isEnabled = settings?.enabled ?? false;
	const thresholdCents = settings?.thresholdCents ?? 500;
	const reloadAmountCents = settings?.reloadAmountCents ?? 10_000;
	const spendLimitCents = settings?.spendLimitCents ?? 100_000;
	const [draftThreshold, setDraftThreshold] = useState(String(toDollars(thresholdCents)));
	const [draftReload, setDraftReload] = useState(String(toDollars(reloadAmountCents)));
	const [draftSpend, setDraftSpend] = useState(String(toDollars(spendLimitCents)));

	useEffect(() => {
		setDraftThreshold(String(toDollars(thresholdCents)));
		setDraftReload(String(toDollars(reloadAmountCents)));
		setDraftSpend(String(toDollars(spendLimitCents)));
	}, [thresholdCents, reloadAmountCents, spendLimitCents]);

	const save = async (patch: Partial<AutoReloadSettings>) => {
		setSaving(true);
		try {
			const updated = await api.credits.updateAutoReload({
				...settings,
				...patch,
			});
			queryClient.setQueryData(["autoReload"], updated);
			toast.success("Auto-reload settings saved");
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Failed to save";
			toast.error(msg);
		} finally {
			setSaving(false);
		}
	};

	const handleToggle = async () => {
		await save({ enabled: !isEnabled });
	};

	const handleThresholdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const cents = Math.max(0, Math.min(1_000_000, Math.round(Number(e.target.value) * 100)));
		await save({ thresholdCents: cents });
	};

	const handleReloadAmountChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const cents = Math.max(100, Math.min(10_000_000, Math.round(Number(e.target.value) * 100)));
		await save({ reloadAmountCents: cents });
	};

	const handleSpendLimitChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const cents = Math.max(0, Math.min(10_000_000, Math.round(Number(e.target.value) * 100)));
		await save({ spendLimitCents: cents });
	};

	if (isDemo || error) {
		return (
			<DashboardCard
				tone="accent"
				title="Auto-reload"
				hint={isDemo ? "Demo" : "Unavailable"}
				trailing={<DashboardCardChip tone="neutral">USDC</DashboardCardChip>}
			>
				<p className="mt-2 max-w-[26ch] text-[12px] leading-relaxed text-text-muted">
					{isDemo
						? "Connect your account to enable auto-reload and keep credits topped up."
						: "Sign in to manage auto-reload rules."}
				</p>
				<div className="mt-auto space-y-2 border-t border-border/60 pt-4">
					{[
						["Trigger", "top up when balance drops"],
						["Reload", "fixed USDC credit top-up"],
						["Limit", "monthly spend cap"],
					].map(([k, v]) => (
						<div key={k} className="flex items-baseline justify-between gap-2">
							<span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
								{k}
							</span>
							<span className="text-[10.5px] text-text-muted/80">{v}</span>
						</div>
					))}
				</div>
			</DashboardCard>
		);
	}

	return (
		<DashboardCard
			tone="accent"
			title="Auto-reload"
			hint={isEnabled ? "Active" : "Paused"}
			trailing={<DashboardCardChip>+ USDC</DashboardCardChip>}
		>
			{/* Toggle */}
			<div className="mb-5 flex items-center justify-between">
				<span className="text-[12.5px] font-medium text-text-secondary">
					Enable auto-reload
				</span>
				<button
					type="button"
					role="switch"
					aria-checked={isEnabled}
					onClick={handleToggle}
					disabled={saving || isLoading}
					className={cn(
						"relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed disabled:opacity-50",
						isEnabled
							? "bg-accent"
							: "bg-surface-elevated border-border",
					)}
				>
					<span
						className={cn(
							"pointer-events-none inline-block h-[16px] w-[16px] rounded-full bg-void shadow-sm transition-transform duration-200 ease-out",
							isEnabled ? "translate-x-[18px]" : "translate-x-0.5",
						)}
						aria-hidden="true"
					/>
				</button>
			</div>

			{/* Settings */}
			{isEnabled ? (
				<div className="space-y-4">
					{/* Threshold */}
					<div className="flex flex-col gap-1.5">
						<label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
							Trigger when below
						</label>
						<div className="relative">
							<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-muted">
								$
							</span>
							<input
								type="number"
								value={draftThreshold}
								onChange={(e) => setDraftThreshold(e.target.value)}
								onBlur={handleThresholdChange}
								onKeyDown={(e) => e.key === "Enter" && handleThresholdChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
								disabled={saving || isLoading}
								min={0}
								step={1}
								className="w-full rounded-[var(--radius-sm)] border border-border bg-void px-3 py-2 pl-7 font-mono text-[13px] text-text-bright transition-colors duration-200 ease-out hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
							/>
						</div>
						<p className="text-[10px] text-text-muted">
							Reload when balance drops below this amount.
						</p>
					</div>

					{/* Reload amount */}
					<div className="flex flex-col gap-1.5">
						<label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
							Reload amount
						</label>
						<div className="relative">
							<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-muted">
								$
							</span>
							<input
								type="number"
								value={draftReload}
								onChange={(e) => setDraftReload(e.target.value)}
								onBlur={handleReloadAmountChange}
								onKeyDown={(e) => e.key === "Enter" && handleReloadAmountChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
								disabled={saving || isLoading}
								min={1}
								step={1}
								className="w-full rounded-[var(--radius-sm)] border border-border bg-void px-3 py-2 pl-7 font-mono text-[13px] text-text-bright transition-colors duration-200 ease-out hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
							/>
						</div>
						<p className="text-[10px] text-text-muted">
							Credits added each time the trigger fires.
						</p>
					</div>

					{/* Spend limit */}
					<div className="flex flex-col gap-1.5">
						<label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
							Spend limit
						</label>
						<div className="relative">
							<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-muted">
								$
							</span>
							<input
								type="number"
								value={draftSpend}
								onChange={(e) => setDraftSpend(e.target.value)}
								onBlur={handleSpendLimitChange}
								onKeyDown={(e) => e.key === "Enter" && handleSpendLimitChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
								disabled={saving || isLoading}
								min={0}
								step={1}
								className="w-full rounded-[var(--radius-sm)] border border-border bg-void px-3 py-2 pl-7 font-mono text-[13px] text-text-bright transition-colors duration-200 ease-out hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
							/>
						</div>
						<p className="text-[10px] text-text-muted">
							Maximum monthly spend before auto-reload pauses.
						</p>
					</div>
				</div>
			) : (
				<p className="mt-auto border-t border-border/60 pt-4 text-[11px] text-text-muted">
					Turn on auto-reload to keep your credits topped up automatically.
				</p>
			)}

			{saving && (
				<div className="absolute bottom-4 right-4">
					<RefreshCw className="h-3.5 w-3.5 animate-spin text-text-muted" aria-hidden="true" />
				</div>
			)}
		</DashboardCard>
	);
}

export { AutoReloadCardComponent as AutoReloadCard };
