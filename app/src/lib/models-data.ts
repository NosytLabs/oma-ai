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

/**
 * Modalities the catalog knows about. Text models carry a Tier (budget /
 * mid / premium / frontier). All other modalities are priced per-unit
 * (per-image, per-second, per-generation) and live alongside the chat
 * models in the catalog but render in dedicated sections.
 */
export type Modality =
	| "chat"
	| "image"
	| "video"
	| "tts"
	| "embedding"
	| "asr"
	| "music"
	| "upscale"
	| "inpaint";

export const MODALITY_LABELS: Record<Modality, string> = {
	chat: "Chat / Language",
	image: "Image Generation",
	video: "Video Generation",
	tts: "Text-to-Speech",
	embedding: "Embeddings",
	asr: "Speech-to-Text",
	music: "Music Generation",
	upscale: "Image Upscale",
	inpaint: "Image Edit",
};

export const MODALITY_ORDER: Modality[] = [
	"chat",
	"image",
	"video",
	"tts",
	"embedding",
	"asr",
	"music",
	"upscale",
	"inpaint",
];
export type Provider =
	| "Venice"
	| "OMA-AI"
	| "Surplus"
	| "Tinyfish";

export interface Model {
	id: string;
	name: string;
	provider: Provider;
	tier: Tier;
	/**
	 * Which modality bucket this model lives in. Text chat models keep
	 * their tier for pricing comparison. Image/Video/TTS/Embedding/ASR/
	 * Music/Upscale/Inpaint each render in their own section.
	 */
	modality: Modality;
	description: string;
	contextLength: string;
	/** Raw context length in tokens (for filter sliders). */
	contextTokens: number;
	inputPricePer1M: number;
	outputPricePer1M: number;
	/**
	 * Per-unit USD for non-chat modalities (image, video, audio, music,
	 * upscale, inpaint). 0 for chat models which price per-token.
	 */
	pricePerUnit?: number;
	priceUnit?: string;
	capabilities: Capability[];
	modelId: string;
	inputModalities?: string[];
	outputModalities?: string[];
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
	"OMA-AI": {
		bg: "bg-accent/10",
		text: "text-accent",
		border: "border-accent/30",
	},
	Surplus: {
		bg: "bg-warning/10",
		text: "text-warning",
		border: "border-warning/30",
	},
	Tinyfish: {
		bg: "bg-cyan-500/10",
		text: "text-cyan-400",
		border: "border-cyan-500/30",
	},
};

/** Map any provider string returned by the live `/v1/models` endpoint
 *  (lowercase, vendor name, or alias) onto the canonical `Provider`. */
export function normalizeProvider(raw: string | undefined | null): Provider {
	const s = (raw ?? "").trim().toLowerCase();
	if (!s) return "Venice";
	// Catalog + UI labels: "OMA-AI", "oma", gonka/OpenBroker upstream names
	if (
		s.includes("gonka") ||
		s.includes("openbroker") ||
		s.includes("obk") ||
		s === "oma-ai" ||
		s === "oma" ||
		s.includes("oma-ai")
	) {
		return "OMA-AI";
	}
	if (s.includes("surplus")) return "Surplus";
	if (s.includes("tinyfish")) return "Tinyfish";
	if (s.includes("venice")) return "Venice";
	return "Venice";
}

/** Distinct providers actually surfaced in a list of models — used to
 *  build the provider filter chip row on /models without hard-coding. */
export function distinctProviders(models: readonly Model[]): Provider[] {
	const seen = new Set<Provider>();
	for (const m of models) seen.add(m.provider);
	return (["Venice", "OMA-AI", "Surplus", "Tinyfish"] as Provider[]).filter((p) =>
		seen.has(p),
	);
}

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
		bg: "bg-amber/10",
		text: "text-amber",
		border: "border-amber/30",
		badge: "bg-amber/20 text-amber",
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

export function formatContextLength(maxTokens: number): string {
	if (!Number.isFinite(maxTokens) || maxTokens <= 0) return "—";
	if (maxTokens >= 1_000_000) {
		const m = maxTokens / 1_000_000;
		const rounded = Math.round(m * 10) / 10;
		return `${rounded}M`;
	}
	const k = Math.round(maxTokens / 1000);
	return `${k}K`;
}

export function deriveCapabilities(
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
	modality: Modality = "chat",
): string {
	const trimmed = (description ?? "").trim();
	if (trimmed) return trimmed;
	const cleaned = id.replace(/^(openai|minimax|together|deepinfra)\//i, "");
	const titleCase = cleaned
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
	const label = MODALITY_LABELS[modality] ?? "language model";
	return `${titleCase || displayName} — ${label.toLowerCase()} served by OMA.`;
}

/**
 * Bucket a server catalog entry into a single `Modality` for UI grouping.
 * The server already emits `category` strings ("image", "video", "tts",
 * "embedding", "asr", "music", "upscale", "inpaint", "budget", "mid",
 * "premium", "frontier"); we map non-text categories to dedicated
 * modalities and treat all text tiers as `chat`.
 */
function deriveModality(entry: ApiModelEntry): Modality {
	const cat = (entry.category ?? "").toLowerCase();
	if (cat === "image") return "image";
	if (cat === "video") return "video";
	if (cat === "tts") return "tts";
	if (cat === "embedding") return "embedding";
	if (cat === "asr") return "asr";
	if (cat === "music") return "music";
	if (cat === "upscale") return "upscale";
	if (cat === "inpaint") return "inpaint";
	// Text tiers and unknown categories fall back to chat.
	return "chat";
}

function derivePriceUnit(modality: Modality, _pricing: ApiModelEntry["pricing"]): string | undefined {
	if (modality === "chat" || modality === "embedding") return "/M tokens";
	if (modality === "image") return "/image";
	if (modality === "video") return "/generation";
	if (modality === "asr") return "/audio second";
	if (modality === "tts") return "/M chars";
	if (modality === "music") return "/track";
	if (modality === "upscale") return "/upscale";
	if (modality === "inpaint") return "/edit";
	return undefined;
}

function toModel(entry: RawEntry): Model {
	const tier: Tier =
		entry.category === "budget" ||
		entry.category === "mid" ||
		entry.category === "premium" ||
		entry.category === "frontier"
			? entry.category
			: "mid";
	const modality: Modality = (() => {
		const cat = (entry.category ?? "").toLowerCase();
		if (cat === "image" || cat === "video" || cat === "tts" || cat === "embedding" || cat === "asr" || cat === "music" || cat === "upscale" || cat === "inpaint") {
			return cat as Modality;
		}
		return "chat";
	})();
	const serverCaps = entry.capabilities ?? [];
	return {
		id: entry.id,
		name: entry.displayName,
		provider: normalizeProvider(entry.provider),
		tier,
		modality,
		description: deriveDescription(entry.id, entry.displayName, entry.description, modality),
		contextLength: formatContextLength(entry.maxTokens),
		contextTokens: entry.maxTokens,
		inputPricePer1M: entry.inputPricePer1M,
		outputPricePer1M: entry.outputPricePer1M,
		capabilities: deriveCapabilities(entry.id, entry.displayName, entry.description, serverCaps),
		modelId: entry.veniceId ?? entry.id,
		inputModalities: ["text"],
		outputModalities: ["text"],
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
	/** Customer-facing name from the server catalog; never derive this when present. */
	display_name?: string;
	pricing: {
		prompt: string;
		completion: string | null;
		/** Per-generation USD price for image/video/music/upscale/inpaint. */
		generation?: string;
		/** Per-second USD price for ASR. */
		audio_second?: string;
	};
	category: string;
	context_length: number | null;
	/** Upstream routing target surfaced by /v1/models ("venice" | "gonka" | "surplus"). */
	provider?: string;
	architecture?: { input_modalities?: string[]; output_modalities?: string[] };
	supported_parameters?: string[];
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
 * `/chat?mode=video`), not per-token, so mixing them into the per-token
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
				.map((entry: ApiModelEntry) => {
					const name = entry.display_name?.trim() || deriveNameFromId(entry.id);
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
					const modality = deriveModality(entry);
					return {
						id: entry.id,
						name,
						provider: normalizeProvider(entry.provider),
						tier,
						modality,
						description: deriveDescription(entry.id, name, undefined, modality),
						contextLength: formatContextLength(entry.context_length ?? 0),
						contextTokens: entry.context_length ?? 0,
						inputPricePer1M: inputPrice,
						outputPricePer1M: outputPrice,
						pricePerUnit: modality === "chat" ? undefined : (Number(entry.pricing?.generation) || Number(entry.pricing?.audio_second) || inputPrice),
						priceUnit: derivePriceUnit(modality, entry.pricing),
						capabilities:
							modality === "chat"
								? deriveCapabilities(entry.id, name, undefined, entry.supported_parameters)
								: [],
						modelId: entry.id,
						inputModalities: entry.architecture?.input_modalities ?? ["text"],
						outputModalities: entry.architecture?.output_modalities ?? ["text"],
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
 * catalog is bigger (89 chat entries today; video excluded) and is loaded
 * lazily via `loadModels()` from the client; this subset covers the
 * most-used pricing/tier entries so SSR markup never goes blank.
 */
const FALLBACK_CATALOG: RawCatalog = {
	MODEL_CATALOG: {
		// Prices/categories below mirror server/models.json (the billing source
		// of truth) as of 2026-07-26 — keep them in sync when the catalog moves.
		"qwen3-235b-a22b-instruct-2507": {
			id: "qwen3-235b-a22b-instruct-2507",
			displayName: "Qwen3 235B Instruct",
			provider: "Venice",
			category: "budget",
			maxTokens: 16384,
			inputPricePer1M: 0.15,
			outputPricePer1M: 0.75,
			capabilities: ["chat", "reasoning"],
		},
		"llama-3.3-70b": {
			id: "llama-3.3-70b",
			displayName: "Llama 3.3 70B",
			provider: "Venice",
			category: "budget",
			maxTokens: 4096,
			inputPricePer1M: 0.7,
			outputPricePer1M: 2.8,
			capabilities: ["chat"],
		},
		"llama-3.2-3b": {
			id: "llama-3.2-3b",
			displayName: "Llama 3.2 3B",
			provider: "Venice",
			category: "budget",
			maxTokens: 4096,
			inputPricePer1M: 0.15,
			outputPricePer1M: 0.6,
			capabilities: ["chat", "fast"],
		},
		"minimax-m2.7": {
			id: "minimax-m2.7",
			displayName: "MiniMax M2.7",
			provider: "OMA-AI",
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
			maxTokens: 128000,
			inputPricePer1M: 6,
			outputPricePer1M: 30,
			capabilities: ["chat", "reasoning", "coding"],
		},
		"claude-sonnet-4-5": {
			id: "claude-sonnet-4-5",
			displayName: "Claude Sonnet 4.5",
			provider: "Venice",
			category: "premium",
			maxTokens: 64000,
			inputPricePer1M: 3.75,
			outputPricePer1M: 18.75,
			capabilities: ["chat", "coding"],
		},
		"claude-opus-4-8-fast": {
			id: "claude-opus-4-8-fast",
			displayName: "Claude Opus 4.8 Fast",
			provider: "Venice",
			category: "frontier",
			maxTokens: 128000,
			inputPricePer1M: 12,
			outputPricePer1M: 60,
			capabilities: ["chat", "reasoning", "coding", "fast"],
		},
	},
};

/**
 * Synchronous `MODELS` array for SSR metadata and the few places that
 * genuinely can't go async (Next.js `generateStaticParams`, page
 * metadata). This is the *fallback* catalog — the live catalog
 * (89 chat + 5 video = 94) is loaded lazily via `loadModels()`.
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
// GET /v1/models count. The SSR fallback catalog (`MODELS`) is a smaller
// hand-picked set — never use MODELS.length for marketing copy.
export const MODEL_COUNT = 288; // 104 chat + 35 image + 91 video + 11 tts + 9 embedding + 5 asr + 14 music + 1 upscale + 18 inpaint — server/models.json