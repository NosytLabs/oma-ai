"use client";

import type { Message } from "@/components/chat";
import { MODELS } from "@/lib/models-data";

export const btnBase =
	"inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-transparent bg-transparent px-2.5 py-1 text-[11px] font-mono tracking-wider text-text-muted transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out hover:bg-surface hover:text-text-primary active:bg-surface-elevated disabled:pointer-events-none disabled:opacity-50 " +
	"data-[state=loading]:text-transparent data-[state=loading]:pointer-events-none " +
	"data-[state=error]:border-pink/30 data-[state=error]:text-pink data-[state=error]:bg-pink/10 " +
	"data-[state=success]:border-success/30 data-[state=success]:text-success data-[state=success]:bg-success/10";

interface StatsBarProps {
	messages: Message[];
	model?: string;
}

interface StatPillProps {
	label: string;
	value: string;
	accent?: boolean;
	title?: string;
}

function getModelPricing(modelId: string): {
	inputPer1M: number;
	outputPer1M: number;
} {
	const model = MODELS.find((m) => m.id === modelId || m.modelId === modelId);
	if (model) {
		return {
			inputPer1M: model.inputPricePer1M,
			outputPer1M: model.outputPricePer1M,
		};
	}
	return { inputPer1M: 0.15, outputPer1M: 0.6 };
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
			<span className="opacity-60">{label}</span>
			<span className="font-semibold tabular-nums">{value}</span>
		</span>
	);
}

export function StatsBar({ messages, model = "llama-3.3-70b" }: StatsBarProps) {
	const { inputPer1M, outputPer1M } = getModelPricing(model);
	const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0);
	const totalCost = messages.reduce((acc, m) => {
		if (m.inputTokens && m.outputTokens) {
			const inputCost = (m.inputTokens / 1_000_000) * inputPer1M;
			const outputCost = (m.outputTokens / 1_000_000) * outputPer1M;
			return acc + inputCost + outputCost;
		}
		return acc;
	}, 0);

	if (messages.length === 0) return null;

	const msgCount = messages.filter((m) => m.role === "user").length;
	const inCost = messages.reduce((a, m) => a + ((m.inputTokens ?? 0) / 1_000_000) * inputPer1M, 0);
	const outCost = messages.reduce((a, m) => a + ((m.outputTokens ?? 0) / 1_000_000) * outputPer1M, 0);

	return (
		<div className="flex items-center gap-1.5 font-mono">
			<StatPill label="MSG" value={msgCount.toString().padStart(2, "0")} />
			{totalTokens > 0 && (
				<>
					<StatPill label="TOK" value={totalTokens.toString().padStart(4, "0")} />
					<StatPill
						label="CST"
						value={`$${totalCost.toFixed(4)}`}
						accent
						title={`Session cost — estimated from ${model} list pricing (in: $${inCost.toFixed(4)} · out: $${outCost.toFixed(4)})`}
					/>
				</>
			)}
		</div>
	);
}

export function MobileStatsBar({
	messages,
	model = "llama-3.3-70b",
}: StatsBarProps) {
	const { inputPer1M, outputPer1M } = getModelPricing(model);
	const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0);
	const totalCost = messages.reduce((acc, m) => {
		if (m.inputTokens && m.outputTokens) {
			const inputCost = (m.inputTokens / 1_000_000) * inputPer1M;
			const outputCost = (m.outputTokens / 1_000_000) * outputPer1M;
			return acc + inputCost + outputCost;
		}
		return acc;
	}, 0);

	if (messages.length === 0) return null;

	const msgCount = messages.filter((m) => m.role === "user").length;

	return (
		<div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted font-mono">
			<span className="bg-surface px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-border">
				{msgCount}
				{msgCount === 1 ? " msg" : " msgs"}
			</span>
			{totalTokens > 0 && (
				<>
					<span className="bg-surface px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-border">
						{totalTokens >= 1000
							? `${(totalTokens / 1000).toFixed(1)}k`
							: totalTokens}{""}
						tok
					</span>
					<span className="bg-success-dim text-success px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-success/30">
						${totalCost.toFixed(4)}
					</span>
				</>
			)}
		</div>
	);
}
