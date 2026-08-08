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
	if (s.includes("oma-ai") || s.includes("openbroker") || s.includes("obk")) {
		return "OMA-AI";
	}
	if (s === "oma-ai" || s === "oma" || s.includes("oma-ai")) {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TIER_ORDER: Tier[] = ["budget", "mid", "premium", "frontier"];

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
	 * The live API returns the curated chat catalog (20 models — see
	 * `MODEL_COUNT`) with pricing, category, and context_length but NOT
	 * displayName, description, or capabilities — those are derived here.
	 */
interface ApiModelEntry {
	id: string;
	/** Customer-facing name from the server catalog; never derive this when present. */
	display_name?: string;
	owned_by?: string;
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
	/** Upstream routing target surfaced by /v1/models ("venice" | "oma-ai" | "surplus").
	 * Backends differ: OMA + Pollinations return `provider`, OpenRouter returns
	 * `owned_by`, etc. The loader picks whichever is present. */
	provider?: string;
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
 * curated server catalog (20 models) — keep in sync with
 * server/src/inference/models.ts.
 */
const FALLBACK_CATALOG: RawCatalog = {
	MODEL_CATALOG: {
		"claude-opus-5": {
			id: "claude-opus-5",
			displayName: "Claude Opus 5",
			provider: "Venice",
			category: "frontier",
			maxTokens: 16384,
			inputPricePer1M: 6.0,
			outputPricePer1M: 30.0,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"openai-gpt-56-sol": {
			id: "openai-gpt-56-sol",
			displayName: "GPT-5.6 Sol",
			provider: "Venice",
			category: "frontier",
			maxTokens: 16384,
			inputPricePer1M: 6.25,
			outputPricePer1M: 37.5,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"claude-sonnet-5": {
			id: "claude-sonnet-5",
			displayName: "Claude Sonnet 5",
			provider: "Venice",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 3.0,
			outputPricePer1M: 15.0,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"openai-gpt-54": {
			id: "openai-gpt-54",
			displayName: "GPT-5.4",
			provider: "Venice",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 3.13,
			outputPricePer1M: 18.8,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"kimi-k3": {
			id: "kimi-k3",
			displayName: "Kimi K3",
			provider: "Venice",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 3.75,
			outputPricePer1M: 18.75,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"openai-gpt-52": {
			id: "openai-gpt-52",
			displayName: "GPT-5.2",
			provider: "Venice",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 2.19,
			outputPricePer1M: 17.5,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"grok-4-5": {
			id: "grok-4-5",
			displayName: "Grok 4.5",
			provider: "Venice",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 2.27,
			outputPricePer1M: 6.8,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"zai-org-glm-5-2": {
			id: "zai-org-glm-5-2",
			displayName: "GLM 5.2",
			provider: "Venice",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 1.4,
			outputPricePer1M: 4.4,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"deepseek-v4-pro": {
			id: "deepseek-v4-pro",
			displayName: "DeepSeek V4 Pro",
			provider: "Venice",
			category: "mid",
			maxTokens: 16384,
			inputPricePer1M: 1.65,
			outputPricePer1M: 3.3,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"gemini-3-5-flash": {
			id: "gemini-3-5-flash",
			displayName: "Gemini 3.5 Flash",
			provider: "Venice",
			category: "mid",
			maxTokens: 16384,
			inputPricePer1M: 1.55,
			outputPricePer1M: 9.45,
			capabilities: ["chat", "reasoning", "tools"],
		},

		"llama-3.3-70b": {
			id: "llama-3.3-70b",
			displayName: "Llama 3.3 70B",
			provider: "Venice",
			category: "mid",
			maxTokens: 8192,
			inputPricePer1M: 0.7,
			outputPricePer1M: 2.8,
			capabilities: ["chat", "tools"],
		},
		"deepseek-v4-flash": {
			id: "deepseek-v4-flash",
			displayName: "DeepSeek V4 Flash",
			provider: "Venice",
			category: "budget",
			maxTokens: 16384,
			inputPricePer1M: 0.138,
			outputPricePer1M: 0.275,
			capabilities: ["chat", "fast", "tools"],
		},
		"mistral-small-2603": {
			id: "mistral-small-2603",
			displayName: "Mistral Small 4",
			provider: "Venice",
			category: "budget",
			maxTokens: 8192,
			inputPricePer1M: 0.1875,
			outputPricePer1M: 0.75,
			capabilities: ["chat", "fast", "tools"],
		},
		"mercury-2": {
			id: "mercury-2",
			displayName: "Mercury 2",
			provider: "Venice",
			category: "budget",
			maxTokens: 8192,
			inputPricePer1M: 0.3125,
			outputPricePer1M: 0.9375,
			capabilities: ["chat", "fast"],
		},
		"zai-org-glm-5-1": {
			id: "zai-org-glm-5-1",
			displayName: "GLM 5.1",
			provider: "Venice",
			category: "mid",
			maxTokens: 16384,
			inputPricePer1M: 1.54,
			outputPricePer1M: 4.84,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"qwen-3-7-plus": {
			id: "qwen-3-7-plus",
			displayName: "Qwen 3.7 Plus",
			provider: "Venice",
			category: "mid",
			maxTokens: 16384,
			inputPricePer1M: 0.5,
			outputPricePer1M: 2.0,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"xiaomi-mimo-v2-5": {
			id: "xiaomi-mimo-v2-5",
			displayName: "Xiaomi MiMo V2.5",
			provider: "Venice",
			category: "budget",
			maxTokens: 16384,
			inputPricePer1M: 0.14,
			outputPricePer1M: 0.28,
			capabilities: ["chat", "reasoning", "fast"],
		},
		// ── OMA-AI (OpenBroker) Resale - Branded as OMA-AI ────────────────

		// ── Zyloo Subscription Integration - Branded as OMA-AI ───────────
		"gemini-3.1-pro-preview": {
			id: "gemini-3.1-pro-preview",
			displayName: "Gemini 3.1 Pro",
			provider: "OMA-AI",
			category: "frontier",
			maxTokens: 16384,
			inputPricePer1M: 1.0,
			outputPricePer1M: 5.0,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"gemini-3-pro-preview": {
			id: "gemini-3-pro-preview",
			displayName: "Gemini 3 Pro",
			provider: "OMA-AI",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 1.7,
			outputPricePer1M: 9.0,
			capabilities: ["chat", "reasoning", "tools"],
		},
		"gemini-3-flash-preview": {
			id: "gemini-3-flash-preview",
			displayName: "Gemini 3 Flash",
			provider: "OMA-AI",
			category: "mid",
			maxTokens: 8192,
			inputPricePer1M: 0.2,
			outputPricePer1M: 1.5,
			capabilities: ["chat", "fast", "tools"],
		},
		"gemini-2.5-flash": {
			id: "gemini-2.5-flash",
			displayName: "Gemini 2.5 Flash",
			provider: "OMA-AI",
			category: "mid",
			maxTokens: 8192,
			inputPricePer1M: 0.2,
			outputPricePer1M: 1.5,
			capabilities: ["chat", "fast"],
		},
		"gpt-4.1": {
			id: "gpt-4.1",
			displayName: "GPT-4.1",
			provider: "OMA-AI",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 2.0,
			outputPricePer1M: 8.0,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"gpt-4o": {
			id: "gpt-4o",
			displayName: "GPT-4o",
			provider: "OMA-AI",
			category: "premium",
			maxTokens: 16384,
			inputPricePer1M: 2.5,
			outputPricePer1M: 10.0,
			capabilities: ["chat", "reasoning", "coding", "tools"],
		},
		"glm-4.5-air": {
			id: "glm-4.5-air",
			displayName: "GLM 4.5 Air",
			provider: "OMA-AI",
			category: "budget",
			maxTokens: 8192,
			inputPricePer1M: 0.1,
			outputPricePer1M: 0.2,
			capabilities: ["chat", "fast", "tools"],
		},
	},
};

/**
 * Synchronous `MODELS` array for SSR metadata and the few places that
 * genuinely can't go async (Next.js `generateStaticParams`, page
 * metadata). This is the *fallback* catalog — the full curated catalog
 * (22 chat models) is loaded lazily via `loadModels()`.
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
// `GET /v1/models` count — 20 curated chat models (18 Venice + 2 OMA-AI).
// Keep in sync with `server/src/inference/models.ts` defaultCatalog().
export const MODEL_COUNT = 27;