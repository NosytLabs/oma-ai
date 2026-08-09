/**
 * Shared ModelOption type — used by both the live model catalog
 * (components/chat/ChatMessage) and the humanization utilities
 * (lib/model-utils). Living here breaks the lib → components circular
 * dependency that previously existed.
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
	provider: "Venice" | "OMA-AI" | "Both" | "Surplus";
	inputPer1M: number;
	outputPer1M: number;
	ctx: string;
	/** false when the serving provider key is missing/placeholder (server-reported) */
	available?: boolean;
}

type TierFilter =
	| "all"
	| "frontier"
	| "premium"
	| "mid"
	| "budget"
	| "reasoning"
	| "coding"
	| "uncensored";
