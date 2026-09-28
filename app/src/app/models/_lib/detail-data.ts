import { formatContextLength, type Model } from "@/lib/models-data";

/** Fields returned by OMA's /v1/models endpoint. Prices are already per 1M. */
export interface LiveModelDetails {
	id: string;
	available?: boolean;
	context_length?: number | null;
	pricing?: { prompt?: string | number | null; completion?: string | number | null };
	architecture?: { input_modalities?: string[]; output_modalities?: string[] };
	supported_parameters?: string[];
	supports_tools?: boolean;
	supports_streaming?: boolean;
}

function priceOrFallback(value: string | number | null | undefined, fallback: number) {
	if (value === null || value === undefined || value === "") return fallback;
	const price = Number(value);
	return Number.isFinite(price) && price >= 0 ? price : fallback;
}

/** Keep curated identity and descriptions while refreshing operational facts. */
export function withLiveModelDetails(model: Model, live: LiveModelDetails | null): Model {
	if (!live) return model;
	const context = typeof live.context_length === "number" && Number.isFinite(live.context_length) && live.context_length > 0
		? live.context_length
		: model.contextTokens;
	return {
		...model,
		available: live.available,
		inputPricePer1M: priceOrFallback(live.pricing?.prompt, model.inputPricePer1M),
		outputPricePer1M: priceOrFallback(live.pricing?.completion, model.outputPricePer1M),
		contextTokens: context,
		contextLength: formatContextLength(context),
		inputModalities: live.architecture?.input_modalities ?? model.inputModalities,
		outputModalities: live.architecture?.output_modalities ?? model.outputModalities,
	};
}
