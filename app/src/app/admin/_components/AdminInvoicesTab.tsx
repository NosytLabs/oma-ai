"use client";

import { useId, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateShort, formatUsd } from "@/lib/utils";

export type InvoiceLineItem = {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
};

export type InvoiceDetailT = {
	id: string;
	invoiceNumber: string;
	userId: string;
	amount: number;
	status: string;
	lineItems: InvoiceLineItem[];
	dueDate: string;
	createdAt: string;
	user: { id: string; address: string; accountNumber: string } | null;
};

export default function AdminInvoicesTab() {
	const qc = useQueryClient();
	const [page, setPage] = useState(1);
	const [creating, setCreating] = useState(false);
	const [detail, setDetail] = useState<string | null>(null);

	const query = useQuery({
		queryKey: ["adminInvoices", page],
		queryFn: () => api.admin.getInvoices(page, 50),
		staleTime: 15_000,
	});

	const detailQuery = useQuery({
		queryKey: ["adminInvoiceDetail", detail],
		queryFn: () => api.admin.getInvoice(detail!),
		enabled: !!detail,
		staleTime: 15_000,
	});

	const invalidate = () => qc.invalidateQueries({ queryKey: ["adminInvoices", page] });

	const createMut = useMutation({
		mutationFn: (body: {
			userId: string;
			amount: number;
			lineItems: InvoiceLineItem[];
			dueDate: string;
		}) => api.admin.createInvoice(body),
		onSuccess: () => {
			setCreating(false);
			invalidate();
		},
	});

	const invoices = query.data?.invoices ?? [];
	const pagination = query.data?.pagination;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<span className="text-xs text-text-muted font-mono">
					{query.data?.pagination.total ?? 0} invoices
				</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setCreating((v) => !v)}
						className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text text-sm font-mono"
					>
						<Plus className="w-3.5 h-3.5" /> {creating ? "Close" : "New Invoice"}
					</button>
					<button
						type="button"
						onClick={() => query.refetch()}
						className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono"
					>
						<RefreshCw className="w-3.5 h-3.5" /> Refresh
					</button>
				</div>
			</div>

			{creating && (
				<CreateInvoiceForm
					onSubmit={(body) => createMut.mutate(body)}
					submitting={createMut.isPending}
					error={createMut.error ? (createMut.error as Error).message : null}
				/>
			)}

			{detail && detailQuery.data && (
				<InvoiceDetail
					invoice={detailQuery.data.invoice as InvoiceDetailT}
					onClose={() => setDetail(null)}
				/>
			)}

			<div className="rounded border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-border bg-surface">
								<Th>Number</Th>
								<Th>User</Th>
								<Th className="text-right">Amount</Th>
								<Th>Status</Th>
								<Th>Due</Th>
								<Th></Th>
							</tr>
						</thead>
						<tbody>
							{invoices.map((inv) => (
								<tr key={inv.id} className="border-b border-border/50 hover:bg-surface/50">
									<td className="px-4 py-3 font-mono text-text-secondary text-xs">
										{inv.invoiceNumber}
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{(inv.userAddress ?? inv.userId).slice(0, 10)}…
									</td>
									<td className="px-4 py-3 text-right font-mono text-accent text-xs">
										{formatUsd(inv.amount)}
									</td>
									<td className="px-4 py-3">
										<span className="text-xs font-mono uppercase text-text-muted">
											{inv.status}
										</span>
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{formatDateShort(inv.dueDate)}
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => setDetail(inv.id)}
											className="p-1.5 rounded hover:bg-panel text-text-muted hover:text-accent transition-colors inline-flex"
											title="View"
										>
											<Eye className="w-4 h-4" />
										</button>
									</td>
								</tr>
							))}
							{invoices.length === 0 && !query.isLoading && (
								<tr>
									<td colSpan={6} className="px-4 py-8 text-center text-text-muted font-mono">
										No invoices
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{pagination && (
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page <= 1}
						className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text disabled:opacity-30 text-sm font-mono"
					>
						Previous
					</button>
					<span className="text-xs text-text-muted font-mono">
						Page {pagination.page} of {pagination.pages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
						disabled={page >= pagination.pages}
						className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text disabled:opacity-30 text-sm font-mono"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
}

type CreateBody = {
	userId: string;
	amount: number;
	lineItems: InvoiceLineItem[];
	dueDate: string;
};

function CreateInvoiceForm({
	onSubmit,
	submitting,
	error,
}: {
	onSubmit: (b: CreateBody) => void;
	submitting: boolean;
	error: string | null;
}) {
	const [userId, setUserId] = useState("");
	const [amount, setAmount] = useState("");
	const [description, setDescription] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [unitPrice, setUnitPrice] = useState("");
	const [dueDate, setDueDate] = useState("");

	const submit = () => {
		const amt = parseFloat(amount);
		const q = parseFloat(quantity) || 1;
		const up = parseFloat(unitPrice);
		if (!userId || !Number.isFinite(amt) || !description || !Number.isFinite(up) || !dueDate)
			return;
		onSubmit({
			userId,
			amount: amt,
			dueDate: new Date(dueDate).toISOString().replace("Z", "+00:00"),
			lineItems: [{ description, quantity: q, unitPrice: up, total: q * up }],
		});
	};

	return (
		<div className="rounded border border-border bg-panel p-4 space-y-3">
			<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary flex items-center gap-2">
				<FileText className="w-4 h-4" /> New Invoice
			</h3>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<Field label="User ID (UUID)" value={userId} onChange={setUserId} placeholder="user uuid" />
				<Field label="Amount (USD)" value={amount} onChange={setAmount} placeholder="100.00" type="number" />
				<Field label="Description" value={description} onChange={setDescription} placeholder="API credits" />
				<Field label="Quantity" value={quantity} onChange={setQuantity} type="number" />
				<Field label="Unit Price (USD)" value={unitPrice} onChange={setUnitPrice} type="number" />
				<Field label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
			</div>
			{error && <div className="text-error text-xs font-mono">{error}</div>}
			<button
				type="button"
				disabled={submitting}
				onClick={submit}
				className="px-4 py-2 rounded border border-accent/40 bg-accent-dim/20 text-accent text-sm font-mono disabled:opacity-40"
			>
				Create Invoice
			</button>
		</div>
	);
}

function InvoiceDetail({
	invoice,
	onClose,
}: {
	invoice: InvoiceDetailT;
	onClose: () => void;
}) {
	return (
		<div className="rounded border border-border bg-panel p-4 space-y-2">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
					{invoice.invoiceNumber}
				</h3>
				<button
					type="button"
					onClick={onClose}
					className="text-text-muted hover:text-text text-sm font-mono"
				>
					Close
				</button>
			</div>
			<div className="text-xs font-mono text-text-muted">
				<div>User: {invoice.user?.address ?? invoice.userId}</div>
				<div>Amount: {formatUsd(invoice.amount)}</div>
				<div>Status: {invoice.status}</div>
				<div>Due: {formatDateShort(invoice.dueDate)}</div>
			</div>
			<div className="border-t border-border pt-2">
				<div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
					Line Items
				</div>
				{(invoice.lineItems ?? []).map((li, i) => (
					<div key={i} className="text-xs font-mono text-text-secondary flex justify-between">
						<span>
							{li.description} × {li.quantity}
						</span>
						<span>{formatUsd(li.total ?? li.unitPrice * li.quantity)}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	placeholder,
	type,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	type?: string;
}) {
	const inputId = useId();

	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={inputId} className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
				{label}
			</label>
			<input
				id={inputId}
				type={type ?? "text"}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-none focus:border-accent/50"
			/>
		</div>
	);
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
	return (
		<th className={`px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider ${className ?? ""}`}>
			{children}
		</th>
	);
}
