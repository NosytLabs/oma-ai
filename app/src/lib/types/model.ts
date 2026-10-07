import type { Provider } from "@/lib/models-data";

/**
	* Shared ModelOption type — used by both the live model catalog
	* (components/chat/ChatMessage) and the humanization utilities
	* (lib/model-utils). Living here breaks the lib → components circular
	* dependency that previously existed.
	*
	* `provider` is the customer-visible brand — sourced from the canonical
	* `Provider` type in `models-data.ts` (capitalized "Venice" / "OMA-AI").
	* Anything upstream returns is run through `normalizeProvider` before
	* it lands here, so consumers can rely on the canonical strings.
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
	provider: Provider;
	inputPer1M: number;
	outputPer1M: number;
	ctx: string;
 maxOutputTokens?: number;
 unavailableReason?: string;
	/** false when the serving provider key is missing/placeholder (server-reported) */
	available?: boolean;
}
