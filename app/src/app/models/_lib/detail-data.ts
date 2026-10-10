import { formatContextLength, resolveModelCapabilities, type Model, type ModelCapabilityMetadata } from "@/lib/models-data";

/** Fields returned by OMA's /v1/models endpoint. Prices are already per 1M. */
export interface LiveModelDetails extends ModelCapabilityMetadata {
	id: string;
	available?: boolean;
	unavailable_reason?: string;
	context_length?: number | null;
	max_output_tokens?: number;
	pricing?: { prompt?: string | number | null; completion?: string | number | null;
		extended?: { context_token_threshold: number; prompt: number; completion: number } };
	architecture?: { input_modalities?: string[]; output_modalities?: string[] };
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
		unavailableReason: live.unavailable_reason ?? model.unavailableReason,
		inputPricePer1M: priceOrFallback(live.pricing?.prompt, model.inputPricePer1M),
		outputPricePer1M: priceOrFallback(live.pricing?.completion, model.outputPricePer1M),
		contextTokens: context,
		maxOutputTokens: live.max_output_tokens ?? model.maxOutputTokens,
		extendedPricing: live.pricing?.extended ? {
			contextTokenThreshold: live.pricing.extended.context_token_threshold,
			inputPricePer1M: live.pricing.extended.prompt,
			outputPricePer1M: live.pricing.extended.completion,
		} : model.extendedPricing,
		contextLength: formatContextLength(context),
		capabilities: resolveModelCapabilities(live, model.capabilities),
		inputModalities: live.architecture?.input_modalities ?? model.inputModalities,
		outputModalities: live.architecture?.output_modalities ?? model.outputModalities,
	};
}
