// Shared backend catalog supplies SSR prices, model pages, and metadata.
// The live API refreshes availability and administrative price overrides.

import catalogData from "../../../server/src/inference/model-catalog.json";

export type Tier = "budget" | "mid" | "premium" | "frontier";

/**
	* Canonical display order for the four pricing tiers. Used by the
	* /models listing, the /models/[slug] "related models" rail, and the
	* /docs available-models section so every surface renders tiers in the
	* same left-to-right order (cheapest → most capable).
	*/
export const TIER_ORDER: readonly Tier[] = ["budget", "mid", "premium", "frontier"];

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
	| "OMA-AI";

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
	maxOutputTokens?: number;
	extendedPricing?: { contextTokenThreshold: number; inputPricePer1M: number; outputPricePer1M: number };
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
	/**
	 * Whether this model can actually be called right now. The server sets
	 * `available: false` when the backing provider's API key is missing or a
	 * placeholder, so surfaces can flag it instead of advertising a model
	 * that will 503. Defaults to true when the field is absent (older
	 * cached payloads and the static fallback catalog omit it).
	 */
	available?: boolean;
	unavailableReason?: string;
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
	if (s.includes("venice")) return "Venice";
	return "OMA-AI";
}

/** Distinct providers actually surfaced in a list of models — used to
	*  build the provider filter chip row on /models without hard-coding. */
export function distinctProviders(models: readonly Model[]): Provider[] {
	const seen = new Set<Provider>();
	for (const m of models) seen.add(m.provider);
	return (["OMA-AI", "Venice"] as Provider[]).filter((p) =>
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
	disabledReason?: string;
	veniceId?: string;
	/** Raw provider model id when the public OMA id must stay URL-safe. */
	upstreamId?: string;
	provider: string;
	primaryProvider?: string;
	inputPricePer1M: number;
	outputPricePer1M: number;
	markupPercent?: number;
	category: Tier | string;
	maxTokens: number;
	maxOutputTokens?: number;
	extendedPricing?: Model["extendedPricing"];
	supportsStreaming?: boolean;
	displayName: string;
	capabilities: string[];
	description?: string;
	creditsPerMillionInput?: number;
	creditsPerMillionOutput?: number;
}

interface RawCatalog {
	MODEL_CATALOG: Record<string, RawEntry>;
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

	for (const capability of ["chat", "reasoning", "coding", "multimodal", "vision", "fast", "uncensored", "agents", "math"] as const) {
		if (capSet.has(capability)) out.add(capability);
	}
	if (capSet.has("video-input") || capSet.has("audio-input"))
		out.add("multimodal");
	if (capSet.has("tools") || capSet.has("function-calling") || capSet.has("function_calling")) out.add("agents");

	if (serverCaps === undefined) {
		out.add("chat");
		if (/uncensored|heretic/.test(haystack)) out.add("uncensored");
		if (/(?:^|[-_/])coder(?:[-_/]|$)|codex/.test(id.toLowerCase()))
			out.add("coding");
	}

	return [...out];
}

export interface ModelCapabilityMetadata {
	capabilities?: string[];
	supported_parameters?: string[];
	supports_tools?: boolean;
}

/** Share capability precedence between catalog cards and model details. */
export function resolveModelCapabilities(
	live: ModelCapabilityMetadata,
	fallback: readonly Capability[] = ["chat"],
): Capability[] {
	const capabilities = new Set<Capability>(
		live.capabilities !== undefined
			? deriveCapabilities("", "", undefined, live.capabilities)
			: fallback,
	);
	// Older APIs advertise supported parameters, not a complete capability
	// list. Keep curated facts they cannot express and add explicit signals.
	if (live.capabilities === undefined && live.supported_parameters) {
		const parameters = live.supported_parameters.map((parameter) =>
			parameter === "reasoning_effort" ? "reasoning" : parameter,
		);
		for (const capability of deriveCapabilities("", "", undefined, parameters)) {
			capabilities.add(capability);
		}
	}
	if (live.supports_tools === true) capabilities.add("agents");
	if (live.supports_tools === false) capabilities.delete("agents");
	return [...capabilities];
}

function deriveDescription(
	id: string,
	displayName: string,
	description: string | undefined,
	modality: Modality = "chat",
): string {
	const trimmed = (description ?? "").trim();
	if (trimmed) return trimmed;
	const label = MODALITY_LABELS[modality] ?? "language model";
	return `${displayName || id} — ${label.toLowerCase()} served by OMA.`;
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
	* without forking the SSR fallback. Keyed by lower-cased model id.
	*
 * DeepSeek V4 Flash exists twice in the catalog — once via Venice
 * (`deepseek-v4-flash-0731`, 50% markup) and once via OMA-AI/OpenBroker
 * (`deepseek-v4-flash-0731-openbroker`, fixed $0.02/M retail). Both share the same
	* upstream displayName ("DeepSeek V4 Flash"), which renders as an
	* indistinguishable duplicate on /pricing and /models. Disambiguate by
	* provider suffix.
	*/
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
	"deepseek-v4-flash-0731-openbroker": "DeepSeek V4 Flash (OMA-AI)",
	"deepseek-v4-flash-0731": "DeepSeek V4 Flash (Venice)",
};

/**
 * Re-exported for server / dashboard code that needs to resolve an upstream
 * model id to its customer-facing display name without re-implementing the
 * lookup. Keys are lower-cased upstream ids; values are the canonical
 * display names. Currently empty — kept here so dashboard-aggregate can
 * reference it without coupling to internal constants.
 */
export const MODEL_NAME_OVERRIDES: Record<string, string> = DISPLAY_NAME_OVERRIDES;

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
		maxOutputTokens: entry.maxOutputTokens,
		extendedPricing: entry.extendedPricing,
		inputPricePer1M: entry.inputPricePer1M,
		outputPricePer1M: entry.outputPricePer1M,
		capabilities: deriveCapabilities(entry.id, entry.displayName, entry.description, serverCaps),
		modelId: entry.upstreamId ?? entry.veniceId ?? entry.id,
		inputModalities: ["text"],
		outputModalities: ["text"],
		...(entry.disabledReason ? { available: false, unavailableReason: entry.disabledReason } : {}),
	};
}

/** Transform any raw upstream catalog shape into the public `Model[]`. */
function catalogFromRaw(catalog: RawCatalog): Model[] {
	return Object.values(catalog.MODEL_CATALOG).map(toModel);
}

// ---------------------------------------------------------------------------
// Lazy client loader
// ---------------------------------------------------------------------------

/** OpenAI-style models with OMA catalog metadata from GET /v1/models. */
interface ApiModelEntry extends ModelCapabilityMetadata {
	id: string;
	unavailable_reason?: string;
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
		extended?: { context_token_threshold: number; prompt: number; completion: number };
		/** Per-generation USD price for image/video/music/upscale/inpaint. */
		generation?: string;
		/** Per-second USD price for ASR. */
		audio_second?: string;
		/** Per-generation credits for image/video (R6+). */
		credits_per_generation?: number;
	};
	category: string;
	context_length: number | null;
	max_output_tokens?: number;
	/** Upstream routing target surfaced by /v1/models ("venice" | "oma-ai").
	 * Backends differ: OMA + Pollinations return `provider`, OpenRouter returns
	 * `owned_by`, etc. The loader picks whichever is present. */
	provider?: string;
	/** Video generation duration (e.g. "10s") for video models. */
	duration?: string;
	/**
	 * False when the backing provider's key is missing/placeholder, so the
	 * model 503s. See `Model.available`.
	 */
	available?: boolean;
	architecture?: { input_modalities?: string[]; output_modalities?: string[] };
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
		.catch(() => {
			// AUDIT 2026-09-27 / B-14: clear the in-flight promise so a later
			// call retries instead of reading the cached null forever. One
			// transient network loss used to pin the whole session to the
			// static SSR fallback with stale prices.
			_rawPromise = null;
			return null;
		});

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
						maxOutputTokens: entry.max_output_tokens,
						extendedPricing: entry.pricing.extended ? {
							contextTokenThreshold: entry.pricing.extended.context_token_threshold,
							inputPricePer1M: entry.pricing.extended.prompt,
							outputPricePer1M: entry.pricing.extended.completion,
						} : undefined,
						inputPricePer1M: inputPrice,
						outputPricePer1M: outputPrice,
						pricePerUnit: modality === "chat" ? undefined : (Number(entry.pricing?.generation) || Number(entry.pricing?.audio_second) || inputPrice),
						priceUnit: derivePriceUnit(modality, entry.pricing),
						capabilities:
							modality === "chat"
								? resolveModelCapabilities(entry, MODELS.find((model) => model.id === entry.id)?.capabilities)
								: [],
						modelId: entry.id,
						inputModalities: entry.architecture?.input_modalities ?? ["text"],
						outputModalities: entry.architecture?.output_modalities ?? ["text"],
						// Absent means "no signal" (older cache / static fallback),
						// which must read as available so a missing flag never hides
						// a working model.
						available: entry.available !== false,
						unavailableReason: entry.unavailable_reason,
					};
				});
			_liveModels = models;
			return models;
		} catch {
			// AUDIT 2026-09-27 / B-14: reset the promise so a later caller retries.
			_loadPromise = null;
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
	* server/src/inference/models.ts. Prices are USER-FACING per-1M rates
	* (Venice catalog rates × 1.5; OMA-AI prices already final), exactly
	* as returned by GET /v1/models.
	*/
// The same catalog supplies backend billing and the frontend's SSR fallback.
const FALLBACK_CATALOG: RawCatalog = {
	MODEL_CATALOG: Object.fromEntries(catalogData.map((entry) => {
		const factor = 1 + entry.markupPercent / 100;
		return [entry.id, {
			...entry,
			upstreamId: entry.omaAiId,
			maxTokens: entry.contextWindow,
			inputPricePer1M: entry.customerInputPricePer1M ?? entry.inputPricePer1M * factor,
			outputPricePer1M: entry.customerOutputPricePer1M ?? entry.outputPricePer1M * factor,
			extendedPricing: entry.extendedPricing ? {
				...entry.extendedPricing,
				inputPricePer1M: entry.extendedPricing.inputPricePer1M * factor,
				outputPricePer1M: entry.extendedPricing.outputPricePer1M * factor,
			} : undefined,
		}];
	})),
};

export const MODELS: Model[] = catalogFromRaw(FALLBACK_CATALOG);

export function formatPricePerMillion(pricePer1M: number): string {
	if (!Number.isFinite(pricePer1M)) return "—";
	if (pricePer1M <= 0) return "$0.00";
	// Preserve catalog rates instead of inventing a higher billing increment.
	return `$${pricePer1M.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 6,
	})}`;
}

/**
 * Cheapest catalog input rate across the static fallback catalog.
 *
 * Derived, never hardcoded, so every "from $X / 1M input tokens" anchor (hero,
 * stats strip, capabilities grid) reads this one value and cannot drift from
 * the real price list when the catalog changes.
 */
export const MIN_INPUT_PRICE = Math.min(
	...MODELS.map((m) => m.inputPricePer1M).filter((p) => p > 0),
);

/** Pre-formatted cheapest-input figure, e.g. `$0.15`. */
export const MIN_INPUT_PRICE_LABEL = formatPricePerMillion(MIN_INPUT_PRICE);

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

// Marketing counts derive from the shared catalog.
export const MODEL_COUNT = MODELS.length;
