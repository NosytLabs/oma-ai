"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { m } from "framer-motion";
import {
	ArrowLeft,
	CreditCard,
	DollarSign,
	ExternalLink,
	Key,
	RefreshCw,
	Terminal,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import { formatDateShort, formatDateTime, formatUsd } from "@/lib/utils";

type UserDetail = {
	user: {
		id: string;
		address: string;
		accountNumber: string | null;
		createdAt: string;
	};
	balance: {
		balanceCredits: number;
		totalDeposited: number;
		totalUsed: number;
	};
	apiKeys: Array<{
		id: string;
		keyPrefix: string;
		name: string;
		active: boolean;
		createdAt: string;
		totalRequests: number;
		totalSpend: number;
	}>;
	recentUsage: Array<{
		id: string;
		model: string;
		provider: string;
		inputTokens: number;
		outputTokens: number;
		cost: number;
		createdAt: string;
	}>;
	recentDeposits: Array<{
		id: string;
		type: string;
		amount: number;
		credits: number;
		status: string;
		txHash: string | null;
		createdAt: string;
		completedAt: string | null;
	}>;
};

export default function UserDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const userDetailQuery = useQuery({
		queryKey: ["adminUserDetail", id],
		queryFn: async () => {
			const res = await fetch(`/api/admin/users/${id}`);
			if (!res.ok) throw new Error("User not found");
			return res.json() as Promise<UserDetail>;
		},
		staleTime: 30_000,
		retry: false,
	});

	const userDetail = userDetailQuery.data;
	const loading = userDetailQuery.isLoading;
	const error = userDetailQuery.isError
		? userDetailQuery.error instanceof Error
			? userDetailQuery.error.message
			: "Failed to fetch user"
		: null;

	const formatCredits = useMemo(
		() => (cents: number) => `${cents.toLocaleString()} credits`,
		[],
	);
	// formatUsd, formatDateTime, formatDateShort are imported from @/lib/utils

	if (loading) {
		return (
			<div className="min-h-screen bg-void text-text flex items-center justify-center">
				<div className="flex items-center gap-3">
					<m.div
						animate={{ rotate: 360 }}
						transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
						className="w-5 h-5 border border-accent border-t-transparent rounded-full"
					/>
					<span className="text-text-muted font-mono text-sm">
						Loading user details...
					</span>
				</div>
			</div>
		);
	}

	if (error || !userDetail) {
		return (
			<div className="min-h-screen bg-void text-text">
				<div className="max-w-[95rem] mx-auto px-4 py-6">
					<Link
						href="/admin"
						className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6 text-sm font-mono"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Admin
					</Link>
					<div className="rounded border border-border bg-surface p-8 text-center">
						<p className="text-xl font-bold text-text-bright mb-2 font-display">
							User Not Found
						</p>
						<p className="text-text-muted font-mono mb-4">
							{error || "The requested user does not exist."}
						</p>
						<button
							type="button"
							onClick={() => router.push("/admin")}
							className="px-4 py-2 rounded border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 text-sm font-mono"
						>
							Return to Admin
						</button>
					</div>
				</div>
			</div>
		);
	}

	const { user, balance, apiKeys, recentUsage, recentDeposits } = userDetail;

	return (
		<div className="min-h-screen bg-void text-text">
			<div className="border-b border-border bg-surface">
				<div className="max-w-[95rem] mx-auto px-4 py-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Link
								href="/admin"
								className="p-2 rounded border border-border hover:border-border-bright text-text-muted hover:text-text transition-colors"
							>
								<ArrowLeft className="w-4 h-4" />
							</Link>
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded border border-accent/30 bg-accent-dim flex items-center justify-center">
									<Terminal className="w-4 h-4 text-accent" />
								</div>
								<div>
									<h1 className="text-lg font-bold font-display tracking-tight text-text-bright">
										User Details
									</h1>
									<p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
										{user.address}
									</p>
								</div>
							</div>
						</div>
						<m.button
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
							onClick={() => userDetailQuery.refetch()}
							aria-label="Refresh user details"
							className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm"
						>
							<RefreshCw className="w-3.5 h-3.5" />
							Refresh
						</m.button>
					</div>
				</div>
			</div>

			<div className="max-w-[95rem] mx-auto px-4 py-6 space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="rounded border border-border bg-surface p-5">
						<div className="flex items-center gap-2 mb-3">
							<CreditCard className="w-3.5 h-3.5 text-text-muted" />
							<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
								Current Balance
							</span>
						</div>
						<p className="text-2xl font-bold font-mono text-accent">
							{formatCredits(balance.balanceCredits)}
						</p>
					</div>
					<div className="rounded border border-border bg-surface p-5">
						<div className="flex items-center gap-2 mb-3">
							<DollarSign className="w-3.5 h-3.5 text-text-muted" />
							<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
								Total Deposited
							</span>
						</div>
						<p className="text-2xl font-bold font-mono text-success">
							{formatUsd(balance.totalDeposited)}
						</p>
					</div>
					<div className="rounded border border-border bg-surface p-5">
						<div className="flex items-center gap-2 mb-3">
							<TrendingUp className="w-3.5 h-3.5 text-text-muted" />
							<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
								Total Used
							</span>
						</div>
						<p className="text-2xl font-bold font-mono text-amber">
							{formatUsd(balance.totalUsed)}
						</p>
					</div>
				</div>

				<div className="rounded border border-border bg-surface p-5">
					<h2 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary mb-4">
						Account Information
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="space-y-4">
							<div>
								<label className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 block">
									Wallet Address (EVM)
								</label>
								<div className="flex items-center gap-2">
									<p className="font-mono text-sm text-text-bright break-all">
										{user.address}
									</p>
									<a
										href={`https://basescan.org/address/${user.address}`}
										target="_blank"
										rel="noopener noreferrer"
										aria-label="View EVM address on BaseScan"
										className="p-1 rounded hover:bg-panel text-text-muted hover:text-text flex-shrink-0"
									>
										<ExternalLink className="w-3 h-3" />
									</a>
								</div>
							</div>
							{user.accountNumber && (
								<div>
									<label className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 block">
										Account Number
									</label>
									<p className="font-mono text-sm text-accent">
										{user.accountNumber}
									</p>
								</div>
							)}
						</div>
						<div className="space-y-4">
							<div>
								<label className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 block">
									Member Since
								</label>
								<p className="text-sm text-text-bright font-mono">
									{formatDateTime(user.createdAt)}
								</p>
							</div>
							<div>
								<label className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1 block">
									API Keys
								</label>
								<p className="text-sm text-text-bright">
									{apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""}
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="rounded border border-border bg-surface overflow-hidden">
					<div className="px-5 py-4 border-b border-border bg-panel flex items-center justify-between">
						<h2 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
							API Keys ({apiKeys.length})
						</h2>
					</div>
					{apiKeys.length === 0 ? (
						<div className="px-5 py-8 text-center text-text-muted font-mono text-sm">
							No API keys found
						</div>
					) : (
						<div className="divide-y divide-border/50">
							{apiKeys.map((key) => (
								<div
									key={key.id}
									className="px-5 py-4 flex items-center justify-between"
								>
									<div className="flex items-center gap-4">
										<div className="w-10 h-10 rounded border border-accent/30 bg-accent/10 flex items-center justify-center">
											<Key className="w-5 h-5 text-accent" />
										</div>
										<div>
											<p className="font-mono text-sm text-accent">
												{key.keyPrefix}***
											</p>
											<p className="text-[10px] text-text-muted">{key.name}</p>
										</div>
									</div>
									<div className="flex items-center gap-6">
										<div className="text-right">
											<p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
												Total Requests
											</p>
											<p className="text-sm font-mono text-text-bright">
												{key.totalRequests.toLocaleString()}
											</p>
										</div>
										<div className="text-right">
											<p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
												Total Spend
											</p>
											<p className="text-sm font-mono text-amber">
												{formatUsd(key.totalSpend)}
											</p>
										</div>
										<div className="text-right">
											<p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
												Created
											</p>
											<p className="text-sm text-text-secondary font-mono">
												{formatDateShort(key.createdAt)}
											</p>
										</div>
										<span
											className={`inline-flex px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider ${
												key.active
													? "bg-success-dim text-success"
													: "bg-surface text-text-muted"
											}`}
										>
											{key.active ? "Active" : "Inactive"}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="rounded border border-border bg-surface overflow-hidden">
					<div className="px-5 py-4 border-b border-border bg-panel">
						<h2 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
							Recent Usage (Last 100 Requests)
						</h2>
					</div>
					{recentUsage.length === 0 ? (
						<div className="px-5 py-8 text-center text-text-muted font-mono text-sm">
							No usage records found
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border bg-surface/50">
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Model
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Provider
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Input Tokens
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Output Tokens
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Cost
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Timestamp
										</th>
									</tr>
								</thead>
								<tbody>
									{recentUsage.map((usage) => (
										<tr key={usage.id} className="border-b border-border/50">
											<td className="px-4 py-3">
												<span className="font-mono text-sm text-text-bright">
													{usage.model}
												</span>
											</td>
											<td className="px-4 py-3">
												<span className="text-[10px] text-text-muted capitalize">
													{usage.provider}
												</span>
											</td>
											<td className="px-4 py-3 text-right font-mono text-text-muted">
												{usage.inputTokens.toLocaleString()}
											</td>
											<td className="px-4 py-3 text-right font-mono text-text-muted">
												{usage.outputTokens.toLocaleString()}
											</td>
											<td className="px-4 py-3 text-right font-mono text-accent">
												{formatUsd(usage.cost)}
											</td>
											<td className="px-4 py-3 text-text-muted font-mono text-xs">
												{format(usage.createdAt, "MMM d, h:mm a")}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				<div className="rounded border border-border bg-surface overflow-hidden">
					<div className="px-5 py-4 border-b border-border bg-panel">
						<h2 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
							Deposit History
						</h2>
					</div>
					{recentDeposits.length === 0 ? (
						<div className="px-5 py-8 text-center text-text-muted font-mono text-sm">
							No deposits found
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border bg-surface/50">
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Type
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Amount
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Credits
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Status
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											TX Hash
										</th>
										<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Date
										</th>
									</tr>
								</thead>
								<tbody>
									{recentDeposits.map((deposit) => (
										<tr key={deposit.id} className="border-b border-border/50">
											<td className="px-4 py-3">
												<span className="text-sm text-text-bright capitalize">
													{deposit.type}
												</span>
											</td>
											<td className="px-4 py-3 text-right font-mono text-success">
												{formatUsd(deposit.amount)}
											</td>
											<td className="px-4 py-3 text-right font-mono text-accent">
												{deposit.credits.toLocaleString()}
											</td>
											<td className="px-4 py-3">
												<span
													className={`inline-flex px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider ${
														deposit.status === "completed"
															? "bg-success-dim text-success"
															: deposit.status === "pending"
																? "bg-amber/10 text-amber"
																: deposit.status === "settling"
																	? "bg-blue/10 text-blue"
																	: "bg-surface text-text-muted"
													}`}
												>
													{deposit.status}
												</span>
											</td>
											<td className="px-4 py-3">
												{deposit.txHash ? (
													<span className="font-mono text-[10px] text-text-muted">
														{deposit.txHash.slice(0, 10)}...
													</span>
												) : (
													<span className="text-text-muted">-</span>
												)}
											</td>
											<td className="px-4 py-3 text-text-muted font-mono text-xs">
												{formatDateTime(deposit.createdAt)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
