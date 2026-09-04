/**
	* Inference model catalog — curated best-in-class chat + multimodal LLMs.
	*
	* Round 8 cleanup (2026-08-14): image and video generation arrays
	* (IMAGE_MODELS, VIDEO_MODELS) deleted entirely. OMA sells text +
	* multimodal LLM inference only. /v1/images/* and /v1/videos/* routes
	* were already removed in R7; this pass removes the dead catalog
	* arrays and the modality/creditsPerGeneration fields from ModelDef.
	*
	* Round 8 procurement layer: Surplus Intelligence
	* (api.surplusintelligence.ai) is a *hidden procurement fallback*,
	* not a user-visible provider. Users always see "venice" or "oma-ai"
	* labels. When the primary upstream fails (5xx, rate limit, network,
	* missing API key) AND the model has a `surplusId` AND SURPLUS_API_KEY
	* is configured, the router transparently retries via Surplus using
	* its native model id (e.g. "claude-opus-5", "deepseek-v4-pro"). The
	* customer is billed the same price — Surplus is internal margin.
	*
	* Surplus IDs in this file come from the live GET
	* https://api.surplusintelligence.ai/v1/models snapshot (377 models,
	* 172 text-capable, fetched 2026-08-14). Only models with a clear
	* upstream match are mapped. Where the upstream id differs (Venice's
	* `zai-org-glm-5-2` vs Surplus's `glm-5.2`), we set `surplusId` to
	* the *exact* Surplus id — never fabricate.
	*
	* SECURITY/TRUST: Surplus does not provide cryptographic proof a
	* seller served the claimed model, and public reputation/quality
	* scoring is "planned but not live". The 94–98% discounts they
	* advertise may be offloaded or trial credits that violate upstream
	* providers' ToS. Surplus is opt-in: leave SURPLUS_API_KEY unset and
	* Surplus is never selected for traffic. See the comment block above
	* for the full risk writeup.
	*
	* NOTE: `deepseek-v4-flash-openbroker` is owned by the OMA-AI provider —
	* it is the app's default free website-chat model. The user-facing id
	* and displayName stay "Gemini 3 Flash", but Gonka/OpenBroker carries
	* no Gemini model, so it routes to DeepSeek V4 Flash via omaAiId.
	* Don't add a Venice entry under the same id or it will shadow the
	* free route and break anonymous website chat (401 on free model).
	*
	* Add a new provider by extending `resolveProvider()` in
	* provider-route.ts and adding matching entries here.
	*/
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export interface ModelDef {
		id: string;
		provider: string;
		inputPricePer1M: number;
		outputPricePer1M: number;
		markupPercent: number;
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
		/**
			* Surplus Intelligence marketplace id, used as a fallback procurement
			* route. INVISIBLE to users — the catalog entry's `provider` field
			* stays "venice" or "oma-ai". Mapped from the live Surplus catalog.
			*/
		surplusId?: string;
}

let _catalog: ModelDef[] | null = null;

// ---------------------------------------------------------------------------
// Curated catalog — best models per tier.
//
// Venice pricing source: live GET api.venice.ai/api/v1/models (2026-08-04)
// OMA-AI/OpenBroker: free-tier user prices; context 128k product cap
// (upstream does not publish per-model limits on the broker API).
//
// Prices stored here are *upstream base* (what OMA pays Venice/OMA-AI).
// billing-service.ts applies markupPercent at checkout:
//   user_cost = base * (1 + markupPercent/100)
//
// For Venice models markupPercent = 25 (OMA's platform margin).
// For OMA-AI models markupPercent = 0 (margin already in the low price).
// ---------------------------------------------------------------------------

const VENICE_MODELS: ModelDef[] = [
		// ── Frontier ──────────────────────────────────────────────────────────

		{
				id: "openai-gpt-56-sol",
				provider: "venice",
				surplusId: "gpt-5.6-sol",
				inputPricePer1M: 16.0,
				outputPricePer1M: 95.0,
				markupPercent: 25,
				displayName: "GPT-5.6 Sol",
				category: "frontier",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		{
				id: "claude-opus-5",
				provider: "venice",
				surplusId: "claude-opus-5",
				inputPricePer1M: 15.0,
				outputPricePer1M: 75.0,
				markupPercent: 25,
				displayName: "Claude Opus 5",
				category: "frontier",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},

		// ── Premium ───────────────────────────────────────────────────────────


		{
				id: "kimi-k3",
				provider: "venice",
				surplusId: "kimi-k3",
				inputPricePer1M: 9.5,
				outputPricePer1M: 45.0,
				markupPercent: 25,
				displayName: "Kimi K3",
				category: "premium",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "tools"],
		},


		{
				id: "zai-org-glm-5-2",
				provider: "venice",
				surplusId: "glm-5.2",
				inputPricePer1M: 3.5,
				outputPricePer1M: 11.0,
				markupPercent: 25,
				displayName: "GLM 5.2",
				category: "premium",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "tools"],
		},
		{
				id: "deepseek-v4-pro",
				provider: "venice",
				surplusId: "deepseek-v4-pro",
				inputPricePer1M: 4.5,
				outputPricePer1M: 8.0,
				markupPercent: 25,
				displayName: "DeepSeek V4 Pro",
				category: "premium",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		{
				id: "qwen-3-8-max",
				provider: "venice",
				surplusId: "qwen-3-8-max",
				inputPricePer1M: 6.25,
				outputPricePer1M: 19.0,
				markupPercent: 25,
				displayName: "Qwen 3.8 Max",
				category: "premium",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		{
				id: "grok-4-5",
				provider: "venice",
				surplusId: "grok-4.5",
				inputPricePer1M: 5.75,
				outputPricePer1M: 17.0,
				markupPercent: 25,
				displayName: "Grok 4.5",
				category: "premium",
				maxTokens: 16384,
				contextWindow: 500_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		{
				id: "claude-sonnet-4-6",
				provider: "venice",
				surplusId: "claude-sonnet-4.6",
				inputPricePer1M: 9.0,
				outputPricePer1M: 45.0,
				markupPercent: 25,
				displayName: "Claude Sonnet 4.6",
				category: "premium",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		{
				id: "gemini-3-6-flash",
				provider: "venice",
				surplusId: "gemini-3.7-flash",
				inputPricePer1M: 4.75,
				outputPricePer1M: 23.0,
				markupPercent: 25,
				displayName: "Gemini 3.6 Flash",
				category: "premium",
				maxTokens: 65536,
				contextWindow: 1_000_000,
				maxOutputTokens: 65536,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools", "vision"],
		},

		// ── Mid ───────────────────────────────────────────────────────────────

		{
				id: "llama-3.3-70b",
				provider: "venice",
				surplusId: "llama-3.3-70b-instruct",
				inputPricePer1M: 2.0,
				outputPricePer1M: 7.0,
				markupPercent: 25,
				displayName: "Llama 3.3 70B",
				category: "mid",
				maxTokens: 8192,
				contextWindow: 128_000,
				maxOutputTokens: 8192,
				supportsStreaming: true,
				capabilities: ["chat", "tools"],
		},
		{
				id: "hermes-3-llama-3.1-405b",
				provider: "venice",
				surplusId: "hermes-3-llama-3.1-405b",
				inputPricePer1M: 2.85,
				outputPricePer1M: 7.5,
				markupPercent: 25,
				displayName: "Hermes 3 405B",
				category: "mid",
				maxTokens: 8192,
				contextWindow: 128_000,
				maxOutputTokens: 8192,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "tools"],
		},
		{
				id: "zai-org-glm-5-1",
				provider: "venice",
				surplusId: "glm-5.1",
				inputPricePer1M: 4.0,
				outputPricePer1M: 12.0,
				markupPercent: 25,
				displayName: "GLM 5.1",
				category: "mid",
				maxTokens: 16384,
				contextWindow: 200_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "tools"],
		},
		{
				id: "qwen-3-7-plus",
				provider: "venice",
				surplusId: "qwen-3-7-plus",
				inputPricePer1M: 1.6,
				outputPricePer1M: 5.0,
				markupPercent: 25,
				displayName: "Qwen 3.7 Plus",
				category: "mid",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "tools"],
		},
		{
				id: "venice-uncensored-1-2",
				provider: "venice",
				surplusId: "venice-uncensored",
				inputPricePer1M: 0.65,
				outputPricePer1M: 2.5,
				markupPercent: 25,
				displayName: "Venice Uncensored 1.2",
				category: "mid",
				maxTokens: 8192,
				contextWindow: 128_000,
				maxOutputTokens: 8192,
				supportsStreaming: true,
				capabilities: ["chat", "uncensored"],
		},

		// ── Budget ────────────────────────────────────────────────────────────


		{
				id: "xiaomi-mimo-v2-5",
				provider: "venice",
				inputPricePer1M: 1.1,
				outputPricePer1M: 5.0,
				markupPercent: 25,
				displayName: "Xiaomi MiMo V2.5",
				category: "budget",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "fast"],
		},
		{
				id: "deepseek-v4-flash-0731",
				provider: "venice",
				surplusId: "deepseek-v4-flash",
				inputPricePer1M: 0.45,
				outputPricePer1M: 1.0,
				markupPercent: 25,
				displayName: "DeepSeek V4 Flash",
				category: "budget",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "fast"],
		},
		{
				id: "mistral-small-2603",
				provider: "venice",
				surplusId: "mistral-small-4",
				inputPricePer1M: 0.6,
				outputPricePer1M: 2.0,
				markupPercent: 25,
				displayName: "Mistral Small 4",
				category: "budget",
				maxTokens: 16384,
				contextWindow: 256_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "tools", "fast"],
		},
		{
				id: "google-gemma-4-31b-it",
				provider: "venice",
				inputPricePer1M: 0.35,
				outputPricePer1M: 1.0,
				markupPercent: 25,
				displayName: "Gemma 4 31B",
				category: "budget",
				maxTokens: 16384,
				contextWindow: 256_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "fast"],
		},

];

// ── OMA-AI Resale — branded "oma-ai", backed by OpenBroker (Gonka network) ──
// (Zyloo was previously a sister upstream; removed 2026-08-17. Models that
//  were implicit-zyloo — gemini-3.1-pro-preview, gpt-4.1, gpt-4o,
//  qwen3-235b-a22b-openbroker — were deleted since OpenBroker does not
//  carry them.)
const OMA_AI_MODELS: ModelDef[] = [
		// ── OpenBroker upstream (api.openbroker.gonka.gg) ─────────────────

		{
				// Default free website-chat model. Backed by DeepSeek V4 Flash
				// on the OMA-AI / Gonka.AI network — that upstream is verified
				// live on api.openbroker.gonka.gg/v1/models. The id and display
				// name are truthful to the actual upstream.
				//
				// API-key callers are billed the listed price; only the public
				// /chat path uses this for free (see free-website-model.ts).
				// Don't add a Venice entry under the same id or it will shadow
				// the free route and break anonymous website chat (401 on free).
				id: "deepseek-v4-flash-openbroker",
				provider: "oma-ai",
				upstream: "openbroker",
				omaAiId: "deepseek-ai/DeepSeek-V4-Flash-0731",
				surplusId: "deepseek-v4-flash-0731",
				inputPricePer1M: 0.5,
				outputPricePer1M: 3.0,
				markupPercent: 0,
				displayName: "DeepSeek V4 Flash",
				category: "mid",
				maxTokens: 8192,
				contextWindow: 1_000_000,
				maxOutputTokens: 8192,
				supportsStreaming: true,
				capabilities: ["chat", "fast", "tools"],
		},
		{
				id: "kimi-k2-6",
				provider: "oma-ai",
				upstream: "openbroker",
				omaAiId: "moonshotai/Kimi-K2.6",
				surplusId: "kimi-k2.6",
				inputPricePer1M: 2.0, // Updated for margin
				outputPricePer1M: 7.0, // Updated for margin
				markupPercent: 0,
				displayName: "Kimi K2.6",
				category: "premium",
				maxTokens: 16384,
				contextWindow: 128_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		{
				id: "minimax-m2-7",
				provider: "oma-ai",
				upstream: "openbroker",
				omaAiId: "MiniMaxAI/MiniMax-M2.7",
				surplusId: "minimax-m2.7",
				inputPricePer1M: 1.25, // Updated for margin
				outputPricePer1M: 4.0, // Updated for margin
				markupPercent: 0,
				displayName: "MiniMax M2.7",
				category: "budget",
				maxTokens: 16384,
				contextWindow: 128_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		{
				// DeepSeek V4 Flash via Gonka OpenBroker — verified live on
				// api.openbroker.gonka.gg (upstream id deepseek-ai/DeepSeek-V4-Flash-0731).
				// Kept as a separate catalog entry from the primary
				// `deepseek-v4-flash-openbroker` (same upstream) for
				// OpenRouter-style client fallback chains; both routes bill
				// the same price.
				id: "deepseek-v4-flash-0731-openbroker",
				provider: "oma-ai",
				upstream: "openbroker",
				omaAiId: "deepseek-ai/DeepSeek-V4-Flash-0731",
				surplusId: "deepseek-v4-flash-0731",
				inputPricePer1M: 0.5,
				outputPricePer1M: 3.0,
				markupPercent: 0,
				displayName: "DeepSeek V4 Flash (direct)",
				category: "budget",
				maxTokens: 16384,
				contextWindow: 1_000_000,
				maxOutputTokens: 16384,
				supportsStreaming: true,
				capabilities: ["chat", "reasoning", "fast", "tools"],
		},
		];

function defaultCatalog(): ModelDef[] {
		return [...VENICE_MODELS, ...OMA_AI_MODELS];
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

/**
	* User-facing per-1M prices — what the customer is actually billed.
	* catalog base * (1 + markupPercent/100). Use these in any surface that
	* shows prices to users (/v1/models, docs, cost estimates) so displayed
	* prices always match billing.
	*/
export function userFacingPrices(m: ModelDef): {
		inputPer1M: number;
		outputPer1M: number;
} {
		const factor = 1 + m.markupPercent / 100;
		return {
				inputPer1M: m.inputPricePer1M * factor,
				outputPer1M: m.outputPricePer1M * factor,
		};
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
	if (m.provider === "litellm") return isConfiguredKey(config.LITELLM_API_KEY);
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
