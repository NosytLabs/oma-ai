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
//   - The static fallback mirrors the curated server catalog exactly
//     (26 chat models: 18 Venice + 8 OMA-AI). See `MODEL_COUNT`.
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
	| "Both"
	| "Surplus";

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
		// Keep the provider badge readable on the dark panel at small sizes;
		// the violet border preserves the provider distinction without relying
		// on low-contrast violet text over a translucent violet fill.
		bg: "bg-surface",
		text: "text-text-bright",
		border: "border-violet/50",
	},
	"OMA-AI": {
		bg: "bg-success/10",
		text: "text-success",
		border: "border-success/30",
	},
	Surplus: {
		bg: "bg-warning/10",
		text: "text-warning",
		border: "border-warning/30",
	},
	Both: {
		bg: "bg-surface",
		text: "text-text-bright",
		border: "border-border",
	}
};

/** Map any provider string returned by the live `/v1/models` endpoint
 *  (lowercase, vendor name, or alias) onto the canonical `Provider`. */
export function normalizeProvider(raw: string | undefined | null): Provider {
	const s = (raw ?? "").trim().toLowerCase();
	if (!s) return "OMA-AI";
	// Catalog + UI labels: "OMA-AI"/"OpenBroker" upstream names now branded as OMA-AI
	if (s.includes("oma-ai") || s.includes("openbroker") || s.includes("obk") || s === "oma") {
		return "OMA-AI";
	}
	if (s.includes("surplus")) return "Surplus";
	if (s.includes("venice")) return "Venice";
	return "OMA-AI";
}

/** Distinct providers actually surfaced in a list of models — used to
 *  build the provider filter chip row on /models without hard-coding. */
export function distinctProviders(models: readonly Model[]): Provider[] {
	const seen = new Set<Provider>();
	for (const m of models) seen.add(m.provider);
	return (["OMA-AI", "Venice", "Surplus"] as Provider[]).filter((p) =>
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
 * The server emits an explicit `modality` field ("chat" | "image" | "video")
 * and a `category` ("budget" | "mid" | "premium" | "frontier"). We prefer
 * the explicit modality when present and only fall back to category-based
 * inference when the server omits it (legacy / cached responses).
 */
function deriveModality(entry: ApiModelEntry): Modality {
	const explicit = (entry.modality ?? "").toLowerCase();
	if (explicit === "chat" || explicit === "image" || explicit === "video") {
		return explicit as Modality;
	}
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

/**
 * Display-name overrides applied on top of whatever the upstream API returns.
 * We use this to canonicalise names whose API string is wrong or low-quality
 * (e.g. "Google Gemini 3" → "Gemini 3 Flash") without forking the SSR fallback.
 * Keyed by lower-cased model id.
 */
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {};

function deriveNameFromId(id: string): string {
	// Convert model IDs like "qwen3-235b-a22b-instruct-2507" to display names
	const cleaned = id.replace(/^(openai|minimax|together|deepinfra)\//i, "");
	return cleaned
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
}

function normalizeDisplayName(id: string, rawName: string | undefined): string {
	const override = DISPLAY_NAME_OVERRIDES[id.toLowerCase()];
	if (override) return override;
	if (rawName?.trim()) return rawName.trim();
	return deriveNameFromId(id);
}

function toModel(entry: RawEntry): Model {
	entry.displayName = normalizeDisplayName(entry.id, entry.displayName);
	const tier: Tier =
		entry.category === "budget" ||
		entry.category === "mid" ||
		entry.category === "premium" ||
		entry.category === "frontier"
			? entry.category
			: "mid";
	const modality: Modality = deriveModality({ category: entry.category } as ApiModelEntry);
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
	 * The live API returns the curated chat catalog (26 models — see
	 * `MODEL_COUNT`) with user-facing pricing, category, and context_length
	 * but NOT description or capabilities — those are derived here.
	 */
interface ApiModelEntry {
	id: string;
	/** Customer-facing name from the server catalog; never derive this when present. */
	display_name?: string;
	owned_by?: string;
	/**
	 * Output modality emitted by the server (R6+). Older / cached responses
	 * omit this — deriveModality() falls back to category-based inference.
	 */
	modality?: "chat" | "image" | "video" | string;
	pricing: {
		prompt: string;
		completion: string | null;
		/** Per-generation USD price for image/video/music/upscale/inpaint. */
		generation?: string;
		/** Per-second USD price for ASR. */
		audio_second?: string;
		/** Per-generation credits for image/video (R6+). */
		credits_per_generation?: number;
	};
	category: string;
	context_length: number | null;
	/** Upstream routing target surfaced by /v1/models ("venice" | "oma-ai" | "surplus").
	 * Backends differ: OMA + Pollinations return `provider`, OpenRouter returns
	 * `owned_by`, etc. The loader picks whichever is present. */
	provider?: string;
	/** Video generation duration (e.g. "10s") for video models. */
	duration?: string;
	architecture?: { input_modalities?: string[]; output_modalities?: string[] };
	supported_parameters?: string[];
}

interface ApiModelsResponse {
	object: "list";
	data: ApiModelEntry[];
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

/**
 * Raw /api/v1/models response cache, shared by loadModels() and anything
 * that needs the unfiltered list (StatsStrip's live count, pricing's
 * image/video section). Concurrent callers collapse into one fetch.
 */
let _rawResponse: ApiModelsResponse | null = null;
let _rawPromise: Promise<ApiModelsResponse | null> | null = null;

async function fetchRawModelsResponse(): Promise<ApiModelsResponse | null> {
	if (_rawResponse) return _rawResponse;
	if (_rawPromise) return _rawPromise;

	_rawPromise = fetch("/api/v1/models")
		.then(async (res) => {
			if (!res.ok) return null;
			const json: ApiModelsResponse = (await res.json()) as ApiModelsResponse;
			_rawResponse = json;
			return json;
		})
		.catch(() => null);

	return _rawPromise;
}

/**
 * Load the unfiltered model list (including image/video categories) from
 * the live API. Shares the cache with loadModels().
 */
export async function loadRawModelEntries(): Promise<ApiModelEntry[]> {
	const json = await fetchRawModelsResponse();
	return json?.data ?? [];
}

export async function loadModels(): Promise<Model[]> {
	if (_liveModels) return _liveModels;
	if (_loadPromise) return _loadPromise;

	_loadPromise = (async () => {
		try {
			const json = await fetchRawModelsResponse();
			if (!json?.data) throw new Error("API returned no models");
			const models: Model[] = json.data
				.filter((entry: ApiModelEntry) => entry.modality !== "video")
				.map((entry: ApiModelEntry) => {
					const name = normalizeDisplayName(entry.id, entry.display_name);
					const promptRaw = parseFloat(entry.pricing?.prompt ?? "");
					const completionRaw = parseFloat(entry.pricing?.completion ?? "");
					// API returns prices per 1M tokens already — no conversion needed
					const inputPrice = Number.isFinite(promptRaw) ? promptRaw : 0;
					const outputPrice = Number.isFinite(completionRaw) ? completionRaw : 0;
					// Backends vary: OMA returns `provider`, OpenRouter returns `owned_by`,
					// Pollinations returns `organization`. Accept any of them.
					const rawProvider =
						entry.provider ?? entry.owned_by ?? entry.architecture?.output_modalities?.[0];
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
						provider: normalizeProvider(rawProvider),
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
 * pages that need a synchronous `MODELS` / `MODEL_COUNT`. Mirrors the
 * curated server catalog (26 models) — keep in sync with
 * server/src/inference/models.ts. Prices are USER-FACING per-1M rates
 * (Venice wholesale × 1.25 markup; OMA-AI prices already final), exactly
 * as returned by GET /v1/models.
 */
const FALLBACK_CATALOG: RawCatalog = {
	MODEL_CATALOG: {
		// ── Venice (wholesale × 1.25 markup = user-facing) ───────────────
		"openai-gpt-56-sol": {
			id: "openai-gpt-56-sol",
			displayName: "GPT-5.6 Sol",
			provider: "Venice",
			category: "frontier",
			maxTokens: 1000000,
			inputPricePer1M: 7.8125,
			outputPricePer1M: 46.875,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"claude-opus-5": {
			id: "claude-opus-5",
			displayName: "Claude Opus 5",
			provider: "Venice",
			category: "frontier",
			maxTokens: 1000000,
			inputPricePer1M: 7.5,
			outputPricePer1M: 37.5,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"kimi-k3": {
			id: "kimi-k3",
			displayName: "Kimi K3",
			provider: "Venice",
			category: "premium",
			maxTokens: 1000000,
			inputPricePer1M: 4.6875,
			outputPricePer1M: 23.4375,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"zai-org-glm-5-2": {
			id: "zai-org-glm-5-2",
			displayName: "GLM 5.2",
			provider: "Venice",
			category: "premium",
			maxTokens: 1000000,
			inputPricePer1M: 1.75,
			outputPricePer1M: 5.5,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"deepseek-v4-pro": {
			id: "deepseek-v4-pro",
			displayName: "DeepSeek V4 Pro",
			provider: "Venice",
			category: "premium",
			maxTokens: 1000000,
			inputPricePer1M: 2.0625,
			outputPricePer1M: 4.1263,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"qwen-3-8-max": {
			id: "qwen-3-8-max",
			displayName: "Qwen 3.8 Max",
			provider: "Venice",
			category: "premium",
			maxTokens: 1000000,
			inputPricePer1M: 3.125,
			outputPricePer1M: 9.375,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"grok-4-5": {
			id: "grok-4-5",
			displayName: "Grok 4.5",
			provider: "Venice",
			category: "premium",
			maxTokens: 500000,
			inputPricePer1M: 2.8375,
			outputPricePer1M: 8.5,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"claude-sonnet-4-6": {
			id: "claude-sonnet-4-6",
			displayName: "Claude Sonnet 4.6",
			provider: "Venice",
			category: "premium",
			maxTokens: 1000000,
			inputPricePer1M: 4.5,
			outputPricePer1M: 22.5,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"gemini-3-6-flash": {
			id: "gemini-3-6-flash",
			displayName: "Gemini 3.6 Flash",
			provider: "Venice",
			category: "premium",
			maxTokens: 1000000,
			inputPricePer1M: 2.34375,
			outputPricePer1M: 11.71875,
			capabilities: ["chat", "reasoning", "coding", "tools", "vision"],
		},
		"llama-3.3-70b": {
			id: "llama-3.3-70b",
			displayName: "Llama 3.3 70B",
			provider: "Venice",
			category: "mid",
			maxTokens: 128000,
			inputPricePer1M: 0.875,
			outputPricePer1M: 3.5,
			capabilities: ["chat", "tools"],
		},
		"hermes-3-llama-3.1-405b": {
			id: "hermes-3-llama-3.1-405b",
			displayName: "Hermes 3 405B",
			provider: "Venice",
			category: "mid",
			maxTokens: 128000,
			inputPricePer1M: 1.375,
			outputPricePer1M: 3.75,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"zai-org-glm-5-1": {
			id: "zai-org-glm-5-1",
			displayName: "GLM 5.1",
			provider: "Venice",
			category: "mid",
			maxTokens: 200000,
			inputPricePer1M: 1.925,
			outputPricePer1M: 6.05,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"qwen-3-7-plus": {
			id: "qwen-3-7-plus",
			displayName: "Qwen 3.7 Plus",
			provider: "Venice",
			category: "mid",
			maxTokens: 1000000,
			inputPricePer1M: 0.625,
			outputPricePer1M: 2.5,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"venice-uncensored-1-2": {
			id: "venice-uncensored-1-2",
			displayName: "Venice Uncensored 1.2",
			provider: "Venice",
			category: "mid",
			maxTokens: 128000,
			inputPricePer1M: 0.25,
			outputPricePer1M: 1.125,
			capabilities: ["chat", "uncensored"],
		},
		"xiaomi-mimo-v2-5": {
			id: "xiaomi-mimo-v2-5",
			displayName: "Xiaomi MiMo V2.5",
			provider: "Venice",
			category: "budget",
			maxTokens: 1000000,
			inputPricePer1M: 0.5,
			outputPricePer1M: 2.5,
			capabilities: ["chat", "reasoning", "fast"],
		},
		"deepseek-v4-flash-0731": {
			id: "deepseek-v4-flash-0731",
			displayName: "DeepSeek V4 Flash",
			provider: "Venice",
			category: "budget",
			maxTokens: 1000000,
			inputPricePer1M: 0.21875,
			outputPricePer1M: 0.4375,
			capabilities: ["chat", "reasoning", "fast"],
		},
		"mistral-small-2603": {
			id: "mistral-small-2603",
			displayName: "Mistral Small 4",
			provider: "Venice",
			category: "budget",
			maxTokens: 256000,
			inputPricePer1M: 0.234375,
			outputPricePer1M: 0.9375,
			capabilities: ["chat", "tools", "fast"],
		},
		"google-gemma-4-31b-it": {
			id: "google-gemma-4-31b-it",
			displayName: "Gemma 4 31B",
			provider: "Venice",
			category: "budget",
			maxTokens: 256000,
			inputPricePer1M: 0.15,
			outputPricePer1M: 0.45,
			capabilities: ["chat", "fast"],
		},
		// ── OMA-AI resale (markup built-in = user-facing) ────────────────
		"gemini-3.1-pro-preview": {
			id: "gemini-3.1-pro-preview",
			displayName: "Gemini 3.1 Pro",
			provider: "OMA-AI",
			category: "frontier",
			maxTokens: 128000,
			inputPricePer1M: 1.0,
			outputPricePer1M: 5.0,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"gpt-4.1": {
			id: "gpt-4.1",
			displayName: "GPT-4.1",
			provider: "OMA-AI",
			category: "frontier",
			maxTokens: 128000,
			inputPricePer1M: 2.0,
			outputPricePer1M: 8.0,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"gpt-4o": {
			id: "gpt-4o",
			displayName: "GPT-4o",
			provider: "OMA-AI",
			category: "premium",
			maxTokens: 128000,
			inputPricePer1M: 2.5,
			outputPricePer1M: 10.0,
			capabilities: ["chat", "fast", "tools"],
		},
		"kimi-k2-6": {
			id: "kimi-k2-6",
			displayName: "Kimi K2.6",
			provider: "OMA-AI",
			category: "premium",
			maxTokens: 128000,
			inputPricePer1M: 0.6,
			outputPricePer1M: 2.5,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"gemini-3-flash-preview": {
			id: "gemini-3-flash-preview",
			displayName: "Gemini 3 Flash",
			provider: "OMA-AI",
			category: "mid",
			maxTokens: 128000,
			inputPricePer1M: 0.2,
			outputPricePer1M: 1.5,
			capabilities: ["chat", "fast", "tools"],
		},
		"minimax-m2-7": {
			id: "minimax-m2-7",
			displayName: "MiniMax M2.7",
			provider: "OMA-AI",
			category: "budget",
			maxTokens: 128000,
			inputPricePer1M: 0.3,
			outputPricePer1M: 1.2,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"deepseek-v4-flash-0731-openbroker": {
			id: "deepseek-v4-flash-0731-openbroker",
			displayName: "DeepSeek V4 Flash (Gonka)",
			provider: "OMA-AI",
			category: "budget",
			maxTokens: 1000000,
			inputPricePer1M: 0.15,
			outputPricePer1M: 0.3,
			capabilities: ["chat", "reasoning", "fast", "tools"],
		},
		"qwen3-235b-a22b-openbroker": {
			id: "qwen3-235b-a22b-openbroker",
			displayName: "Qwen3 235B (Gonka)",
			provider: "OMA-AI",
			category: "mid",
			maxTokens: 128000,
			inputPricePer1M: 0.2,
			outputPricePer1M: 0.6,
			capabilities: ["chat", "reasoning", "tools"],
		},
	},
};

/**
 * Synchronous `MODELS` array for SSR metadata and the few places that
 * genuinely can't go async (Next.js `generateStaticParams`, page
 * metadata). This is the *fallback* catalog — the full curated catalog
 * is loaded lazily via `loadModels()` from GET /v1/models. Keep prices
 * and ids in sync with server/src/inference/models.ts (single source
 * of truth); entries here that the server can't route will 404.
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

// Marketing model count surfaced across the UI. Must match the live
// `GET /v1/models` count — 26 curated chat models (18 Venice + 8 OMA-AI).
// Keep in sync with `server/src/inference/models.ts` defaultCatalog().
export const MODEL_COUNT = 26;