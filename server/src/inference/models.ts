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
* NOTE: `deepseek-v4-flash-0731-openbroker` is the default free
 * website-chat model. It is backed by `deepseek-ai/DeepSeek-V4-Flash-0731`
 * on the OpenBroker / Gonka.AI upstream — verified live against
 * api.openbroker.gonka.gg/v1/models. Don't add a Venice entry under
 * the same id or it will shadow the free route and break anonymous
 * website chat (401 on free model).
 *
 * API-token callers (Authorization: Bearer oma_sk_*) ALWAYS pay real
 * credits for these models; free usage is restricted to the public
 * /chat page for signed-out visitors only.
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
		/** Generic OpenAI-compatible upstream model id (used by the `litellm`
		 *  provider, e.g. NVIDIA API, LiteLLM proxy). When set, it overrides
		 *  `veniceId`/`id` as the `model` sent upstream for litellm-routed models. */
		litellmId?: string;
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
// Venice pricing source: live GET api.venice.ai/api/v1/models (2026-09-04)
// Base prices track Venice wholesale; user-facing = base x 1.25 markup.
// OMA-AI/OpenBroker: base = live gonkabroker.com rates (verified 2026-09-04):
//   Kimi K2.6 256K (262,144 tok)  $0.35 / M tokens  (in == out)
//   MiniMax M2.7 200K            $0.30 / M tokens  (in == out)
//   DeepSeek V4 Flash 400K       $0.25 / M tokens  (in == out)
//   GLM-5.3 Flash 1M (Z.ai list) $0.15 in / $0.50 out (added 2026-09-24)
// user-facing = base * (1 + markupPercent/100). OMA-AI markupPercent = 100
// OpenBroker's live /v1/models serves THREE ids (MiniMaxAI/MiniMax-M2.7,
// deepseek-ai/DeepSeek-V4-Flash-0731, zai-org/GLM-5.3-Flash); all three are
// curated below as `minimax-m2-7`, `deepseek-v4-flash-0731-openbroker`, and
// `zai-org-glm-5-3` (GLM price = Z.ai official list, verified 2026-09-24).
//
// Prices stored here are *upstream base* (what OMA pays Venice/OMA-AI).
// billing-service.ts applies markupPercent at checkout:
//   user_cost = base * (1 + markupPercent/100)
//
// For Venice models markupPercent = 25 (OMA's platform margin).
// For OMA-AI models markupPercent = 100 (2x Gonka wholesale — base prices
// below are the live upstream rates, so displayed prices stay honest).
// ---------------------------------------------------------------------------

const VENICE_MODELS: ModelDef[] = [
		// ── Frontier ──────────────────────────────────────────────────────────

		{
				id: "openai-gpt-56-sol",
				provider: "venice",
				surplusId: "gpt-5.6-sol",
			inputPricePer1M: 6.25,
			outputPricePer1M: 37.5,
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
			inputPricePer1M: 6.0,
			outputPricePer1M: 30.0,
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
			inputPricePer1M: 3.75,
			outputPricePer1M: 18.75,
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
			inputPricePer1M: 1.4,
			outputPricePer1M: 4.4,
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
			inputPricePer1M: 1.65,
			outputPricePer1M: 3.301,
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
			inputPricePer1M: 2.5,
			outputPricePer1M: 7.5,
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
			inputPricePer1M: 2.27,
			outputPricePer1M: 6.8,
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
			inputPricePer1M: 3.6,
			outputPricePer1M: 18.0,
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
			inputPricePer1M: 0.9375,
			outputPricePer1M: 4.6875,
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
			inputPricePer1M: 0.7,
			outputPricePer1M: 2.8,
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
			inputPricePer1M: 1.1,
			outputPricePer1M: 3.0,
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
			inputPricePer1M: 1.54,
			outputPricePer1M: 4.84,
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
			inputPricePer1M: 0.5,
			outputPricePer1M: 2.0,
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
			inputPricePer1M: 0.2,
			outputPricePer1M: 0.9,
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
			inputPricePer1M: 0.4,
			outputPricePer1M: 2.0,
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
			inputPricePer1M: 0.175,
			outputPricePer1M: 0.35,
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
			// Venice has no `mistral-small-2603`; its live catalog carries
			// `mistral-small-3-2-24b-instruct`. The public id stays stable for
			// API consumers and the Venice route sends this override upstream.
			veniceId: "mistral-small-3-2-24b-instruct",
			surplusId: "mistral-small-4",
			inputPricePer1M: 0.1875,
			outputPricePer1M: 0.75,
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
			inputPricePer1M: 0.12,
			outputPricePer1M: 0.36,
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
// Verified live against api.openbroker.gonka.gg/v1/models in September 2026:
// the upstream catalog serves THREE models — MiniMax M2.7, DeepSeek V4 Flash,
// and GLM-5.3 Flash — and all three are curated below. GLM-5.3 pricing uses
// Z.ai's published list price because OpenBroker's model endpoint exposes ids
// but not price fields. Re-verify the upstream catalog and price source before
// changing this list.
//
// 2026-09-26 re-verification: the catalog rotated again. Kimi-K2.6 and
// Qwen3-235B are gone; DeepSeek V4 Flash and GLM-5.3 Flash are the additions.
// Of the three, ONLY DeepSeek actually serves inference — M2.7 and GLM-5.3
// return a fast sticky 503. Those two are marked `upstream: undefined` (the
// non-routable marker) with the evidence inline, so the free fallback chain
// stops burning quota on them. DeepSeek remains the sole openbroker route and
// is the default free website-chat model.
const OMA_AI_MODELS: ModelDef[] = [
	{
			id: "minimax-m2-7",
			provider: "oma-ai",
			// NOT ROUTABLE — 2026-09-26. OpenBroker lists this id in /v1/models
			// but POST /v1/chat/completions returns a fast, sticky
			// 503 {"message":"model ... is temporarily unavailable"} (8/8 across
			// 4s-spaced retries — not congestion, not 429 rate limiting).
			// Across a 300-request usage window it burned 15 requests at 60%
			// failure and produced 0.000 GNK, because failed rows settle at
			// zero cost: pure quota and latency, no output.
			//
			// Dropping `upstream` is what makes a ModelDef non-routable
			// (see buildFallbackChain). Re-enable only after a live POST
			// returns 200 with real content — not just a 200 with empty body.
			upstream: undefined,
			omaAiId: "MiniMaxAI/MiniMax-M2.7",
			surplusId: "minimax-m2.7",
			inputPricePer1M: 0.30,
			outputPricePer1M: 0.30,
			markupPercent: 100,
			displayName: "MiniMax M2.7",
			category: "budget",
			maxTokens: 16384,
			contextWindow: 200_000,
			maxOutputTokens: 16384,
			supportsStreaming: true,
			capabilities: ["chat", "reasoning", "coding", "tools"],
	},
	{
			// Default free website-chat model. Backed by DeepSeek V4 Flash
			// on the OMA-AI / Gonka.AI network — verified live on
			// api.openbroker.gonka.gg/v1/models 2026-09-05.
			//
			// API-token callers (Authorization: Bearer *** ALWAYS pay
			// real credits for this; only the public /chat path is free
			// (see free-website-model.ts).
			//
			// Don't add a Venice entry under the same id or it will shadow
			// the free route and break anonymous website chat (401 on free).
			id: "deepseek-v4-flash-0731-openbroker",
			provider: "oma-ai",
			upstream: "openbroker",
			omaAiId: "deepseek-ai/DeepSeek-V4-Flash-0731",
			surplusId: "deepseek-v4-flash-0731",
			inputPricePer1M: 0.25,
			outputPricePer1M: 0.25,
			markupPercent: 100,
			displayName: "DeepSeek V4 Flash (OMA-AI)",
			category: "budget",
			maxTokens: 16384,
			contextWindow: 400_000,
			maxOutputTokens: 16384,
			supportsStreaming: true,
			capabilities: ["chat", "reasoning", "fast", "tools"],
	},
	{
			// The third model served by api.openbroker.gonka.gg.
			// Base = Z.ai official list: $0.15 in / $0.50 out per 1M
			// (the 50% launch promo ended 2026-09-09; list stands).
			// User-facing = base × 2 (markupPercent 100), matching the
			// other OMA-AI resale entries.
			id: "zai-org-glm-5-3",
			provider: "oma-ai",
			// NOT ROUTABLE — 2026-09-26. Same failure as minimax-m2-7 above:
			// listed in OpenBroker's /v1/models, but inference returns a fast,
			// sticky 503 "temporarily unavailable" (8/8, 4s-spaced). 27 requests
			// at 66.7% failure, 0.000 GNK produced. gonka-tool-proxy already
			// injects thinking-disabled params for this model, so the 503 is
			// upstream capacity, not a local serialization problem.
			upstream: undefined,
			omaAiId: "zai-org/GLM-5.3-Flash",
			surplusId: "zai-org/glm-5.3-flash",
			inputPricePer1M: 0.15,
			outputPricePer1M: 0.50,
			markupPercent: 100,
			displayName: "GLM-5.3 Flash (OMA-AI)",
			category: "budget",
			maxTokens: 16384,
			contextWindow: 1_000_000,
			maxOutputTokens: 128_000,
			supportsStreaming: true,
			capabilities: ["chat", "reasoning", "fast", "tools", "multimodal"],
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
