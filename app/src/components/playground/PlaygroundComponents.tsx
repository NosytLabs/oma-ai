"use client";

import type { Message } from "@/components/chat";

export const btnBase =
	"inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-transparent bg-transparent px-2.5 py-1 text-[11px] font-mono tracking-wider text-text-muted transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out hover:bg-surface hover:text-text-primary active:bg-surface-elevated disabled:pointer-events-none disabled:opacity-50 " +
	"data-[state=loading]:text-transparent data-[state=loading]:pointer-events-none " +
	"data-[state=error]:border-pink/30 data-[state=error]:text-pink data-[state=error]:bg-pink/10 " +
	"data-[state=success]:border-success/30 data-[state=success]:text-success data-[state=success]:bg-success/10";

interface StatsBarProps {
	messages: Message[];
}

interface StatPillProps {
	label: string;
	value: string;
	accent?: boolean;
	title?: string;
}

function StatPill({ label, value, accent, title }: StatPillProps) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-[var(--radius-md)] border px-2 py-0.5 text-[10.5px] font-mono uppercase tracking-wider transition-colors duration-200 ease-out ${
				accent
					? "border-success/30 bg-success/10 text-success"
					: "border-border bg-surface/40 text-text-secondary hover:border-accent/30 hover:text-text"
			}`}
			title={title}
		>
			<span className="opacity-80">{label}</span>
			<span className="font-semibold tabular-nums">{value}</span>
		</span>
	);
}

export function StatsBar({ messages }: StatsBarProps) {
	const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0);

	if (messages.length === 0) return null;

	const msgCount = messages.filter((m) => m.role === "user").length;

	return (
		<div className="flex items-center gap-1.5 font-mono">
			<StatPill label="MSG" value={msgCount.toString().padStart(2, "0")} />
			{totalTokens > 0 && <StatPill label="TOK" value={totalTokens.toString().padStart(4, "0")} />}
		</div>
	);
}

