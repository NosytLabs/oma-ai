import { formatPricePerMillion, type Model } from "@/lib/models-data";

export type Category = "all" | "frontier" | "premium" | "mid" | "budget";
export type AvailabilityStatus = "checking" | "live" | "unavailable";

export interface PricedModel {
	id: string;
	name: string;
	category: Category;
	provider: string;
	inputPer1M: number;
	outputPer1M: number;
	ctx: string;
	contextTokens: number;
	/**
	 * False when the backing provider's key is missing/placeholder, so the
	 * model 503s. Carried from `Model.available`; omitted means available.
	 */
	available?: boolean;
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
		available: model.available,
	};
}

/** Use the same actual per-token rates as the model catalog. */
export function fmtPrice(value: number): string {
	if (value <= 0) return "Free";
	return formatPricePerMillion(value);
}
