/**
	* Billing helper — pricing lookup against the model catalog.
	*
	* The chat route calls `getModelPricing(modelId)` before deducting
	* credits from `creditBalances`. Markup is applied at deduction time
	* in `recordUsage`.
	*
	* Admin pricing overrides (models-overrides.json) are final user-facing
	* prices: when present they are billed as-is with no additional markup,
	* matching what /v1/models displays.
	*/
import { getModelById } from "./models.js";
import {
		readModelPricingOverrides,
		type ModelPricingOverride,
} from "../lib/model-overrides.js";

export interface ModelPricing {
		inputPer1M: number;
		outputPer1M: number;
		markup: number;
		/** Wholesale estimates stay independent of final customer overrides. */
		costInputPer1M?: number;
		costOutputPer1M?: number;
		costKnown?: boolean;
		extended?: { contextTokenThreshold: number; pricing: ModelPricing };
}

let _overrideCache: {
		at: number;
		overrides: Record<string, ModelPricingOverride>;
} | null = null;
const OVERRIDE_CACHE_TTL_MS = 5_000;

function getOverrides(): Record<string, ModelPricingOverride> {
		const now = Date.now();
		if (!_overrideCache || now - _overrideCache.at > OVERRIDE_CACHE_TTL_MS) {
				_overrideCache = { at: now, overrides: readModelPricingOverrides() };
		}
		return _overrideCache.overrides;
}

export function getModelPricing(modelId: string): ModelPricing {
	const m = getModelById(modelId);
	if (!m) {
		throw new Error(`Model ${modelId} not found in catalog`);
	}
	const override = getOverrides()[modelId];
	const costKnown = m.upstreamCostKnown !== false;
	const costFields = { costInputPer1M: m.inputPricePer1M, costOutputPer1M: m.outputPricePer1M, costKnown };
	if (override) {
		return {
			inputPer1M: override.inputPricePer1M,
			outputPer1M: override.outputPricePer1M,
			markup: 0,
			...costFields,
			...(m.extendedPricing ? { extended: {
				contextTokenThreshold: m.extendedPricing.contextTokenThreshold,
				pricing: {
					inputPer1M: override.inputPricePer1M, outputPer1M: override.outputPricePer1M, markup: 0,
					costInputPer1M: m.extendedPricing.inputPricePer1M,
					costOutputPer1M: m.extendedPricing.outputPricePer1M, costKnown,
				},
			} } : {}),
		};
	}
	if (m.customerInputPricePer1M !== undefined && m.customerOutputPricePer1M !== undefined) {
		return {
			inputPer1M: m.customerInputPricePer1M, outputPer1M: m.customerOutputPricePer1M,
			markup: 0, ...costFields,
		};
	}
	return {
		inputPer1M: m.inputPricePer1M,
		outputPer1M: m.outputPricePer1M,
		markup: m.markupPercent,
		...(m.extendedPricing ? { extended: {
			contextTokenThreshold: m.extendedPricing.contextTokenThreshold,
			pricing: {
				inputPer1M: m.extendedPricing.inputPricePer1M,
				outputPer1M: m.extendedPricing.outputPricePer1M, markup: m.markupPercent,
			},
		} } : {}),
	};
}

/** Extended rates apply to both input and output once input crosses the tier. */
export function pricingForContext(pricing: ModelPricing, promptTokens: number): ModelPricing {
	return pricing.extended && promptTokens > pricing.extended.contextTokenThreshold
		? pricing.extended.pricing : pricing;
}

/**
	* Final per-1M prices the customer is billed — admin overrides are final
	* as-is, otherwise catalog base × (1 + markup/100). Display surfaces
	* (/v1/models, docs, estimates) must use this, never reimplement it.
	*/
export function userFacingFor(modelId: string, promptTokens = 0): {
	inputPer1M: number;
	outputPer1M: number;
} {
	const p = pricingForContext(getModelPricing(modelId), promptTokens);
	const factor = 1 + p.markup / 100;
	return {
		inputPer1M: p.inputPer1M * factor,
		outputPer1M: p.outputPer1M * factor,
	};
}
