"use client";

import { Coins, MessageSquare } from "lucide-react";
import { estimateTokens } from "@/lib/text";
import { useSharedLiveModelCatalog } from "./chat-message-shared";

interface CostEstimateProps {
	inputText: string;
	model: string;
	/**
	 * Output budget (max_tokens) from the playground. Used for the cost pill
	 * so the estimated output cost scales with the user's actual setting
	 * instead of a stale 1500-token assumption.
	 */
	maxTokens?: number;
	/** Guest and session-authenticated website requests on verified free models are not billed at API rates. */
	freeWebsiteChat?: boolean;
}

/* Lives in its own file (extracted from MessageInput.tsx) so chat/page.tsx
	* can lazy-load it via next/dynamic. Otherwise the chat main bundle pulls in
	* useLiveModels → lib/api client → the entire fetch/credentials/csrf machinery
	* just to render a cost pill — even though the live catalog is only relevant
	* for the cost number itself. */
export function CostEstimate({
	inputText,
	model,
	maxTokens,
	freeWebsiteChat = false,
}: CostEstimateProps) {
	const { models, status } = useSharedLiveModelCatalog();
	const selectedModel = models.find((m) => m.id === model);
	const inputTokens = estimateTokens(inputText);
	const outputBudget = maxTokens ?? 1500;
	const hasPricing = status === "live" && selectedModel &&
		selectedModel.pricingAvailable === true &&
		[selectedModel.inputPer1M, selectedModel.outputPer1M].every((rate) => Number.isFinite(rate) && rate >= 0);
	let label = status === "loading" ? "Loading pricing…" : "Pricing unavailable";
	let title = "A live price is required to estimate this request.";
	if (status === "live" && freeWebsiteChat) {
		label = "Free chat";
		title = "Website chat on this model is free. API requests are billed separately.";
	} else if (hasPricing) {
		// Preserve fractional credits. The deposit helper rounds down to whole
		// credits, which understated 7.50 as 7.00 and small charges as zero.
		const inputCredits = inputTokens * selectedModel.inputPer1M / 10_000;
		const outputCredits = outputBudget * selectedModel.outputPer1M / 10_000;
		const totalCredits = inputCredits + outputCredits;
		label = `${totalCredits > 0 && totalCredits < 0.01 ? "<0.01" : totalCredits.toFixed(2)} cr EST`;
		title = `Draft: ${inputCredits.toFixed(4)} cr · Reply budget: ${outputCredits.toFixed(4)} cr (${outputBudget.toLocaleString()} tokens max) · Excludes conversation history and system instructions · 1 credit = $0.01`;
	}

	return (
		<div className="flex items-center gap-3 text-[11.5px] font-mono text-text-muted uppercase tracking-wider">
			<div className="flex items-center gap-1.5">
				<MessageSquare className="w-3 h-3 text-[var(--color-accent)]" />
				<span>{inputTokens} TK</span>
			</div>
			<div className="flex items-center gap-1.5 text-text-muted">
				<Coins className="w-3 h-3 text-[var(--color-success)]" />
				<span
					title={title}
					role="status"
					aria-live="polite"
				>
					{label}
				</span>
			</div>
		</div>
	);
}
