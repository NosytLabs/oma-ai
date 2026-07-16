"use client";

import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	Boxes,
	CheckCircle,
	RefreshCw,
	Settings,
	XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

type SurplusModel = {
	id: string;
	object: string;
	created: number;
	display_name: string;
	description: string;
	context_length: number;
	supported_parameters: string[];
	pricing: Record<string, { input: number; output: number }>;
};

export default function AdminSurplusTab() {
	const modelsQuery = useQuery({
		queryKey: ["adminSurplusModels"],
		queryFn: () =>
			api.admin.getSurplusModels() as Promise<{
				object: string;
				data: SurplusModel[];
			}>,
		staleTime: 30_000,
	});
	const healthQuery = useQuery({
		queryKey: ["adminSurplusHealth"],
		queryFn: () => api.admin.getSurplusHealth(),
		staleTime: 15_000,
	});
	const configQuery = useQuery({
		queryKey: ["adminSurplusConfig"],
		queryFn: () => api.admin.getSurplusConfig(),
		staleTime: 60_000,
	});

	const models = (modelsQuery.data?.data ?? []) as SurplusModel[];
	const health = healthQuery.data;
	const config = configQuery.data;

	const refreshAll = () => {
		modelsQuery.refetch();
		healthQuery.refetch();
		configQuery.refetch();
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary flex items-center gap-2">
					<Boxes className="w-4 h-4" /> Surplus Provider
				</h3>
				<button
					type="button"
					onClick={refreshAll}
					className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono"
				>
					<RefreshCw className="w-3.5 h-3.5" /> Refresh
				</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<Card
					title="Health"
					icon={
						health?.isUp ? (
							<CheckCircle className="w-4 h-4 text-success" />
						) : (
							<XCircle className="w-4 h-4 text-error" />
						)
					}
				>
					<div className="text-sm font-mono">
						<div className={health?.isUp ? "text-success" : "text-error"}>
							{health?.isUp ? "Operational" : "Down"}
						</div>
						{health?.latencyMs != null && (
							<div className="text-text-muted text-xs">
								Latency: {health.latencyMs}ms
							</div>
						)}
						{health?.error && (
							<div className="text-error text-xs mt-1">{health.error}</div>
						)}
					</div>
				</Card>
				<Card
					title="Models"
					icon={<Boxes className="w-4 h-4 text-accent" />}
				>
					<div className="text-sm font-mono text-text-secondary">
						{models.length} available
					</div>
				</Card>
				<Card
					title="Config"
					icon={<Settings className="w-4 h-4 text-text-muted" />}
				>
					{config && (
						<div className="text-xs font-mono text-text-muted space-y-0.5">
							<div>Min Discount: {config.minDiscountPct}%</div>
							<div>Scheme: {config.defaultScheme}</div>
							<div>Chain: {config.chainId}</div>
						</div>
					)}
				</Card>
			</div>

			{config && (
				<div className="rounded border border-border bg-surface overflow-hidden">
					<div className="px-4 py-3 border-b border-border bg-panel">
						<h4 className="text-xs font-mono uppercase tracking-wider text-text-secondary">
							Contracts
						</h4>
					</div>
					<div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
						<ContractRow label="Settlement" value={config.settlementContract} />
						<ContractRow label="Permit2" value={config.permit2Contract} />
						<ContractRow label="USDC" value={config.usdcContract} />
						<ContractRow
							label="Legacy Verifier"
							value={config.legacyVerifierContract ?? "—"}
						/>
					</div>
				</div>
			)}

			<div className="rounded border border-border bg-surface overflow-hidden">
				<div className="px-4 py-3 border-b border-border bg-panel">
					<h4 className="text-xs font-mono uppercase tracking-wider text-text-secondary flex items-center gap-2">
						<Activity className="w-4 h-4" /> Models
					</h4>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-border bg-surface">
								<Th>Model</Th>
								<Th>Context</Th>
								<Th>Input $/1M</Th>
								<Th>Output $/1M</Th>
							</tr>
						</thead>
						<tbody>
							{models.map((m) => {
								const pricing =
									m.pricing?.[m.id] ?? Object.values(m.pricing ?? {})[0];
								return (
									<tr key={m.id} className="border-b border-border/50 hover:bg-surface/50">
										<td className="px-4 py-3 font-mono text-text-secondary text-xs">
											{m.display_name || m.id}
										</td>
										<td className="px-4 py-3 font-mono text-text-muted text-xs">
											{m.context_length?.toLocaleString() ?? "—"}
										</td>
										<td className="px-4 py-3 font-mono text-text-muted text-xs">
											{pricing ? `$${pricing.input}` : "—"}
										</td>
										<td className="px-4 py-3 font-mono text-text-muted text-xs">
											{pricing ? `$${pricing.output}` : "—"}
										</td>
									</tr>
								);
							})}
							{models.length === 0 && !modelsQuery.isLoading && (
								<tr>
									<td colSpan={4} className="px-4 py-8 text-center text-text-muted font-mono">
										No models or provider unreachable
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function Card({
	title,
	icon,
	children,
}: {
	title: string;
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="rounded border border-border bg-surface p-4">
			<div className="flex items-center gap-2 mb-2 text-xs font-mono uppercase tracking-wider text-text-muted">
				{icon}
				{title}
			</div>
			{children}
		</div>
	);
}

function ContractRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col">
			<span className="text-text-muted">{label}</span>
			<span className="text-text-secondary truncate" title={value}>
				{value}
			</span>
		</div>
	);
}

function Th({ children }: { children: ReactNode }) {
	return (
		<th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider">
			{children}
		</th>
	);
}
