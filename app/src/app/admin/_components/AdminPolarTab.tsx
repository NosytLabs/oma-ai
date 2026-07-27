"use client";

/**
 * Admin Polar tab — view subscriptions, orders, and webhook events.
 * Useful even when POLAR_ACCESS_TOKEN is missing: the webhook events log
 * still records what came in (none, in that case).
 */
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ScrollText, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

interface SubscriptionRow {
	id: string;
	polarSubscriptionId: string;
	polarProductId: string;
	status: string;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: number;
	userId: string;
	userAddress: string | null;
	userAccountNumber: string | null;
	polarCustomerId: string;
	email: string | null;
}

interface OrderRow {
	id: string;
	polarOrderId: string;
	polarProductId: string;
	amount: number;
	currency: string;
	status: string;
	createdAt: string;
	userId: string;
	userAddress: string | null;
	email: string | null;
}

interface WebhookRow {
	id: string;
	polarEventId: string;
	eventType: string;
	processed: number;
	errorMessage: string | null;
	createdAt: string;
}

type SubTab = "subscriptions" | "orders" | "webhooks";

export default function AdminPolarTab() {
	const [sub, setSub] = useState<SubTab>("subscriptions");
	const [failedOnly, setFailedOnly] = useState(false);

	const subs = useQuery<{ subscriptions: SubscriptionRow[] }>({
		queryKey: ["admin", "polar", "subscriptions"],
		queryFn: () => fetch("/api/v1/admin/polar/subscriptions?limit=100").then((r) => r.json()),
		enabled: sub === "subscriptions",
	});

	const orders = useQuery<{ orders: OrderRow[] }>({
		queryKey: ["admin", "polar", "orders"],
		queryFn: () => fetch("/api/v1/admin/polar/orders?limit=100").then((r) => r.json()),
		enabled: sub === "orders",
	});

	const webhooks = useQuery<{
		events: WebhookRow[];
		summary: { failedCount: number };
	}>({
		queryKey: ["admin", "polar", "webhooks", failedOnly],
		queryFn: () =>
			fetch(
				`/api/v1/admin/polar/webhook-events?limit=100${failedOnly ? "&failed=1" : ""}`,
			).then((r) => r.json()),
		enabled: sub === "webhooks",
	});

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-border pb-2">
				<SubTabButton active={sub === "subscriptions"} onClick={() => setSub("subscriptions")} icon={CreditCard} label="Subscriptions" />
				<SubTabButton active={sub === "orders"} onClick={() => setSub("orders")} icon={ShoppingCart} label="Orders" />
				<SubTabButton active={sub === "webhooks"} onClick={() => setSub("webhooks")} icon={ScrollText} label="Webhook events" />
			</div>

			{sub === "subscriptions" && (
				<DataTable
					loading={subs.isLoading}
					columns={["Status", "Plan", "User", "Period end", "Cancel"]}
					rows={subs.data?.subscriptions ?? []}
					renderRow={(row) => (
						<tr key={row.id} className="border-b border-border/50 text-xs">
							<td className="px-3 py-2">
								<span
									className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
										row.status === "active" || row.status === "trialing"
											? "bg-success/10 text-success"
											: "bg-text-muted/10 text-text-muted"
									}`}
								>
									{row.status}
								</span>
							</td>
							<td className="px-3 py-2 font-mono text-text-secondary">
								{row.polarProductId.slice(0, 8)}…
							</td>
							<td className="px-3 py-2 font-mono">
								{row.userAddress
									? `${row.userAddress.slice(0, 6)}…${row.userAddress.slice(-4)}`
									: row.userAccountNumber ?? row.userId.slice(0, 8)}
							</td>
							<td className="px-3 py-2 text-text-muted">
								{row.currentPeriodEnd
									? new Date(row.currentPeriodEnd).toLocaleDateString()
									: "—"}
							</td>
							<td className="px-3 py-2 text-text-muted">
								{row.cancelAtPeriodEnd === 1 ? "yes" : "no"}
							</td>
						</tr>
					)}
					emptyMessage="No subscriptions yet."
				/>
			)}

			{sub === "orders" && (
				<DataTable
					loading={orders.isLoading}
					columns={["Amount", "Currency", "Status", "User", "Created"]}
					rows={orders.data?.orders ?? []}
					renderRow={(row) => (
						<tr key={row.id} className="border-b border-border/50 text-xs">
							<td className="px-3 py-2 font-mono">
								${(row.amount / 100).toFixed(2)}
							</td>
							<td className="px-3 py-2 uppercase text-text-muted">{row.currency}</td>
							<td className="px-3 py-2">
								<span
									className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
										row.status === "completed"
											? "bg-success/10 text-success"
											: "bg-warning/10 text-warning"
									}`}
								>
									{row.status}
								</span>
							</td>
							<td className="px-3 py-2 font-mono">
								{row.userAddress
									? `${row.userAddress.slice(0, 6)}…${row.userAddress.slice(-4)}`
									: row.userId.slice(0, 8)}
							</td>
							<td className="px-3 py-2 text-text-muted">
								{new Date(row.createdAt).toLocaleString()}
							</td>
						</tr>
					)}
					emptyMessage="No orders yet."
				/>
			)}

			{sub === "webhooks" && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<label className="text-xs text-text-muted flex items-center gap-2">
							<input
								type="checkbox"
								checked={failedOnly}
								onChange={(e) => setFailedOnly(e.target.checked)}
								className="h-3 w-3 accent-accent"
							/>
							Show only failed (processed=0)
						</label>
						{webhooks.data?.summary && (
							<span className="text-[10px] font-mono uppercase text-text-muted">
								{webhooks.data.summary.failedCount} failed in last 100
							</span>
						)}
					</div>
					<DataTable
						loading={webhooks.isLoading}
						columns={["Type", "Event ID", "Status", "Error", "Created"]}
						rows={webhooks.data?.events ?? []}
						renderRow={(row) => (
							<tr key={row.id} className="border-b border-border/50 text-xs">
								<td className="px-3 py-2 font-mono">{row.eventType}</td>
								<td className="px-3 py-2 font-mono text-text-muted">
									{row.polarEventId.slice(0, 12)}…
								</td>
								<td className="px-3 py-2">
									<span
										className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
											row.processed === 1
												? "bg-success/10 text-success"
												: "bg-warning/10 text-warning"
										}`}
									>
										{row.processed === 1 ? "processed" : "failed"}
									</span>
								</td>
								<td className="px-3 py-2 text-text-muted truncate max-w-xs" title={row.errorMessage ?? ""}>
									{row.errorMessage ?? "—"}
								</td>
								<td className="px-3 py-2 text-text-muted">
									{new Date(row.createdAt).toLocaleString()}
								</td>
							</tr>
						)}
						emptyMessage="No webhook events recorded yet."
					/>
				</div>
			)}
		</div>
	);
}

function SubTabButton({
	active,
	onClick,
	icon: Icon,
	label,
}: {
	active: boolean;
	onClick: () => void;
	icon: typeof CreditCard;
	label: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
				active
					? "bg-accent text-void"
					: "text-text-secondary hover:bg-surface hover:text-text-bright"
			}`}
		>
			<Icon className="h-3 w-3" />
			{label}
		</button>
	);
}

function DataTable<T extends { id: string }>({
	loading,
	columns,
	rows,
	renderRow,
	emptyMessage,
}: {
	loading: boolean;
	columns: string[];
	rows: T[];
	renderRow: (row: T) => React.ReactNode;
	emptyMessage: string;
}) {
	if (loading) {
		return (
			<div className="space-y-1">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-8 w-full" />
				))}
			</div>
		);
	}
	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-text-muted">
				{emptyMessage}
			</div>
		);
	}
	return (
		<div className="overflow-x-auto rounded-lg border border-border">
			<table className="w-full">
				<thead className="bg-surface text-[10px] uppercase tracking-wider text-text-muted">
					<tr>
						{columns.map((c) => (
							<th key={c} className="px-3 py-2 text-left font-medium">
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>{rows.map(renderRow)}</tbody>
			</table>
		</div>
	);
}