// Single source of truth for the model catalog surfaced in the UI.
//
// History:
//   - Before 2026-07-02, this file held 13 hand-curated Model entries — many
//     were fabricated (e.g. "Claude Opus 4", "claude-sonnet-4", "gemini-2.5-pro",
//     "llama-3.3-70b-together"). Every page that imported MODEL_COUNT or
//     MODELS was wrong, and the model detail pages rendered make-believe
//     metadata.
//   - Now we derive Model[] from the real Venice-only catalog in
//     `server/models.json` (89 chat models). The 5 video models in
//     VIDEO_MODELS are intentionally not mixed in here — they live in
//     `app/src/app/video-generation/page.tsx`, which uses its own shape
//     (`duration`, `mode: "text-to-video" | "image-to-video"`) that does
//     not fit the LLM `Model` interface.
//
// Public API is preserved: Model interface, Capability, Provider, Tier,
// formatPricePerMillion, formatPricePerToken, getModelsByTier, MODEL_COUNT,
// MODELS, PROVIDER_COLORS, TIER_COLORS, TIER_ORDER — all still exported.

import catalogJson from "../../../server/models.json";

export type Tier = "budget" | "mid" | "premium" | "frontier";
export type Provider =
	| "Venice"
	| "AntSeed"
	| "Claude"
	| "Gemini"
	| "OpenRouter"
	| "Together";

export interface Model {
	id: string;
	name: string;
	provider: Provider;
	tier: Tier;
	description: string;
	contextLength: string;
	inputPricePer1M: number;
	outputPricePer1M: number;
	capabilities: Capability[];
	modelId: string;
}

export type Capability =
	| "reasoning"
	| "coding"
	| "multimodal"
	| "vision"
	| "fast"
	| "uncensored"
	| "agents"
	| "math"
	| "chat";

export const PROVIDER_COLORS: Record<
	Provider,
	{ bg: string; text: string; border: string }
> = {
	Venice: {
		bg: "bg-violet/20",
		text: "text-violet",
		border: "border-violet/30",
	},
	AntSeed: {
		bg: "bg-success/20",
		text: "text-success",
		border: "border-success/30",
	},
	Claude: {
		bg: "bg-warning/20",
		text: "text-warning",
		border: "border-warning/30",
	},
	Gemini: {
		bg: "bg-accent/20",
		text: "text-accent",
		border: "border-accent/30",
	},
	OpenRouter: {
		bg: "bg-text-secondary/20",
		text: "text-text-secondary",
		border: "border-text-secondary/30",
	},
	Together: {
		bg: "bg-tertiary/20",
		text: "text-tertiary",
		border: "border-tertiary/30",
	},
};

export const TIER_COLORS: Record<
	Tier,
	{ bg: string; text: string; border: string; badge: string }
> = {
	budget: {
		bg: "bg-warning/10",
		text: "text-warning",
		border: "border-warning/30",
		badge: "bg-warning/20 text-warning",
	},
	mid: {
		bg: "bg-accent/10",
		text: "text-accent",
		border: "border-accent/30",
		badge: "bg-accent/20 text-accent",
	},
	premium: {
		bg: "bg-violet/10",
		text: "text-violet",
		border: "border-violet/30",
		badge: "bg-violet/20 text-violet",
	},
	frontier: {
		bg: "bg-violet/10",
		text: "text-violet",
		border: "border-violet/30",
		badge: "bg-violet/20 text-violet",
	},
};

export const TIER_ORDER: Tier[] = ["budget", "mid", "premium", "frontier"];

// ---------------------------------------------------------------------------
// Catalog ingestion
// ---------------------------------------------------------------------------
//
// `server/models.json` is the upstream source of truth. It is typed at
// import time via a local interface so TypeScript catches structural drift
// when the server bumps the catalog. We map each entry to the public `Model`
// shape at module-load time — no runtime fetch, no per-render work.

interface RawCatalog {
	MODEL_CATALOG: Record<
		string,
		{
			id: string;
			veniceId?: string;
			provider: string;
			primaryProvider?: string;
			inputPricePer1M: number;
			outputPricePer1M: number;
			markupPercent?: number;
			category: Tier | string;
			maxTokens: number;
			supportsStreaming?: boolean;
			displayName: string;
			capabilities: string[];
			description?: string;
			creditsPerMillionInput?: number;
			creditsPerMillionOutput?: number;
		}
	>;
	VIDEO_MODELS?: Record<string, unknown>;
}

const CATALOG = (catalogJson as RawCatalog).MODEL_CATALOG;

/** Format `maxTokens` (raw integer) as a short human string: "4K", "128K", "1M". */
function formatContextLength(maxTokens: number): string {
	if (!Number.isFinite(maxTokens) || maxTokens <= 0) return "—";
	if (maxTokens >= 1_000_000) {
		const m = maxTokens / 1_000_000;
		// 1.28M-style numbers look cleaner as "1.3M" only when they need to —
		// round to nearest 0.1M and trim trailing zeros.
		const rounded = Math.round(m * 10) / 10;
		return `${rounded}M`;
	}
	const k = Math.round(maxTokens / 1000);
	return `${k}K`;
}

/**
 * Map the server catalog's capability strings onto the public `Capability`
 * union. Unknown server-side capabilities (e.g. `tools`, `function-calling`,
 * `web-search`) are mapped onto the closest TS-side concept and dropped if
 * there is no analogue — this keeps the public API stable while still
 * preserving every signal the upstream catalog carries.
 *
 * Inferences that the server doesn't tag explicitly:
 *   - `uncensored` — id or description mentions "uncensored" / "heretic"
 *     (covers Venice's `venice-uncensored-*`, `gemma-4-uncensored`,
 *     `e2ee-...-uncensored-p`, and the Heretic GLM variant).
 *   - `coding` — id mentions "coder" or "codex" (covers Qwen Coder and
 *     the GPT-codex variants).
 */
function deriveCapabilities(
	id: string,
	displayName: string,
	description: string | undefined,
	serverCaps: readonly string[] | undefined,
): Capability[] {
	const out = new Set<Capability>();
	const capSet = new Set((serverCaps ?? []).map((c) => c.toLowerCase()));
	const haystack = `${id} ${displayName} ${description ?? ""}`.toLowerCase();

	// Every entry in the chat catalog is a chat model — confirm before assuming.
	if (capSet.has("chat") || serverCaps === undefined || serverCaps.length === 0) {
		out.add("chat");
	}

	if (capSet.has("reasoning")) out.add("reasoning");
	if (capSet.has("vision")) out.add("vision");
	if (capSet.has("video-input") || capSet.has("audio-input")) out.add("multimodal");
	if (capSet.has("tools") || capSet.has("function-calling")) out.add("agents");

	// Heuristic flags — derived, not declared by the server.
	if (/uncensored|heretic/.test(haystack)) out.add("uncensored");
	if (/(?:^|[-_/])coder(?:[-_/]|$)|codex/.test(id.toLowerCase())) out.add("coding");

	return [...out];
}

/**
 * Build a fallback description when the server entry omits one (llama-3.x
 * entries ship with empty strings today). We never want a blank card.
 */
function deriveDescription(
	id: string,
	displayName: string,
	description: string | undefined,
): string {
	const trimmed = (description ?? "").trim();
	if (trimmed) return trimmed;
	// Strip provider prefix from id for a cleaner fallback label
	// (e.g. "llama-3.3-70b" → "Llama 3.3 70B", not "Llama Llama 3.3 70B").
	const cleaned = id.replace(/^(openai|minimax|together|deepinfra)\//i, "");
	const titleCase = cleaned
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
	return `${titleCase || displayName} — language model served by OMA.`;
}

/**
 * Build a single `Model` entry from the upstream JSON. Defensive against
 * future server-side schema drift — a missing or unknown tier falls back
 * to `"mid"` rather than dropping the model from the catalog.
 */
function toModel(entry: RawCatalog["MODEL_CATALOG"][string]): Model {
	const tier: Tier =
		entry.category === "budget" ||
		entry.category === "mid" ||
		entry.category === "premium" ||
		entry.category === "frontier"
			? entry.category
			: "mid";

	return {
		id: entry.id,
		name: entry.displayName,
		// Server catalog is 100% Venice today. Keep the capitalisation that
		// consumers (pricing page VENDOR_DISPLAY, capabilities-grid, badge
		// colour map) expect.
		provider: "Venice",
		tier,
		description: deriveDescription(entry.id, entry.displayName, entry.description),
		contextLength: formatContextLength(entry.maxTokens),
		inputPricePer1M: entry.inputPricePer1M,
		outputPricePer1M: entry.outputPricePer1M,
		capabilities: deriveCapabilities(
			entry.id,
			entry.displayName,
			entry.description,
			entry.capabilities,
		),
		modelId: entry.veniceId ?? entry.id,
	};
}

/**
 * The full static catalog surfaced in the UI. Generated from
 * `server/models.json` at module load — no fetch, no async, no per-render
 * work. Length is therefore guaranteed equal to `Object.keys(MODEL_CATALOG)`
 * in the upstream file (89 entries today).
 */
export const MODELS: Model[] = Object.values(CATALOG).map(toModel);

/**
 * Format a price-per-1M-tokens value for display.
 *
 * BUGFIX (2026-07-02): the previous version divided the per-1M input by 1_000_000
 * to derive a per-token rate, but the input is already per-1M — so every model
 * returned "$0.00" (the smallest per-1M rate, $0.06/M, becomes $6e-8 per token
 * which is below the 0.00001 floor). Screen readers heard "Input $0.00 per token"
 * which falsely advertised the API as free. This function now formats the
 * per-1M rate directly.
 */
export function formatPricePerMillion(pricePer1M: number): string {
	if (pricePer1M === 0) return "$0";
	if (pricePer1M < 0.01) return `$${pricePer1M.toFixed(4)}`;
	if (pricePer1M < 1) return `$${pricePer1M.toFixed(3)}`;
	return `$${pricePer1M.toFixed(2)}`;
}

/** @deprecated use formatPricePerMillion — kept as alias for back-compat. */
export const formatPricePerToken = formatPricePerMillion;

export function getModelsByTier(models: Model[]): Record<Tier, Model[]> {
	const grouped: Record<Tier, Model[]> = {
		budget: [],
		mid: [],
		premium: [],
		frontier: [],
	};
	for (const model of models) {
		grouped[model.tier].push(model);
	}
	return grouped;
}

export const MODEL_COUNT = MODELS.length;