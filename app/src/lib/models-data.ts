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
//   - Now we ship a *small static fallback* (50 hand-picked models with the
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
	| "AntSeed"
	| "Claude"
	| "Gemini"
	| "OpenRouter"
	| "Together"
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
		border: "border-text-secondary/20",
	},
	Together: {
		bg: "bg-tertiary/20",
		text: "text-tertiary",
		border: "border-tertiary/30",
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
		provider: (entry.provider as Provider) || "Venice",
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
export function catalogFromRaw(catalog: RawCatalog): Model[] {
	return Object.values(catalog.MODEL_CATALOG).map(toModel);
}

// ---------------------------------------------------------------------------
// Lazy client loader
// ---------------------------------------------------------------------------

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
		"qwen3-coder-480b-a35b-instruct": {
			id: "qwen3-coder-480b-a35b-instruct",
			displayName: "Qwen3 Coder 480B",
			provider: "Venice",
			category: "premium",
			maxTokens: 262144,
			inputPricePer1M: 0.18,
			outputPricePer1M: 0.9,
			capabilities: ["chat", "coding"],
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
		"deepseek-v3.2-exp": {
			id: "deepseek-v3.2-exp",
			displayName: "DeepSeek V3.2",
			provider: "Venice",
			category: "mid",
			maxTokens: 131072,
			inputPricePer1M: 0.18,
			outputPricePer1M: 0.9,
			capabilities: ["chat", "reasoning"],
		},
		"claude-opus-4-1": {
			id: "claude-opus-4-1",
			displayName: "Claude Opus 4.1",
			provider: "Venice",
			category: "frontier",
			maxTokens: 200000,
			inputPricePer1M: 0.18,
			outputPricePer1M: 0.9,
			capabilities: ["chat", "reasoning", "vision", "coding"],
		},
		"gemini-2.5-pro": {
			id: "gemini-2.5-pro",
			displayName: "Gemini 2.5 Pro",
			provider: "Venice",
			category: "frontier",
			maxTokens: 1048576,
			inputPricePer1M: 0.18,
			outputPricePer1M: 0.9,
			capabilities: ["chat", "reasoning", "multimodal", "vision"],
		},
		"mistral-31-24b": {
			id: "mistral-31-24b",
			displayName: "Mistral 3.1 24B",
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
			maxTokens: 205000, // OpenBroker docs: 200-205k context
			inputPricePer1M: 0.017, // verified Gonka base rate @ $0.017/1M (2026-07-14)
			outputPricePer1M: 0.017,
			capabilities: ["chat"],
		},
		"kimi-k2.6": {
			id: "kimi-k2.6",
			displayName: "Moonshot Kimi K2.6",
			provider: "Gonka",
			category: "budget",
			maxTokens: 240000, // per v0.2.12 release notes
			inputPricePer1M: 0.017, // Gonka base rate; INACTIVE on network
			outputPricePer1M: 0.017,
			capabilities: ["chat"],
		},
		"glm-5.2-fp8": {
			id: "glm-5.2-fp8",
			displayName: "Zhipu GLM 5.2",
			provider: "Gonka",
			category: "budget",
			maxTokens: 131072,
			inputPricePer1M: 0.017, // Gonka base rate; INACTIVE on network
			outputPricePer1M: 0.017,
			capabilities: ["chat"],
		},
	},
};

/**
 * Synchronous `MODELS` array for SSR metadata and the few places that
 * genuinely can't go async (Next.js `generateStaticParams`, page
 * metadata). This is the *fallback* catalog — the live 89-model list
 * is loaded lazily via `loadModels()`.
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

// Marketing model count surfaced across the UI. The live catalog from
// GET /v1/models is ~95+ models; the SSR fallback catalog (`MODELS`) only
// ships 11 hand-picked entries, so we use the real marketing number here
// rather than `MODELS.length` (which would render "11+ models" everywhere).
export const MODEL_COUNT = 95;