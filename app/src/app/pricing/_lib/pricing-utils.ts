import type { Model } from "@/lib/models-data";

export type Category = "all" | "frontier" | "premium" | "mid" | "budget";

export interface PricedModel {
	id: string;
	name: string;
	category: Category;
	provider: string;
	inputPer1M: number;
	outputPer1M: number;
	ctx: string;
	contextTokens: number;
}

export function toPricedModel(model: Model): PricedModel {
	// Provider is already the canonical customer-facing brand label
	// ("Venice" | "OMA-AI") — `Provider` is typed in models-data.ts and
	// `normalizeProvider()` upstream-maps any lowercase/alias string to it.
	// No remap needed (the previous VENDOR_DISPLAY table only ever applied
	// an identity transform because its lowercase keys never matched).
	return {
		id: model.id,
		name: model.name,
		category: model.tier as Category,
		provider: model.provider,
		inputPer1M: model.inputPricePer1M,
		outputPer1M: model.outputPricePer1M,
		ctx: model.contextLength,
		contextTokens: model.contextTokens || 0,
	};
}

/**
	* Format a USD-per-1M price for display. Rounds to the nearest $0.05
	* so we never show awkward 4-decimal figures like $0.6125. Below the
	* rounding floor we just show the floor so the table stays visually
	* balanced.
	*/
export function fmtPrice(value: number): string {
	if (value <= 0) return "Free";
	if (value < 0.05) return "$0.05";
	const rounded = Math.ceil(value * 20) / 20;
	return `$${rounded.toFixed(2)}`;
}
