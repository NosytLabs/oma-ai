"use client";

import { Coins, MessageSquare } from "lucide-react";
import { estimateTokens } from "@/lib/text";
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
	// Credits are 1:1 with USD ($1 = 1 credit). Round to 4 decimals so
	// micro-costs on cheap models still show a non-zero value.
	const inputCost = (inputTokens / 1_000_000) * inputPer1M;
	// Estimate the output leg against the user's actual max_tokens setting.
	// Fall back to 1500 when the playground hasn't initialized yet (defensive —
	// the page always passes maxTokens, so this is a hot-load edge case).
	const outputBudget = maxTokens ?? 1500;
	const estimatedOutputCost = (outputBudget / 1_000_000) * outputPer1M;
	const totalCost = inputCost + estimatedOutputCost;
	const totalCredits = totalCost.toFixed(4);
	const inputCredits = inputCost.toFixed(4);

	return (
		<div className="flex items-center gap-3 text-[11.5px] font-mono text-text-muted uppercase tracking-wider">
			<div className="flex items-center gap-1.5">
				<MessageSquare className="w-3 h-3" />
				<span>{inputTokens} TK</span>
			</div>
			<div className="flex items-center gap-1.5 text-text-muted">
				<Coins className="w-3 h-3" />
				<span
					title={`In: ${inputCredits} cr · Out: ~${estimatedOutputCost.toFixed(4)} cr (${(outputBudget / 1000).toFixed(1)}k TK est)`}
				>
					{totalCredits} cr EST
				</span>
			</div>
		</div>
	);
}
