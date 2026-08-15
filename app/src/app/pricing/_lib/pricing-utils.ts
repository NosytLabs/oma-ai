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

const VENDOR_DISPLAY: Record<string, string> = {
	venice: "Venice",
	"oma-ai": "OMA-AI",
};

export function toPricedModel(model: Model): PricedModel {
	return {
		id: model.id,
		name: model.name,
		category: model.tier as Category,
		provider: VENDOR_DISPLAY[model.provider] ?? model.provider,
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
	if (value < 1) {
		const rounded = Math.ceil(value * 20) / 20;
		return `$${rounded.toFixed(2)}`;
	}
	const rounded = Math.ceil(value * 20) / 20;
	return `$${rounded.toFixed(2)}`;
}

export function prettyName(id: string): string {
	return id
		.split("-")
		.map((part) =>
			/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join(" ");
}
