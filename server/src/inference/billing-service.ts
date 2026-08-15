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
	if (override) {
		return {
			inputPer1M: override.inputPricePer1M,
			outputPer1M: override.outputPricePer1M,
			markup: 0,
		};
	}
	return {
		inputPer1M: m.inputPricePer1M,
		outputPer1M: m.outputPricePer1M,
		markup: m.markupPercent,
	};
}
