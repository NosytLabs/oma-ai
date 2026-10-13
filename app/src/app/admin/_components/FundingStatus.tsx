"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import type { SitePaymentSettings } from "@/lib/payment-rails";

export function FundingStatus() {
	const { isReady, isAdmin, user } = useAuth();
	const [checkBalances, setCheckBalances] = useState(false);
	const balances = useQuery({ queryKey: ["admin", "treasury-balances", user?.id],
		enabled: isReady && isAdmin && checkBalances, staleTime: 30_000, retry: false,
		queryFn: async (): Promise<{ mode: string; checkedAt: string; wallets: Array<{ role: string; label: string; address: string | null; eth: string | null; usdc: string | null; error: string | null }> }> => {
			const response = await fetch("/api/v1/admin/treasury", { cache: "no-store" });
			if (!response.ok) throw new Error("Wallet balance check is unavailable.");
			return response.json();
		} });
	const settings = useQuery({ queryKey: ["site-settings"], enabled: isReady && isAdmin, staleTime: 15_000,
		queryFn: async (): Promise<SitePaymentSettings> => {
			const response = await fetch("/api/v1/site-settings", { credentials: "include", cache: "no-store" });
			if (!response.ok) throw new Error("Payment configuration could not load.");
			return response.json();
		} });
	const treasury = useQuery({ queryKey: ["admin", "treasury-recipient"], enabled: isReady && isAdmin && settings.data?.x402Configured === true, staleTime: 60_000,
		queryFn: async (): Promise<{ payTo: string; network: string }> => {
			const response = await fetch("/x402/info", { cache: "no-store" });
			if (!response.ok) throw new Error("Treasury discovery is unavailable.");
			return response.json();
		} });
	const data = settings.data;
	const rails = [
		{ label: "Card credit packs", configured: data?.polarConfigured, enabled: data?.cardPaymentsEnabled, hint: "Polar checkout → signed webhook → OMA credits" },
		{ label: "USDC deposits", configured: data?.usdcDepositConfigured, enabled: data?.cryptoPaymentsEnabled, hint: "Confirmed Base transfer → deposit ledger → OMA credits" },
		{ label: "x402 funding", configured: data?.x402Configured, enabled: data?.cryptoPaymentsEnabled, hint: "Wallet authorization → confirmed transfer → payer-bound credits" },
	];
	return <section className="rounded-xl border border-border bg-surface p-4 sm:p-5" aria-label="Funding readiness">
		<header className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-text-bright">Payments & treasury</h2><Link href="/docs#x402" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">Payment flow docs</Link></header>
		{settings.isError ? <p role="alert" className="text-sm text-error">Payment configuration could not load. Refresh the dashboard to retry.</p> : <div className="grid gap-3 md:grid-cols-3">{rails.map(rail => {
			const label = settings.isPending ? "Checking…" : data?.paymentStatusAvailable === false ? "Unavailable" : !rail.configured ? "Setup required" : !rail.enabled || data?.maintenanceMode ? "Paused" : "Configured";
			return <div key={rail.label} className="rounded-lg border border-border bg-void/30 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold text-text-bright">{rail.label}</h3><span className={`text-xs ${label === "Configured" ? "text-success" : "text-warning"}`}>{label}</span></div><p className="mt-3 text-xs leading-relaxed text-text-muted">{rail.hint}</p></div>;
		})}</div>}
		{treasury.data && <div className="mt-4 rounded-lg border border-border p-3"><p className="mb-1 text-xs text-text-muted">x402 treasury recipient · Base mainnet</p><a href={`https://basescan.org/address/${treasury.data.payTo}`} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-xs text-accent hover:underline">{treasury.data.payTo}</a></div>}
		{treasury.isError && <p className="mt-3 text-sm text-error">x402 is configured, but treasury discovery failed. Check the API before authorizing payments.</p>}
		<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-text-muted">Check recipient funds and the facilitator’s gas wallet on Base.</p><button type="button" disabled={balances.isFetching} onClick={() => { if (checkBalances) void balances.refetch(); else setCheckBalances(true); }} className="min-h-11 rounded-lg border border-border px-3 text-sm text-accent disabled:opacity-50">{balances.isFetching ? "Checking balances…" : "Check wallet balances"}</button></div>
		{balances.isError && <p role="alert" className="mt-3 text-sm text-error">Wallet balances could not load. Retry the check.</p>}
		{balances.data && <div className="mt-3 grid gap-3 md:grid-cols-3">{balances.data.wallets.map(wallet => <div key={wallet.role} className="min-w-0 rounded-lg border border-border p-3"><h3 className="text-sm font-medium text-text-bright">{wallet.label}</h3>{wallet.address && <a href={`https://basescan.org/address/${wallet.address}`} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all font-mono text-xs text-accent">{wallet.address}</a>}{wallet.error ? <p className="mt-2 text-xs text-warning">{wallet.error}</p> : <><p className="mt-2 font-mono text-xs">{wallet.usdc} USDC · {wallet.eth} ETH</p>{wallet.role === "facilitator" && Number(wallet.eth) === 0 && <p className="mt-2 text-xs text-error">Gas wallet is empty. x402 transfers need ETH for transaction fees.</p>}</>}</div>)}</div>}
		{balances.data && <p className="mt-2 text-xs text-text-muted">Checked {new Date(balances.data.checkedAt).toLocaleString()} · {balances.data.mode} mode. A balance check does not confirm payment settlement or sufficient gas for a specific transaction.</p>}
		<p className="mt-4 text-xs leading-relaxed text-text-muted">Configuration does not confirm a completed purchase or the facilitator’s gas balance. The x402 recipient can differ from the direct deposit address. Credits are the customer ledger; treasury funds and provider procurement costs are separate.</p>
	</section>;
}
