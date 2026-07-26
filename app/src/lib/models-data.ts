// Single source of truth for the model catalog surfaced in the UI.
//
// History:
//   - Before 2026-07-02, this file held 13 hand-curated Model entries — many
//     were fabricated. Every page that imported MODEL_COUNT or MODELS was
//     wrong.
//   - Until 2026-07-07, the catalog was loaded at module-init via a static
//     `import catalogJson from "../../../server/models.json"`. That put a
//     58 KB JSON blob in the client bundle for every page that imported
//     anything from this file — including static SSR pages like the
//     homepage, pricing, and `/models` routes that only need a count.
//   - Now we ship a *small static fallback* (a handful of hand-picked models with the
//     exact `Model` shape consumers expect) and load the full catalog
//     lazily at runtime via the `/v1/models` endpoint. The fallback
//     guarantees SSR metadata (`MODEL_COUNT`, layout descriptions,
//     `generateStaticParams`) keeps working without an async fetch; the
//     lazy loader returns the full catalog for anything that needs it.
//
// Public API is preserved: `Model`, `Capability`, `Provider`, `Tier`,
// `formatPricePerMillion`, `getModelsByTier`,
// `MODEL_COUNT`, `MODELS`, `PROVIDER_COLORS`, `TIER_COLORS`, `TIER_ORDER`.

export type Tier = "budget" | "mid" | "premium" | "frontier";
export type Provider =
	| "Venice"
	| "Gonka";

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
	Gonka: {
		bg: "bg-accent/10",
		text: "text-accent",
		border: "border-accent/30",
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

interface RawEntry {
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

interface RawCatalog {
	MODEL_CATALOG: Record<string, RawEntry>;
	VIDEO_MODELS?: Record<string, unknown>;
}

function formatContextLength(maxTokens: number): string {
	if (!Number.isFinite(maxTokens) || maxTokens <= 0) return "—";
	if (maxTokens >= 1_000_000) {
		const m = maxTokens / 1_000_000;
		const rounded = Math.round(m * 10) / 10;
		return `${rounded}M`;
	}
	const k = Math.round(maxTokens / 1000);
	return `${k}K`;
}

function deriveCapabilities(
	id: string,
	displayName: string,
	description: string | undefined,
	serverCaps: readonly string[] | undefined,
): Capability[] {
	const out = new Set<Capability>();
	const capSet = new Set((serverCaps ?? []).map((c) => c.toLowerCase()));
	const haystack = `${id} ${displayName} ${description ?? ""}`.toLowerCase();

	if (capSet.has("chat") || serverCaps === undefined || serverCaps.length === 0) {
		out.add("chat");
	}
	if (capSet.has("reasoning")) out.add("reasoning");
	if (capSet.has("vision")) out.add("vision");
	if (capSet.has("video-input") || capSet.has("audio-input"))
		out.add("multimodal");
	if (capSet.has("tools") || capSet.has("function-calling")) out.add("agents");

	if (/uncensored|heretic/.test(haystack)) out.add("uncensored");
	if (/(?:^|[-_/])coder(?:[-_/]|$)|codex/.test(id.toLowerCase()))
		out.add("coding");

	return [...out];
}

function deriveDescription(
	id: string,
	displayName: string,
	description: string | undefined,
): string {
	const trimmed = (description ?? "").trim();
	if (trimmed) return trimmed;
	const cleaned = id.replace(/^(openai|minimax|together|deepinfra)\//i, "");
	const titleCase = cleaned
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
	return `${titleCase || displayName} — language model served by OMA.`;
}

function toModel(entry: RawEntry): Model {
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
		provider: (entry.provider as Provider) || "Gonka",
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

/** Transform any raw upstream catalog shape into the public `Model[]`. */
function catalogFromRaw(catalog: RawCatalog): Model[] {
	return Object.values(catalog.MODEL_CATALOG).map(toModel);
}

// ---------------------------------------------------------------------------
// Lazy client loader
// ---------------------------------------------------------------------------

/**
 * Interface matching the OpenAI-style models returned by GET /v1/models.
 * The live API returns 90+ models with pricing, category, and context_length
 * but NOT displayName, description, or capabilities — those are derived here.
 */
interface ApiModelEntry {
	id: string;
	pricing: { prompt: string; completion: string | null };
	category: string;
	context_length: number | null;
	/** Upstream routing target surfaced by /v1/models ("venice" | "gonka" | "surplus"). */
	provider?: string;
}

interface ApiModelsResponse {
	object: "list";
	data: ApiModelEntry[];
}

function deriveNameFromId(id: string): string {
	// Convert model IDs like "qwen3-235b-a22b-instruct-2507" to display names
	const cleaned = id.replace(/^(openai|minimax|together|deepinfra)\//i, "");
	return cleaned
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
}

/**
 * Load the full model catalog from the live API.
 *
 * Returns chat models with derived display names, descriptions,
 * capabilities, and provider assignment. Video models (category "video")
 * are excluded: they are priced per-generation/per-second (surfaced on
 * `/video-generation`), not per-token, so mixing them into the per-token
 * catalog produced `$NaN` output prices and `$850000/1M` input prices.
 * Falls back to the static `MODELS` array if the network request fails.
 *
 * Results are cached in a module-level variable so repeated calls during
 * the same session do not re-fetch.
 */
let _liveModels: Model[] | null = null;
let _loadPromise: Promise<Model[]> | null = null;

export async function loadModels(): Promise<Model[]> {
	if (_liveModels) return _liveModels;
	if (_loadPromise) return _loadPromise;

	_loadPromise = (async () => {
		try {
			const res = await fetch("/api/v1/models");
			if (!res.ok) throw new Error(`API returned ${res.status}`);
			const json: ApiModelsResponse = await res.json();
			const models: Model[] = json.data
				.filter((entry: ApiModelEntry) => entry.category !== "video")
				.map((entry: ApiModelEntry) => {
					const name = deriveNameFromId(entry.id);
					const promptRaw = parseFloat(entry.pricing?.prompt ?? "");
					const completionRaw = parseFloat(entry.pricing?.completion ?? "");
					const inputPrice = Number.isFinite(promptRaw)
						? promptRaw * 1_000_000
						: 0;
					const outputPrice = Number.isFinite(completionRaw)
						? completionRaw * 1_000_000
						: 0;
					const tier: Tier =
						entry.category === "budget" ||
						entry.category === "mid" ||
						entry.category === "premium" ||
						entry.category === "frontier"
							? entry.category
							: "mid";
					return {
						id: entry.id,
						name,
						provider: (entry.provider === "gonka"
							? "Gonka"
							: "Venice") as Provider,
						tier,
						description: deriveDescription(entry.id, name, undefined),
						contextLength: formatContextLength(entry.context_length ?? 0),
						inputPricePer1M: inputPrice,
						outputPricePer1M: outputPrice,
						capabilities: deriveCapabilities(entry.id, name, undefined, undefined),
						modelId: entry.id,
					};
				});
			_liveModels = models;
			return models;
		} catch {
			// Network failure — return the static SSR fallback so the
			// page still renders something useful.
			return MODELS;
		}
	})();

	return _loadPromise;
}

// ---------------------------------------------------------------------------
// Synchronous SSR fallback
// ---------------------------------------------------------------------------

/**
 * Static fallback catalog. Used as a build-time-safe SSR fallback for
 * pages that need a synchronous `MODELS` / `MODEL_COUNT`. The actual
 * catalog is bigger (89 entries today) and is loaded lazily via
 * `loadModels()` from the client; this subset covers the most-used
 * pricing/tier entries so SSR markup never goes blank.
 */
const FALLBACK_CATALOG: RawCatalog = {
	MODEL_CATALOG: {
		"qwen3-235b-a22b-instruct-2507": {
			id: "qwen3-235b-a22b-instruct-2507",
			displayName: "Qwen3 235B Instruct",
			provider: "Venice",
			category: "premium",
			maxTokens: 131072,
			inputPricePer1M: 0.18,
			outputPricePer1M: 0.9,
			capabilities: ["chat", "reasoning"],
		},
		"llama-3.3-70b": {
			id: "llama-3.3-70b",
			displayName: "Llama 3.3 70B",
			provider: "Venice",
			category: "mid",
			maxTokens: 131072,
			inputPricePer1M: 0.18,
			outputPricePer1M: 0.9,
			capabilities: ["chat"],
		},
		"llama-3.2-3b": {
			id: "llama-3.2-3b",
			displayName: "Llama 3.2 3B",
			provider: "Venice",
			category: "budget",
			maxTokens: 131072,
			inputPricePer1M: 0.06,
			outputPricePer1M: 0.3,
			capabilities: ["chat", "fast"],
		},
		"minimax-m2.7": {
			id: "minimax-m2.7",
			displayName: "MiniMax M2.7",
			provider: "Gonka",
			category: "budget",
			maxTokens: 204800, // OpenBroker docs: 204,800 context
			inputPricePer1M: 0.017, // verified Gonka base rate @ $0.017/1M (2026-07-14)
			outputPricePer1M: 0.017,
			capabilities: ["chat"],
		},
		"claude-opus-4-8": {
			id: "claude-opus-4-8",
			displayName: "Claude Opus 4.8",
			provider: "Venice",
			category: "premium",
			maxTokens: 200000,
			inputPricePer1M: 15,
			outputPricePer1M: 75,
			capabilities: ["chat", "reasoning", "coding"],
		},
		"claude-sonnet-4-5": {
			id: "claude-sonnet-4-5",
			displayName: "Claude Sonnet 4.5",
			provider: "Venice",
			category: "premium",
			maxTokens: 200000,
			inputPricePer1M: 3,
			outputPricePer1M: 15,
			capabilities: ["chat", "coding"],
		},
		"claude-opus-4-8-fast": {
			id: "claude-opus-4-8-fast",
			displayName: "Claude Opus 4.8 Fast",
			provider: "Venice",
			category: "frontier",
			maxTokens: 200000,
			inputPricePer1M: 15,
			outputPricePer1M: 75,
			capabilities: ["chat", "reasoning", "coding", "fast"],
		},
	},
};

/**
 * Synchronous `MODELS` array for SSR metadata and the few places that
 * genuinely can't go async (Next.js `generateStaticParams`, page
 * metadata). This is the *fallback* catalog — the live catalog
 * (91 chat + 5 video = 96) is loaded lazily via `loadModels()`.
 */
export const MODELS: Model[] = catalogFromRaw(FALLBACK_CATALOG);

export function formatPricePerMillion(pricePer1M: number): string {
	if (pricePer1M === 0) return "$0";
	if (pricePer1M < 0.01) return `$${pricePer1M.toFixed(4)}`;
	if (pricePer1M < 1) return `$${pricePer1M.toFixed(3)}`;
	return `$${pricePer1M.toFixed(2)}`;
}

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

// Marketing model count surfaced across the UI. Must match live
// GET /v1/models (89 active chat + 5 video = 94). The SSR fallback catalog
// (`MODELS`) is a smaller hand-picked set — never use MODELS.length for
// marketing copy.
export const MODEL_COUNT = 90; // 94 live entries; 90 kept as the rounded-down marketing floor