"use client";

import Link from "next/link";
import { memo } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import type { BalanceResponse, UsageRecord } from "@/lib/api";
import { toDollars } from "@/lib/utils";

interface CreditBalanceCardProps {
 balance: BalanceResponse | null;
 loading: boolean;
 /** Last 7 days of usage, oldest → newest. Drives the inline sparkline. */
 recentUsage?: UsageRecord[];
}

function CreditBalanceCardComponent({
 balance,
 loading,
 recentUsage = [],
}: CreditBalanceCardProps) {
 // Sparkline: 7-day spend totals, oldest → newest. Group by ISO date so a
 // sparse day still produces a zero point on the line.
 const sparkPoints = (() => {
 if (recentUsage.length === 0) return [];
 const byDay = new Map<string, number>();
 for (let i = 6; i >= 0; i--) {
 const d = new Date();
 d.setDate(d.getDate() - i);
 byDay.set(d.toISOString().slice(0, 10), 0);
 }
 for (const u of recentUsage) {
 const day = new Date(u.createdAt).toISOString().slice(0, 10);
 // biome-ignore lint/style/noNonNullAssertion: value is guaranteed by preceding check
 if (byDay.has(day))
 // Billed amount (cost + markup); decimal-string cents, may be
 // sub-cent. `toDollars` returns 0 for null/undefined/garbage.
 byDay.set(
 day,
 byDay.get(day)! + toDollars(u.totalCents ?? u.costCents),
 );
 }
 return Array.from(byDay.values());
 })();

 return (
 <div className="flex flex-col justify-between p-6 bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] h-full relative overflow-hidden transition-[border-color,background-color] hover:border-[var(--color-accent)]/40 hover:bg-surface/50">
 {/* Accent glow on top edge */}
 <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-success)]/40 via-[var(--color-success)]/20 to-transparent" />

 <div className="mb-6 flex items-start justify-between">
 <div>
 <h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
 Credit balance
 </h2>
 <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">
 Available credits
 </p>
 </div>
 <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)] shadow-[0_0_15px_-5px_var(--color-success-glow)]">
 <span className="text-[16px] font-mono font-bold">$</span>
 </div>
 </div>

 <div className="mb-6">
 <div className="text-[40px] font-display font-bold tracking-tight text-text-bright mb-2 leading-none">
 {!balance && loading ? (
 // Never flash a fake $0.00 while the balance query is in flight.
 <span
 className="inline-block h-12 w-36 animate-pulse rounded-[var(--radius-md)] bg-surface-elevated/60"
 aria-label="Loading credit balance"
 aria-busy="true"
 />
 ) : !balance ? (
 // Settled with no payload (error / empty) — show zero, not a lie mid-load.
 <span className="text-text-muted">0 credits</span>
 ) : (
 <div className="flex items-baseline gap-2">
 <AnimatedNumber
 value={Math.round(parseFloat(balance.balanceCents))}
 />
 <span className="text-[16px] text-text-muted font-mono uppercase tracking-wider font-bold">
 CR
 </span>
 </div>
 )}
 </div>
 <div className="flex items-center gap-2.5 text-[11.5px] font-mono text-text-muted bg-surface/50 px-3 py-1.5 rounded-[var(--radius-sm)] w-fit border border-border/40 shadow-inner">
 <span
 className="inline-block h-2 w-2 rounded-full bg-text-muted/60"
 aria-hidden="true"
 />
 {balance
 ? `Total deposited: ${Math.round(parseFloat(balance.totalDepositedCents))} credits (${(parseFloat(balance.totalDepositedCents) / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })})`
 : loading
 ? "Loading credits…"
 : "Total deposited: 0 credits"}
 </div>
 </div>

 {/* 7-day spend sparkline — visual depth without competing with the
 main AreaChart in the Usage tab. Hidden if no data yet. */}
 <div className="mb-6 -mx-2 px-3 py-2 bg-void/80 rounded-[var(--radius-md)] border border-border/50 shadow-inner">
 <Sparkline
 values={sparkPoints}
 heightClass="h-10"
 ariaLabel="7-day spend trend"
 />
 <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-text-muted">
 <span>7d ago</span>
 <span>Today</span>
 </div>
 </div>

 <div className="flex gap-3 pt-5 mt-auto">
 <Link
 href="/deposit?method=card"
 aria-label="Top up credits"
 className="group flex flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-void px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease-out hover:border-[var(--color-accent)]/50 hover:bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] hover:text-text-bright hover:shadow-[0_0_15px_-5px_var(--color-accent-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.97] "
 >
 Card
 </Link>
 <Link
 href="/deposit"
 aria-label="Deposit USDC"
 className="group flex flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-[var(--color-surface)] px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-[border-color,background-color,color,transform] duration-200 ease-out hover:bg-[var(--color-surface-elevated)] hover:text-text-bright hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border)] active:scale-[0.97] "
 >
 USDC
 </Link>
 </div>
 </div>
 );
}

export const CreditBalanceCard = memo(
 CreditBalanceCardComponent,
 (prev, next) => {
 return (
 prev.balance === next.balance &&
 prev.loading === next.loading &&
 prev.recentUsage === next.recentUsage
 );
 },
);
