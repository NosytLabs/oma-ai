/**
 * Shared model UI types — the single source of truth for ModelOption and TierFilter.
 *
 * Lives in lib/ (not components/) so both lib/model-utils.ts and
 * components/chat/chat-message-shared.ts can import without circular deps.
 */

export interface ModelOption {
	id: string;
	name: string;
	category:
		| "frontier"
		| "premium"
		| "mid"
		| "budget"
		| "reasoning"
		| "coding"
		| "uncensored";
	provider: "Venice";
	inputPer1M: number;
	outputPer1M: number;
	ctx: string;
}

export type TierFilter =
	| "all"
	| "frontier"
	| "premium"
	| "mid"
	| "budget"
	| "reasoning"
	| "coding"
	| "uncensored";
