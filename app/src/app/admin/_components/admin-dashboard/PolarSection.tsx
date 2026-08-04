"use client";

import { Loader2 } from "lucide-react";
import { polarFetch } from "./api";
import type {
	PolarCheckout,
	PolarCustomer,
	PolarPayment,
	PolarProduct,
	PolarSubscription,
	PolarTab,
} from "./types";

import { useAdminDashboard } from "./context";

export function PolarSection() {
	const {
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

	} = useAdminDashboard();

	return (
			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Polar Payments
					</h2>
					<div className="flex gap-1 text-xs">
						{(
							[
								"payments",
								"customers",
								"products",
								"subscriptions",
								"checkouts",
							] as PolarTab[]
						).map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => {
									setPolarTab(tab);
									setPolarError(null);
								}}
								className={`rounded px-2 py-1 transition ${
									polarTab === tab
										? "bg-accent/20 text-accent"
										: "text-text-muted hover:text-text"
								}`}
							>
								{tab}
							</button>
						))}
					</div>
				</div>
				{polarError && (
					<div className="mb-3 rounded-md bg-error/10 p-2 text-xs text-error">
						{polarError}
					</div>
				)}
				{polarLoading ? (
					<div className="flex items-center gap-2 text-text-muted">
						<Loader2 className="h-4 w-4 animate-spin" /> Loading…
					</div>
				) : polarTab === "payments" ? (
					polarPayments.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No payments yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-right">Amount</th>
										<th className="py-1.5 text-left">Status</th>
										<th className="py-1.5 text-left">Customer</th>
									</tr>
								</thead>
								<tbody>
									{polarPayments.map((p) => (
										<tr
											key={p.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{p.id.slice(0, 12)}…
											</td>
											<td className="py-1.5 text-right font-mono">
												{(p.amount / 100).toFixed(2)}{" "}
												{p.currency.toUpperCase()}
											</td>
											<td className="py-1.5">
												<span
													className={`rounded px-1.5 py-0.5 text-[10px] ${
														p.status === "paid" || p.status === "completed"
															? "bg-accent/15 text-accent"
															: "bg-warning/15 text-warning"
													}`}
												>
													{p.status}
												</span>
											</td>
											<td className="py-1.5 text-text-muted">
												{p.customer_email}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "customers" ? (
					polarCustomers.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No customers yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Name</th>
										<th className="py-1.5 text-left">Email</th>
									</tr>
								</thead>
								<tbody>
									{polarCustomers.map((c) => (
										<tr
											key={c.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{c.id.slice(0, 12)}…
											</td>
											<td className="py-1.5">{c.name || "—"}</td>
											<td className="py-1.5 text-text-muted">
												{c.email}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "products" ? (
					polarProducts.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No products yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Name</th>
										<th className="py-1.5 text-left">Type</th>
										<th className="py-1.5 text-right">Price</th>
									</tr>
								</thead>
								<tbody>
									{polarProducts.map((p) => (
										<tr
											key={p.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{p.id.slice(0, 12)}…
											</td>
											<td className="py-1.5">{p.name}</td>
											<td className="py-1.5">
												<span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] uppercase">
													{p.type}
												</span>
											</td>
											<td className="py-1.5 text-right font-mono">
												{p.pricing?.amount !== undefined
													? `${(p.pricing.amount / 100).toFixed(2)} ${p.pricing.currency?.toUpperCase() ?? "USD"}`
													: "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "subscriptions" ? (
					polarSubscriptions.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No subscriptions yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Customer</th>
										<th className="py-1.5 text-left">Product</th>
										<th className="py-1.5 text-left">Status</th>
									</tr>
								</thead>
								<tbody>
									{polarSubscriptions.map((s) => (
										<tr
											key={s.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{s.id.slice(0, 12)}…
											</td>
											<td className="py-1.5 font-mono text-text-muted">
												{s.customer_id.slice(0, 12)}…
											</td>
											<td className="py-1.5 font-mono text-text-muted">
												{s.product_id.slice(0, 12)}…
											</td>
											<td className="py-1.5">
												<span
													className={`rounded px-1.5 py-0.5 text-[10px] ${
														s.status === "active"
															? "bg-accent/15 text-accent"
															: "bg-text-muted/15 text-text-muted"
													}`}
												>
													{s.status}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "checkouts" ? (
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Product ID
								</label>
								<input
									type="text"
									value={checkoutProduct}
									onChange={(e) => setCheckoutProduct(e.target.value)}
									placeholder="prod_xxx"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Customer Email
								</label>
								<input
									type="email"
									value={checkoutEmail}
									onChange={(e) => setCheckoutEmail(e.target.value)}
									placeholder="user@example.com"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Customer Name (optional)
								</label>
								<input
									type="text"
									value={checkoutName}
									onChange={(e) => setCheckoutName(e.target.value)}
									placeholder="John Doe"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Success URL (optional)
								</label>
								<input
									type="url"
									value={checkoutSuccess}
									onChange={(e) => setCheckoutSuccess(e.target.value)}
									placeholder="https://example.com/success"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
						</div>
						<div>
							<label className="mb-1 block text-xs text-text-muted">
								Cancel URL (optional)
							</label>
							<input
								type="url"
								value={checkoutCancel}
								onChange={(e) => setCheckoutCancel(e.target.value)}
								placeholder="https://example.com/cancel"
								className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<button
							type="button"
							onClick={async () => {
								setPolarError(null);
								setPolarLoading(true);
								try {
									const result = await polarFetch<{
										data: PolarCheckout;
									}>(`/v1/admin/polar/checkouts`);
									setCheckoutResult(result.data);
								} catch (err) {
									setPolarError(String((err as Error).message ?? err));
								} finally {
									setPolarLoading(false);
								}
							}}
							disabled={polarLoading || !checkoutProduct}
							className="rounded-md bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
						>
							{polarLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Create Checkout Link"
							)}
						</button>
						{checkoutResult && (
							<div className="rounded-md border border-border bg-surface-elevated/50 p-3">
								<p className="text-xs text-text-muted mb-2">
									Checkout created — share this link:
								</p>
								<a
									href={checkoutResult.checkout_url}
									target="_blank"
									rel="noopener noreferrer"
									className="break-all text-sm font-mono text-accent hover:underline"
								>
									{checkoutResult.checkout_url}
								</a>
							</div>
						)}
					</div>
				) : null}
				{polarTab !== "checkouts" && (polarPayments.length > 0 || polarCustomers.length > 0 || polarProducts.length > 0 || polarSubscriptions.length > 0) && (
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={async () => {
								setPolarError(null);
								setPolarLoading(true);
								try {
									if (polarTab === "payments") {
										const data = await polarFetch<{ data: PolarPayment[] }>("/v1/admin/polar/payments");
										setPolarPayments(data.data);
									} else if (polarTab === "customers") {
										const data = await polarFetch<{ data: PolarCustomer[] }>("/v1/admin/polar/customers");
										setPolarCustomers(data.data);
									} else if (polarTab === "products") {
										const data = await polarFetch<{ data: PolarProduct[] }>("/v1/admin/polar/products");
										setPolarProducts(data.data);
									} else if (polarTab === "subscriptions") {
										const data = await polarFetch<{ data: PolarSubscription[] }>("/v1/admin/polar/subscriptions");
										setPolarSubscriptions(data.data);
									}
								} catch (err) {
									setPolarError(String((err as Error).message ?? err));
								} finally {
									setPolarLoading(false);
								}
							}}
							disabled={polarLoading}
							className="rounded-md border border-border bg-surface-elevated/40 px-3 py-1.5 text-xs hover:bg-surface-elevated disabled:opacity-50"
						>
							{polarLoading ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								"Refresh"
							)}
						</button>
					</div>
				)}
			</section>

	);
}
