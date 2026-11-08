/**
 * Curated model definitions shared with the website's SSR fallback.
 * Retail Gonka prices are fixed in USD; its GNK procurement cost is unknown.
 * Venice catalog prices and long-context tiers were verified 2026-10-10.
 * Provider IDs remain internal routing targets; clients use the public IDs.
 */
import { logger } from "../lib/logger.js";
import catalogData from "./model-catalog.json" with { type: "json" };
import { modelAvailability } from "./model-availability.js";
import {
	MODEL_METADATA_VERIFICATION,
	parseModelMetadataVerification,
	type ModelMetadataVerification,
	type ModelPrivacy,
} from "./model-metadata.js";

export interface ModelDef {
		description?: string;
		id: string;
		provider: string;
		privacy?: ModelPrivacy;
		inputModalities?: string[];
		outputModalities?: string[];
		metadataVerification?: {
		status: ModelMetadataVerification;
		sourceUrl: string;
		verifiedAt: string;
		note: string;
	};
		inputPricePer1M: number;
		outputPricePer1M: number;
		markupPercent: number;
		customerInputPricePer1M?: number;
		customerOutputPricePer1M?: number;
		upstreamCostKnown?: boolean;
		/** Temporarily pause a model after confirmed upstream quality failures. */
		disabledReason?: string;
		extendedPricing?: { contextTokenThreshold: number; inputPricePer1M: number; outputPricePer1M: number };
		displayName: string;
		category: "budget" | "mid" | "premium" | "frontier";
		maxTokens: number;
		contextWindow?: number;
		maxOutputTokens?: number;
		supportsStreaming: boolean;
		capabilities: string[];
		veniceId?: string;
		omaAiId?: string;
		/**
		 * Resale upstream backing an "oma-ai" model. Only "openbroker" is supported
		 * (Zyloo was removed 2026-08-17). Models without this field are no longer
		 * routable — every live oma-ai entry must declare this explicitly.
		 */
		upstream?: "openbroker";
}

let _catalog: ModelDef[] | null = null;

/** Shared with the frontend fallback; upstream prices verified 2026-10-10. */
function defaultCatalog(): ModelDef[] {
	const catalog = catalogData as ModelDef[];
	// The catalog is authored in-repo but loaded through a cast, so a typo in
	// a verification status would otherwise publish itself as verified.
	// Unknown values are demoted to "unverified" and logged loudly: the safe
	// direction is "we did not verify this", never "we did".
	return catalog.map((model) => {
		if (!model.metadataVerification) return model;
		const status = parseModelMetadataVerification(model.metadataVerification.status);
		if (status === model.metadataVerification.status) return model;
		logger.error(
			{ modelId: model.id, status: model.metadataVerification.status },
			"[models] unknown metadata verification status; treating as unverified",
		);
		return {
			...model,
			metadataVerification: {
				...model.metadataVerification,
				status: MODEL_METADATA_VERIFICATION.Unverified,
			},
		};
	});
}

export async function ensureCatalogLoaded(): Promise<void> {
		if (_catalog) return;
		_catalog = defaultCatalog();
		logger.info({ count: _catalog.length }, "[models] loaded curated catalog");
}

export function listAllModels(): ModelDef[] {
		if (!_catalog) {
				_catalog = defaultCatalog();
		}
		return _catalog;
}

export function getModelById(id: string): ModelDef | undefined {
		return listAllModels().find((m) => m.id === id);
}

/** Whether the model's backing provider is configured. */
export function providerAvailable(m: ModelDef): boolean {
	return modelAvailability(m).available;
}
