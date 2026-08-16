"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { toDollars } from "@/lib/utils";
import { cn } from "@/components/ui/utils";
import type { AutoReloadSettings } from "@/lib/api";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ *
	*  Auto-Reload Card
	* ------------------------------------------------------------------ */

function AutoReloadCardComponent() {
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

	if (error) {
		return (
			<div className="flex flex-col p-6 bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative h-full">
				<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-error/40 via-error/20 to-transparent" />
				<p className="text-xs text-error">Failed to load auto-reload settings.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col p-6 bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative h-full transition-colors duration-200 ease-out hover:border-accent/40">
			{/* Accent glow on top edge */}
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/40 via-accent/20 to-transparent" />

			{/* Header */}
			<div className="flex items-start justify-between gap-4 mb-5">
				<div>
					<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
						Auto-reload
					</h2>
					<p className="mt-1 text-[11px] font-mono text-text-muted uppercase tracking-wider">
						{isEnabled ? "Active" : "Paused"}
					</p>
				</div>
				<span className="rounded-[var(--radius-sm)] border border-accent/30 bg-accent/10 px-2.5 py-1 text-[9.5px] font-mono font-bold uppercase tracking-wider text-accent shadow-[0_0_10px_-2px_var(--color-accent-glow)] shrink-0">
					+ USDC
				</span>
			</div>

			{/* Toggle */}
			<div className="flex items-center justify-between mb-6">
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
						"relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50 disabled:cursor-not-allowed",
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
			{isEnabled && (
				<div className="space-y-4">
					{/* Threshold */}
					<div className="flex flex-col gap-1.5">
						<label className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
							Trigger when below
						</label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-mono pointer-events-none">
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
								className="w-full rounded-[var(--radius-sm)] border border-border bg-void pl-7 pr-3 py-2 text-[13px] text-text-bright font-mono transition-colors duration-200 ease-out hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
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
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-mono pointer-events-none">
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
								className="w-full rounded-[var(--radius-sm)] border border-border bg-void pl-7 pr-3 py-2 text-[13px] text-text-bright font-mono transition-colors duration-200 ease-out hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
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
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-mono pointer-events-none">
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
								className="w-full rounded-[var(--radius-sm)] border border-border bg-void pl-7 pr-3 py-2 text-[13px] text-text-bright font-mono transition-colors duration-200 ease-out hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
							/>
						</div>
						<p className="text-[10px] text-text-muted">
							Maximum monthly spend before auto-reload pauses.
						</p>
					</div>
				</div>
			)}

			{!isEnabled && !isLoading && (
				<div className="mt-auto pt-4 border-t border-border/60">
					<p className="text-[11px] text-text-muted">
						Turn on auto-reload to keep your credits topped up automatically.
					</p>
				</div>
			)}

			{saving && (
				<div className="absolute bottom-4 right-4">
					<RefreshCw className="h-3.5 w-3.5 animate-spin text-text-muted" aria-hidden="true" />
				</div>
			)}
		</div>
	);
}

export { AutoReloadCardComponent as AutoReloadCard };
