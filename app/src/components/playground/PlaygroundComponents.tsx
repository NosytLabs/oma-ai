"use client";

import type { Message } from "@/components/chat";
import { MODELS } from "@/lib/models-data";

export const btnBase =
	"relative inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-all border rounded-full " +
	"bg-void border-border text-text-muted " +
	"hover:bg-surface hover:text-text hover:brightness-125 " +
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-success/50 focus-visible:outline-offset-1 focus-visible:bg-surface " +
	"active:translate-y-[1px] " +
	"disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-void disabled:hover:border-border disabled:hover:text-text-muted disabled:active:translate-y-0 " +
	"data-[state=loading]:text-transparent data-[state=loading]:pointer-events-none " +
	"data-[state=error]:border-pink/30 data-[state=error]:text-pink data-[state=error]:bg-pink/10 " +
	"data-[state=success]:border-success/30 data-[state=success]:text-success data-[state=success]:bg-success/10";

interface StatsBarProps {
	messages: Message[];
	model?: string;
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

export function StatsBar({ messages, model = "llama-3.2-3b" }: StatsBarProps) {
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

	return (
		<div className="flex items-center gap-4 text-[11px] uppercase tracking-wider text-text-muted font-mono">
			<span>
				MSG:
				{messages
					.filter((m) => m.role === "user")
					.length.toString()
					.padStart(2, "0")}
			</span>
			{totalTokens > 0 && (
				<>
					<span>TOK:{totalTokens.toString().padStart(4, "0")}</span>
					<span className="text-success">CST:${totalCost.toFixed(4)}</span>
				</>
			)}
		</div>
	);
}

export function MobileStatsBar({
	messages,
	model = "llama-3.2-3b",
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
			<span className="bg-surface px-1.5 py-0.5 rounded border border-border">
				{msgCount}
				{msgCount === 1 ? " msg" : " msgs"}
			</span>
			{totalTokens > 0 && (
				<>
					<span className="bg-surface px-1.5 py-0.5 rounded border border-border">
						{totalTokens >= 1000
							? `${(totalTokens / 1000).toFixed(1)}k`
							: totalTokens}{" "}
						tok
					</span>
					<span className="bg-success-dim text-success px-1.5 py-0.5 rounded border border-success/30">
						${totalCost.toFixed(4)}
					</span>
				</>
			)}
		</div>
	);
}
