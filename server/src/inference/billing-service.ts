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
import type { PricingWithCosts } from "./pricing-costs.js";
import {
		readModelPricingOverrides,
		type ModelPricingOverride,
} from "../lib/model-overrides.js";

export type ModelPricing = PricingWithCosts;

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
	const override = getOverrides()[modelId] ?? (m.retailPricing ? { inputPricePer1M: m.retailPricing.inputPer1M, outputPricePer1M: m.retailPricing.outputPer1M } : undefined);
	if (override) {
		return {
			inputPer1M: override.inputPricePer1M,
			outputPer1M: override.outputPricePer1M,
			markup: 0,
			upstream: { inputPer1M: m.inputPricePer1M, outputPer1M: m.outputPricePer1M, ...(m.extendedPricing ? { extended: m.extendedPricing } : {}) },
		};
	}
	return {
		inputPer1M: m.inputPricePer1M,
		outputPer1M: m.outputPricePer1M,
		markup: m.markupPercent,
		...(m.extendedPricing ? { extended: m.extendedPricing } : {}),
	};
}

/**
	* Final per-1M prices the customer is billed — admin overrides are final
	* as-is, otherwise catalog base × (1 + markup/100). Display surfaces
	* (/v1/models, docs, estimates) must use this, never reimplement it.
	*/
export function userFacingFor(modelId: string): {
	inputPer1M: number;
	outputPer1M: number;
	extended?: { threshold: number; inputPer1M: number; outputPer1M: number };
} {
	const p = getModelPricing(modelId);
	const factor = 1 + p.markup / 100;
	return {
		inputPer1M: p.inputPer1M * factor,
		outputPer1M: p.outputPer1M * factor,
		...(p.extended ? { extended: { threshold: p.extended.threshold, inputPer1M: p.extended.inputPer1M * factor, outputPer1M: p.extended.outputPer1M * factor } } : {}),
	};
}
