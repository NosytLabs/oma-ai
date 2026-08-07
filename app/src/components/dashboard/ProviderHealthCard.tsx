"use client";

import { useMemo } from "react";
import { useHealthQuery } from "@/app/dashboard/_hooks/useHealthQuery";
import { formatTime } from "@/lib/utils";
import {
 type CheckStatus,
 getStatusLabel,
 TONE_DOT,
 TONE_TEXT,
} from "./healthTone";

type CheckEntry = {
 id: string;
 name: string;
 status: CheckStatus;
 latency?: number;
 cooldownMs?: number;
};

function humanize(id: string): string {
 return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeTime(timestamp: number | undefined): string {
 if (!timestamp) return "never";
 return formatTime(new Date(timestamp).toISOString());
}

export function ProviderHealthCard() {
 const { data: health, isLoading, isError, dataUpdatedAt } = useHealthQuery();

 const checks: CheckEntry[] = useMemo(() => {
 if (!health?.checks || Object.keys(health.checks).length === 0) {
 // Fallback row when only top-level status is available
 if (health?.status) {
 return [
 {
 id: "api",
 name: "API",
 status: (health.status === "ok"
 ? "ok"
 : health.status) as CheckStatus,
 },
 ];
 }
 return [];
 }
 return Object.entries(health.checks).map(([id, raw]) => {
 const entry = (raw ?? {}) as {
 status?: CheckStatus;
 latency?: number;
 cooldownMs?: number;
 };
 return {
 id,
 name: humanize(id),
 status: entry.status ?? "outage",
 latency: entry.latency,
 cooldownMs: entry.cooldownMs,
 };
 });
 }, [health]);

 return (
 <div className="flex flex-col p-6 bg-[var(--color-surface)]/30 border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] transition-[border-color,background-color] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)]/50 relative overflow-hidden h-full">
 {/* Accent glow on top edge */}
 <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-accent)]/40 via-[var(--color-accent)]/20 to-transparent" />

 <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
 <div>
 <h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
 System health
 </h2>
 <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">
 Live readiness checks for API dependencies
 </p>
 </div>
 {!isLoading &&
 !isError &&
 health &&
 (() => {
 const overall = getStatusLabel(
 (health.status as CheckStatus) || "ok",
 );
 return (
 <div
 aria-live="polite"
 className="flex items-center gap-2 border border-[var(--color-border)]/50 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)]/50 shadow-inner"
 >
 <span
 className={`inline-block h-2 w-2 rounded-full ${TONE_DOT[overall.tone]}`}
 />
 <span
 className={`text-[11px] font-mono uppercase tracking-wider font-bold ${TONE_TEXT[overall.tone]}`}
 >
 {overall.label}
 </span>
 </div>
 );
 })()}
 </div>

 {isLoading ? (
 <div className="flex items-center gap-2 p-4 text-xs text-text-muted">
 <span className="inline-block h-2 w-2 animate-pulse bg-text-muted" />
 Checking readiness…
 </div>
 ) : isError ? (
 <div className="border border-[var(--color-error)]/20 bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] p-4 text-xs text-error">
 Health check failed
 </div>
 ) : checks.length === 0 ? (
 <div className="p-4 text-xs text-text-muted">
 No readiness signals available.
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-border)]/40 rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)]/40">
 {checks.map((check) => {
 const info = getStatusLabel(check.status);
 return (
 <div
 key={check.id}
 className="flex flex-col justify-between p-4 bg-[var(--color-void)]/80 hover:bg-[var(--color-surface)]/30 transition-colors duration-200 ease-out"
 >
 <div className="mb-4 text-[11px] font-mono uppercase tracking-wider font-bold text-text-secondary">
 {check.name}
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span
 className={`inline-block h-2 w-2 rounded-full ${TONE_DOT[info.tone]}`}
 />
 <span
 className={`text-xs font-bold ${TONE_TEXT[info.tone]}`}
 >
 {info.label}
 </span>
 </div>
 {check.latency !== undefined && check.latency > 0 && (
 <span className="text-[11px] text-text-muted font-mono bg-[var(--color-surface)] px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)]/50">
 {check.latency}ms
 </span>
 )}
 </div>
 {check.status === "rate_limited" &&
 typeof check.cooldownMs === "number" &&
 check.cooldownMs > 0 && (
 <div className="mt-2 text-[11px] text-text-muted font-mono">
 Retry in {Math.ceil(check.cooldownMs / 1000)}s
 </div>
 )}
 </div>
 );
 })}
 </div>
 <div className="mt-3 text-[11px] text-text-muted">
 Last checked {formatRelativeTime(dataUpdatedAt)}
 </div>
 </>
 )}
 </div>
 );
}
