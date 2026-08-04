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
}

const VENDOR_DISPLAY: Record<string, string> = {
	Venice: "Venice",
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
	};
}

export function fmtPrice(value: number): string {
	if (value < 0.01) return "$0.01";
	if (value < 1) return `$${value.toFixed(4)}`;
	return `$${value.toFixed(2)}`;
}

export function prettyName(id: string): string {
	return id
		.split("-")
		.map((part) =>
			/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join(" ");
}
