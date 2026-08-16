"use client";

import { Coins, MessageSquare } from "lucide-react";
import { estimateTokens } from "@/lib/text";
import { usdToCredits } from "@/lib/credit-utils";
import { useSharedLiveModels } from "./chat-message-shared";

interface CostEstimateProps {
	inputText: string;
	model: string;
	/**
	 * Output budget (max_tokens) from the playground. Used for the cost pill
	 * so the estimated output cost scales with the user's actual setting
	 * instead of a stale 1500-token assumption.
	 */
	maxTokens?: number;
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
}: CostEstimateProps) {
	const MODELS = useSharedLiveModels();
	const selectedModel = MODELS.find((m) => m.id === model);
	// Fallback rate when the model isn't in the live catalog (e.g. a stale
	// ?model=invalid-model URL): use a generic $1 per 1M tokens instead of
	// silently dropping the cost pill — the token count still shows, so
	// dropping the cost would leave a confusing partial estimate.
	const inputPer1M = selectedModel?.inputPer1M ?? 1;
	const outputPer1M = selectedModel?.outputPer1M ?? 1;

	const inputTokens = estimateTokens(inputText);
	// Credit math: 1 credit = $0.01 (1 cent). The server deducts
	// `balanceCents` for every request, so USD costs from the catalog
	// (which are in dollars) need to be multiplied by 100 to express
	// them in credits. This matches the  tier math: $10 buys
	// 1,000 credits (100 credits per dollar). Display 4 decimals so
	// sub-cent micro-costs on the cheapest models still show.
	const inputCostUsd = (inputTokens / 1_000_000) * inputPer1M;
	// Estimate the output leg against the user's actual max_tokens setting.
	// Fall back to 1500 when the playground hasn't initialized yet (defensive —
	// the page always passes maxTokens, so this is a hot-load edge case).
	const outputBudget = maxTokens ?? 1500;
	const estimatedOutputCostUsd = (outputBudget / 1_000_000) * outputPer1M;
	const totalCostUsd = inputCostUsd + estimatedOutputCostUsd;

	const inputCredits = usdToCredits(inputCostUsd).toFixed(4);
	const estimatedOutputCredits = usdToCredits(estimatedOutputCostUsd).toFixed(4);
	// Visible value: 2 decimals so it doesn't read as "$0.0000" for free models.
	// 4-decimal precision stays in the tooltip so power users can still see it.
	const visibleCredits = usdToCredits(totalCostUsd).toFixed(2);

	return (
		<div className="flex items-center gap-3 text-[11.5px] font-mono text-text-muted uppercase tracking-wider">
			<div className="flex items-center gap-1.5">
				<MessageSquare className="w-3 h-3 text-[var(--color-accent)]" />
				<span>{inputTokens} TK</span>
			</div>
			<div className="flex items-center gap-1.5 text-text-muted">
				<Coins className="w-3 h-3 text-[var(--color-success)]" />
				<span
					title={`In: ${inputCredits} cr · Out: ~${estimatedOutputCredits} cr (${(outputBudget / 1000).toFixed(1)}k TK est) · 1 credit = $0.01`}
					role="status"
					aria-live="polite"
				>
					{totalCostUsd === 0 ? "FREE" : `${visibleCredits} cr EST`}
				</span>
			</div>
		</div>
	);
}
