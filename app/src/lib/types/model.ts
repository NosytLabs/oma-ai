import type { Provider } from "@/lib/models-data";

/**
	* Shared model contract for the live catalog and display utilities.
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
	/** false when the serving provider key is missing/placeholder (server-reported) */
	available?: boolean;
	/** Only true when both prices were present and valid in the live response. */
	pricingAvailable?: boolean;
}
