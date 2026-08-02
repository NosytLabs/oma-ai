"use client";

import nextDynamic from "next/dynamic";
import { CHART_PALETTE } from "@/components/ui/charts/shared";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { api, type BalanceResponse, type CreditTransaction } from "@/lib/api";

const BarChartComponent = nextDynamic(
	() => import("@/components/ui/charts").then((m) => m.BarChartComponent),
	{
		ssr: false,
		loading: () => <div className="h-64 animate-pulse rounded bg-surface" />,
	},
);
const DonutChart = nextDynamic(
	() => import("@/components/ui/charts").then((m) => m.DonutChart),
	{
		ssr: false,
		loading: () => <div className="h-64 animate-pulse rounded bg-surface" />,
	},
);

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	AlertTriangle,
	ArrowDownRight,
	ArrowUpRight,
	Coins,
	CreditCard,
	History,
	Loader2,
	RefreshCw,
	Settings,
	Wallet,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatCents, toDollars } from "@/lib/utils";

interface CreditHistoryItem {
	id: string;
	type: "deposit" | "usage" | "refund";
	amount: number;
	source?: string;
	status: "completed" | "pending" | "failed";
	createdAt: string;
}

const AMOUNT_PRESETS = [10, 25, 50, 100, 250];

function mapCreditTransaction(tx: CreditTransaction): CreditHistoryItem {
	const status: CreditHistoryItem["status"] =
		tx.status === "completed" || tx.status === "settled"
			? "completed"
			: tx.status === "pending" || tx.status === "processing"
				? "pending"
				: "failed";
	return {
		id: tx.id,
		type: tx.type,
		amount: tx.amountCents,
		source: tx.txHash ?? tx.model ?? undefined,
		status,
		createdAt: tx.createdAt,
	};
}

export default function CreditsPage() {
	const { isAuthenticated, isReady } = useAuth();
	const toast = useToast();
	const queryClient = useQueryClient();

	const balanceQuery = useQuery({
		queryKey: ["balance"],
		queryFn: () => api.balance.get(),
		enabled: isAuthenticated,
		staleTime: 60_000,
	});

	const historyQuery = useQuery({
		queryKey: ["creditHistory"],
		queryFn: async () => {
			const res = await api.creditHistory.list(50);
			return res.transactions.map(mapCreditTransaction);
		},
		enabled: isAuthenticated,
		staleTime: 60_000,
	});

	const balance: BalanceResponse | null = balanceQuery.data ?? null;
	const loading = balanceQuery.isLoading;
	const refreshing = balanceQuery.isFetching && !balanceQuery.isLoading;
	const error = balanceQuery.error instanceof Error
		? balanceQuery.error.message
		: balanceQuery.error
			? "Failed to load credits data"
			: null;

	const [buyAmount, setBuyAmount] = useState("");
	const [selectedPayment, setSelectedPayment] = useState<"usdc" | "card">("usdc");

	const [autoReload, setAutoReload] = useState(false);
	const [autoReloadThreshold, setAutoReloadThreshold] = useState("");
	const [autoReloadAmount, setAutoReloadAmount] = useState("");
	const [savingAutoReload, setSavingAutoReload] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const _id = useId();

	// Load the user's saved auto-reload settings so a returning user sees their
	// existing config (toggle ON, threshold/reload amount filled in) rather
	// than a blank form. Without this, the only way to discover the existing
	// config was to click "Save" again, which would overwrite threshold/amount
	// with empty values.
	const autoReloadQuery = useQuery({
		queryKey: ["autoReload"],
		queryFn: () => api.credits.getAutoReload(),
		enabled: isAuthenticated,
		staleTime: 60_000,
	});
	useEffect(() => {
		const data = autoReloadQuery.data;
		if (!data) return;
		setAutoReload(Boolean(data.enabled));
		setAutoReloadThreshold(
			data.thresholdCents != null
				? toDollars(data.thresholdCents).toFixed(2)
				: "",
		);
		setAutoReloadAmount(
			data.reloadAmountCents != null
				? toDollars(data.reloadAmountCents).toFixed(2)
				: "",
		);
	}, [autoReloadQuery.data]);

	const history = useMemo<CreditHistoryItem[]>(
		() => historyQuery.data ?? [],
		[historyQuery.data],
	);
	const historyLoading = historyQuery.isLoading;
	const historyHasResolved = historyQuery.isFetched;

	const costData = useMemo(() => {
		if (history.length === 0) return [];
		const byDay = new Map<string, number>();
		for (const item of history) {
			const day = new Date(item.createdAt).toISOString().slice(0, 10);
			byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(item.amount) / 100);
		}
		return Array.from(byDay.entries())
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([date, cost]) => ({ date, cost }));
	}, [history]);

	const modelData = useMemo(() => {
		if (history.length === 0) return [];
		const byModel = new Map<string, number>();
		for (const item of history) {
			if (item.type !== "usage") continue;
			const source = item.source ?? "unknown";
			byModel.set(
				source,
				(byModel.get(source) ?? 0) + Math.abs(item.amount) / 100,
			);
		}
		return Array.from(byModel.entries())
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([name, value], i) => ({
				name,
				value,
				color: CHART_PALETTE[i % CHART_PALETTE.length],
			}));
	}, [history]);

	const refetch = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["balance"] });
		queryClient.invalidateQueries({ queryKey: ["creditHistory"] });
	}, [queryClient]);

	const handleBuyCredits = () => {
		if (!buyAmount || parseFloat(buyAmount) <= 0) return;
		// Route to the real deposit flow. USDC settles on-chain; Card routes
		// to the Polar checkout panel on /deposit?method=card. The old
		// /v1/credits/purchase call created a pending row and claimed
		// success without payment — keep going through the deposit UI.
		const amount = encodeURIComponent(buyAmount);
		if (selectedPayment === "card") {
			window.location.assign(`/deposit?method=card&amount=${amount}`);
		} else {
			window.location.assign(`/deposit?amount=${amount}`);
		}
	};

	if (!isReady && !isAuthenticated) {
		return (
			<div className="flex items-center justify-center px-4">
				<div className="h-12 w-12 animate-pulse rounded-full bg-surface-elevated/60" />
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<m.div
				className="flex items-center justify-center"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<div className="text-center max-w-md px-4">
					<m.div
						className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-warning/10"
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
					>
						<Wallet className="h-10 w-10 text-accent" />
					</m.div>
					<h2 className="mb-3 text-2xl font-bold">Sign in to view credits</h2>
					<p className="mb-6 text-text-muted">
						Magic link, account number, or wallet — all three work for
						deposits and history.
					</p>
					<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
						<Link href="/login?next=/dashboard/credits" className="btn-primary py-3 px-8">
							Sign in
						</Link>
					</div>
				</div>
			</m.div>
		);
	}

	return (
		<m.div
			className="mx-auto max-w-6xl min-w-0 px-4 py-8"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
		>
			<m.div
				className="mb-8 flex items-center justify-between"
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<div>
					<div className="flex items-center gap-3 mb-1">
						<Link
							href="/dashboard"
							className="text-sm text-text-muted hover:text-accent"
						>
							Dashboard
						</Link>
						<span className="text-text-muted">/</span>
						<span className="text-sm text-text-bright">Credits</span>
					</div>
					<h1 className="h1-utility text-text-bright">Credits</h1>
					<p className="mt-1 text-sm text-text-muted">
						Credits, purchases, and usage breakdown
					</p>
				</div>
				<div className="flex items-center gap-3">
					<m.button
						onClick={() => setShowSettings(!showSettings)}
						className="btn-secondary flex items-center gap-2 py-2 px-4"
						whileHover={{ scale: 1.02 }}
						whileTap={{ scale: 0.98 }}
					>
						<Settings className="h-4 w-4" />
						Settings
					</m.button>
					<m.button
						onClick={() => refetch()}
						disabled={refreshing}
						aria-label="Refresh"
						className="btn-secondary flex items-center gap-2 py-2 px-4"
						whileHover={{ scale: 1.02 }}
						whileTap={{ scale: 0.98 }}
					>
						<RefreshCw
							className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
						/>
					</m.button>
				</div>
			</m.div>

			<AnimatePresence>
				{error && (
					<m.div
						className="mb-6 flex items-center gap-3 rounded-xl border border-error/30 bg-error/10 px-4 py-3"
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 20 }}
					>
						<AlertTriangle className="h-4 w-4 shrink-0 text-error" />
						<span className="text-sm text-error">{error}</span>
					</m.div>
				)}
			</AnimatePresence>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
				<m.div
					className="lg:col-span-2 rounded-2xl border border-border/50 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 relative overflow-hidden"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
				>
					<div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-accent/5 to-transparent rounded-full blur-3xl pointer-events-none" />

					<div className="flex items-center gap-3 mb-6">
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
							<Coins className="h-6 w-6" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-text-bright">
								Current Credits
							</h2>
							<p className="text-xs text-text-muted">Available credits</p>
						</div>
					</div>

					<div className="mb-6">
						<div className="text-5xl font-bold tracking-tight text-text-bright mb-1">
							{loading && !balance ? (
								<Skeleton className="h-12 w-40" />
							) : (
								<AnimatedNumber
									value={parseFloat(formatCents(balance?.balanceCents ?? "0"))}
								/>
							)}
						</div>
						<div className="text-sm text-text-muted">
							{balance
								? `${formatCents(balance.totalDepositedCents)} total deposited`
								: "No deposits"}
						</div>
					</div>

					{balance && parseFloat(formatCents(balance.balanceCents)) > 0 && (
						<div className="mt-4 p-4 rounded-xl bg-accent/5 border border-accent/20">
							<div className="flex items-center justify-between text-sm">
								<span className="text-text-muted">Last activity</span>
								<span className="text-accent">
									{balance.lastActivityAt
										? new Date(balance.lastActivityAt).toLocaleString()
										: "N/A"}
								</span>
							</div>
						</div>
					)}

					<div className="mt-4">
						<Link
							href="/deposit"
							className="flex items-center justify-center gap-2 w-full rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-all hover:bg-accent/20"
						>
							<ArrowUpRight className="h-4 w-4" />
							Top Up
						</Link>
					</div>
				</m.div>

				<m.div
					className="rounded-2xl border border-border/50 bg-surface p-6"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					<div className="flex items-center gap-3 mb-6">
						<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
							<CreditCard className="h-6 w-6" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-text-bright">
								Buy Credits
							</h2>
							<p className="text-xs text-text-muted">USDC payment</p>
						</div>
					</div>

					<div className="space-y-4">
						<div>
							<label
								htmlFor={`${_id}-amount`}
								className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted"
							>
								Amount (USD)
							</label>
							<input
								id={`${_id}-amount`}
								type="text"
								inputMode="decimal"
								value={buyAmount}
								onChange={(e) => {
									if (
										e.target.value === "" ||
										/^\d*\.?\d*$/.test(e.target.value)
									)
										setBuyAmount(e.target.value);
								}}
								placeholder="0.00"
								className="w-full text-2xl font-bold bg-void border border-border rounded-xl px-4 py-3 placeholder:text-text-muted focus:outline-none focus:border-accent/50"
							/>
						</div>

						<div className="flex gap-2">
							{AMOUNT_PRESETS.map((preset) => (
								<m.button
									key={preset}
									onClick={() => setBuyAmount(preset.toString())}
									className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-elevated transition-colors"
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									${preset}
								</m.button>
							))}
						</div>

						<fieldset className="border-0 p-0 m-0">
							<legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
								Payment Method
							</legend>
							<div className="grid grid-cols-2 gap-2">
								<m.button
									onClick={() => setSelectedPayment("usdc")}
									className={`flex items-center gap-2 rounded-xl border py-3 px-3 transition-all ${
										selectedPayment === "usdc"
											? "border-accent bg-accent/10 text-accent"
											: "border-border bg-surface-elevated text-text-muted hover:brightness-125"
									}`}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue text-void text-[10px] font-bold">
										$
									</div>
									<div className="flex flex-col items-start text-left">
										<span className="text-sm font-semibold">USDC</span>
										<span className="text-[10px] font-mono uppercase tracking-wider opacity-80">Base</span>
									</div>
								</m.button>
								<m.button
									onClick={() => setSelectedPayment("card")}
									className={`flex items-center gap-2 rounded-xl border py-3 px-3 transition-all ${
										selectedPayment === "card"
											? "border-accent bg-accent/10 text-accent"
											: "border-border bg-surface-elevated text-text-muted hover:brightness-125"
									}`}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									<CreditCard className="h-5 w-5 shrink-0" aria-hidden="true" />
									<div className="flex flex-col items-start text-left">
										<span className="text-sm font-semibold">Card</span>
										<span className="text-[10px] font-mono uppercase tracking-wider opacity-80">via Polar</span>
									</div>
								</m.button>
							</div>
						</fieldset>

						<m.button
							onClick={handleBuyCredits}
							disabled={!buyAmount || parseFloat(buyAmount) <= 0}
							className="btn-primary w-full py-4 disabled:opacity-40 disabled:cursor-not-allowed"
							whileHover={{ scale: 1.01 }}
							whileTap={{ scale: 0.97 }}
						>
							{!buyAmount || parseFloat(buyAmount) <= 0 ? (
								<>
									<Zap className="h-5 w-5 mr-2" />
									Enter amount
								</>
							) : selectedPayment === "card" ? (
								<>
									<CreditCard className="h-5 w-5 mr-2" />
									Buy ${buyAmount} with card
								</>
							) : (
								<>
									<Zap className="h-5 w-5 mr-2" />
									Deposit ${buyAmount} USDC
								</>
							)}
						</m.button>
					</div>
				</m.div>
			</div>

			<AnimatePresence>
				{showSettings && (
					<m.div
						className="mb-8 rounded-2xl border border-border/50 bg-surface p-6"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
					>
						<h3 className="text-lg font-semibold text-text-bright mb-4">
							Auto-Reload Settings
						</h3>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium text-text-bright">
										Auto-reload credits
									</p>
									<p className="text-sm text-text-muted">
										Automatically purchase credits when credits fall below
										threshold
									</p>
								</div>
								<m.button
									onClick={async () => {
										try {
											await api.credits.updateAutoReload({ enabled: !autoReload });
											setAutoReload(!autoReload);
											toast.success(
												`Auto-reload ${!autoReload ? "enabled" : "disabled"}`,
											);
										} catch (e) {
											toast.error(
												e instanceof Error
													? e.message
													: "Failed to update auto-reload",
											);
										}
									}}
									className={`relative h-6 w-11 rounded-full transition-colors ${
										autoReload ? "bg-accent" : "bg-surface-elevated"
									}`}
									whileTap={{ scale: 0.95 }}
								>
									<span
										className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-text-bright transition-transform ${
											autoReload ? "translate-x-5" : ""
										}`}
									/>
								</m.button>
							</div>
							{autoReload && (
								<div className="space-y-3 pt-3 border-t border-border/50">
									<div>
										<label
											htmlFor={`${_id}-threshold`}
											className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted"
										>
											Threshold ($)
										</label>
										<input
											id={`${_id}-threshold`}
											type="text"
											inputMode="decimal"
											autoComplete="off"
											placeholder="10.00"
											value={autoReloadThreshold}
											onChange={(e) => setAutoReloadThreshold(e.target.value)}
											className="w-full text-sm font-medium bg-void border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent/50"
										/>
									</div>
									<div>
										<label
											htmlFor={`${_id}-reload`}
											className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted"
										>
											Reload amount ($)
										</label>
										<input
											id={`${_id}-reload`}
											type="text"
											inputMode="decimal"
											autoComplete="off"
											placeholder="50.00"
											value={autoReloadAmount}
											onChange={(e) => setAutoReloadAmount(e.target.value)}
											className="w-full text-sm font-medium bg-void border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent/50"
										/>
									</div>
									<button
										type="button"
										disabled={savingAutoReload}
										onClick={async () => {
											const thresholdDollars = parseFloat(autoReloadThreshold);
											const amountDollars = parseFloat(autoReloadAmount);
											if (
												!Number.isFinite(thresholdDollars) ||
												thresholdDollars <= 0
											) {
												toast.error("Enter a valid threshold amount");
												return;
											}
											if (
												!Number.isFinite(amountDollars) ||
												amountDollars <= 0
											) {
												toast.error("Enter a valid reload amount");
												return;
											}
											try {
												setSavingAutoReload(true);
												await api.credits.updateAutoReload({
													enabled: autoReload,
													thresholdCents: Math.round(thresholdDollars * 100),
													reloadAmountCents: Math.round(amountDollars * 100),
												});
												toast.success("Auto-reload settings saved");
											} catch (e) {
												toast.error(
													e instanceof Error
														? e.message
														: "Failed to save auto-reload settings",
												);
											} finally {
												setSavingAutoReload(false);
											}
										}}
										className="btn-primary w-full py-2 text-sm"
									>
										{savingAutoReload ? "Saving…" : "Save"}
									</button>
								</div>
							)}
						</div>
					</m.div>
				)}
			</AnimatePresence>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
				<m.div
					className="rounded-2xl border border-border/50 bg-surface p-6"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
				>
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-semibold text-text-bright">
							30-Day Costs
						</h3>
						<div className="text-sm text-text-muted">
							${costData.reduce((sum, d) => sum + d.cost, 0).toFixed(2)} total
						</div>
					</div>
					{costData.length > 0 ? (
						<BarChartComponent data={costData} />
					) : (
						<div className="h-64 flex items-center justify-center text-sm text-text-muted border border-dashed border-border">
							No usage yet
						</div>
					)}
				</m.div>

				<m.div
					className="rounded-2xl border border-border/50 bg-surface p-6"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
				>
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-semibold text-text-bright">
							Usage by Model
						</h3>
					</div>
					{modelData.length > 0 ? (
						<>
							<DonutChart data={modelData} />
							<div className="mt-4 flex flex-wrap gap-3">
								{modelData.map((model) => (
									<div key={model.name} className="flex items-center gap-2">
										<div
											className="h-2 w-2 rounded-full"
											style={{ backgroundColor: model.color }}
										/>
										<span className="text-xs text-text-muted">
											{model.name}
										</span>
									</div>
								))}
							</div>
						</>
					) : (
						<div className="h-64 flex items-center justify-center text-sm text-text-muted border border-dashed border-border">
							No model activity yet
						</div>
					)}
				</m.div>
			</div>

			<m.div
				className="max-w-full min-w-0 rounded-2xl border border-border/50 bg-surface overflow-hidden"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.5 }}
			>
				<div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
					<History className="h-5 w-5 text-accent" />
					<h3 className="text-lg font-semibold text-text-bright">
						Credit History
					</h3>
				</div>
				<div className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
					<table className="w-full min-w-[36rem] text-left">
						<thead>
							<tr className="border-b border-border/50 bg-surface-elevated">
								<th className="px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">
									Date
								</th>
								<th className="px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">
									Type
								</th>
								<th className="px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">
									Source
								</th>
								<th className="px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">
									Amount
								</th>
								<th className="px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">
									Status
								</th>
							</tr>
						</thead>
						<tbody>
							{historyLoading ? (
								<tr>
									<td colSpan={5} className="px-6 py-12 text-center">
										<Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
									</td>
								</tr>
							) : !historyHasResolved ? (
								<tr>
									<td colSpan={5} className="px-6 py-12 text-center">
										<Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
									</td>
								</tr>
							) : history.length === 0 ? (
								<tr>
									<td
										colSpan={5}
										className="px-6 py-12 text-center text-sm text-text-muted"
									>
										No credit history yet
									</td>
								</tr>
							) : (
								history.map((item, i) => (
									<m.tr
										key={item.id}
										className="border-b border-border/30 transition-colors hover:bg-surface-elevated"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: i * 0.03 }}
									>
										<td className="px-6 py-4 text-sm text-text-muted">
											{new Date(item.createdAt).toLocaleDateString()}
										</td>
										<td className="px-6 py-4">
											<div
												className={`flex items-center gap-2 text-sm ${
													item.type === "deposit"
														? "text-success"
														: item.type === "refund"
															? "text-accent"
															: "text-warning"
												}`}
											>
												{item.type === "deposit" ? (
													<ArrowUpRight className="h-4 w-4" />
												) : item.type === "refund" ? (
													<RefreshCw className="h-4 w-4" />
												) : (
													<ArrowDownRight className="h-4 w-4" />
												)}
												<span className="capitalize">{item.type}</span>
											</div>
										</td>
										<td className="px-6 py-4 text-sm text-text-secondary">
											{item.source || "-"}
										</td>
										<td className="px-6 py-4 text-sm font-medium">
											<span
												className={
													item.amount > 0 ? "text-success" : "text-warning"
												}
											>
												{item.amount > 0 ? "+" : ""}
												{item.amount > 0 ? "$" : "-$"}
												{formatCents(Math.abs(item.amount))}
											</span>
										</td>
										<td className="px-6 py-4">
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
													item.status === "completed"
														? "bg-success/10 text-success"
														: item.status === "pending"
															? "bg-warning/10 text-warning"
															: "bg-error/10 text-error"
												}`}
											>
												{item.status}
											</span>
										</td>
									</m.tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</m.div>
		</m.div>
	);
}
