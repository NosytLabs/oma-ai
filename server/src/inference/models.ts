/** Shared curated catalog. Rates are estimates before markup; see docs/pricing-and-treasury.md. */
import catalog from './model-catalog.json' with { type: 'json' };
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
export interface ModelDef {
		id: string;
 disabledReason?: string;
 retailPricing?: { inputPer1M: number; outputPer1M: number };
 extendedPricing?: { threshold: number; inputPer1M: number; outputPer1M: number };
 costBasis?: { currency: string; usdPerGnk: number; ngonkaPerToken: number; attemptFactor: number; checkedAt: string; source: string };
		provider: string;
		inputPricePer1M: number;
		outputPricePer1M: number;
		markupPercent: number;
		displayName: string;
	description?: string;
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
		/**
			* Surplus Intelligence marketplace id, used as a fallback procurement
			* route. INVISIBLE to users — the catalog entry's `provider` field
			* stays "venice" or "oma-ai". Mapped from the live Surplus catalog.
			*/
		surplusId?: string;
}


let _catalog: ModelDef[] | null = null;
function defaultCatalog(): ModelDef[] { return catalog as ModelDef[]; }
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

/**
	* Whether a model's backing provider has a configured API key. Venice
	* models report unavailable when VENICE_API_KEY is missing or a known
	* placeholder so clients can grey them out instead of surfacing a raw
	* upstream 401. OMA-AI models check their specific upstream key.
	* Surplus is invisible — it never gates a model's availability (the
	* primary Venice/OMA-AI upstream does). Surplus only kicks in as a
	* fallback inside the router when the primary upstream fails.
	*/
export function providerAvailable(m: ModelDef): boolean {
	if (m.disabledReason) return false;
	if (m.provider === "venice") return isConfiguredKey(config.VENICE_API_KEY);
	if (m.provider === "oma-ai") {
		// Only "openbroker" upstream remains after Zyloo removal (2026-08-17).
		return isConfiguredKey(config.OPENBROKER_API_KEY);
	}
	return false;
}

function isConfiguredKey(key: string | undefined): boolean {
		if (!key || key.length < 16) return false;
		if (/placeholder|changeme|your-key|example/i.test(key)) return false;
		// Only reject obvious dummy prefixes — real Venice keys start with VENICE_.
		if (/^(plch-|your-|dev-)/i.test(key)) return false;
		if (/^(openbroker_|surplus_)(placeh|changeme|your|xxx|dummy)/i.test(key)) {
				return false;
		}
		return true;
}
