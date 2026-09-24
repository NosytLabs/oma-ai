/**
	* Shared model-name humanization utilities.
	*
	* Used by both ChatMessage (live model display) and ModelSelector
	* (dropdown labels) so the two surfaces stay visually consistent.
	*/

import { MODELS, normalizeProvider } from "@/lib/models-data";
import type { ModelOption } from "@/lib/types/model";
import { isModelAvailable } from "@/lib/model-availability";

/**
 * Free catalog ids (upstream=openbroker — OMA-AI on Gonka.AI).
 * Mirrors server-side logic in `server/src/inference/free-website-model.ts`.
 * Only zero-upstream-cost OpenBroker models qualify as free in /chat.
 */
export const FREE_CHAT_MODEL_IDS = new Set<string>([
	"minimax-m2-7",
	"deepseek-v4-flash-0731-openbroker",
]);

/**
 * Default free website-chat model. Backed by OMA-AI's Gonka.AI upstream
 * (DeepSeek V4 Flash) — see catalog entry in models.ts.
 */
export const FREE_DEFAULT_CHAT_MODEL = "deepseek-v4-flash-0731-openbroker";

export const FREE_TIER_LABELS: Record<string, { label: string; tooltip: string }> = {
	"minimax-m2-7": {
		label: "Free",
		tooltip: "MiniMax M2.7 — OMA-AI. Free in website chat; API calls billed.",
	},
	"deepseek-v4-flash-0731-openbroker": {
		label: "Free",
		tooltip: "DeepSeek V4 Flash — OMA-AI. Free in website chat; API calls billed.",
	},
};

/** Canonical model id for docs / marketing code samples (paid Venice path). */
export const DOCS_EXAMPLE_MODEL = "llama-3.3-70b";

/**
	* Pick the canonical display name for a model coming from the live API.
	* Used by `mapLiveModel` so the chat dropdown shows the right name even when
	* the upstream server is stale.
	*/
function liveDisplayName(
	id: string,
	rawName: string | undefined,
): string | undefined {
	// Reserved for future client-side canonicalisation overrides when the
	// upstream `display_name` is wrong (e.g. "Google Gemini 3" instead of
	// the truthful upstream label). The per-model patch point lives here.
	return rawName?.trim() || undefined;
}

/**
	* Whether the website chat may call completions without sign-in / API key.
	* Only OMA-AI / Gonka.AI (openbroker upstream) models are free in /chat
	* and /playground. Everything else (Venice + paid OMA-AI resale) is paid.
	*/
export function isFreeChatModel(
	modelId: string,
	_provider?: ModelOption["provider"] | string | null,
): boolean {
	if (FREE_CHAT_MODEL_IDS.has(modelId)) return true;
	return false;
}

// ---------------------------------------------------------------------------
// Friendly-name lookup — maps raw model IDs from the static catalog to
// their human-readable names (e.g. "llama-3.2-3b" → "Llama 3.2 3B").
// ---------------------------------------------------------------------------
const FRIENDLY_NAME: Record<string, string> = Object.fromEntries(
	MODELS.map((m) => [m.id, m.name]),
);

// Parts that should stay uppercase (size specifiers, fine-tune tags, etc.)
const RETAIN_UPPER = new Set([
	"2b",
	"3b",
	"7b",
	"8b",
	"12b",
	"13b",
	"32b",
	"70b",
	"405b",
	"instruct",
	"chat",
	"base",
	"it",
	"ft",
]);

/**
	* Convert a raw model ID to a human-friendly display name.
	*
	* Strips common provider prefixes (`openai/`, `minimax/`, etc.),
	* splits on `-`, and title-cases each part while preserving known
	* uppercase patterns like "32B" and "Instruct".
	*
	* Examples:
	*   "claude-3-5-sonnet"          → "Claude 3 5 Sonnet"
	*   "gpt-4o"                     → "Gpt 4o"
	*   "openai/gpt-4o"              → "Gpt 4o"
	*   "qwen-2.5-coder-32b-instruct" → "Qwen 2.5 Coder 32B Instruct"
	*/
function humanizeModelId(id: string): string {
	// Strip well-known provider prefixes
	const stripped = id.replace(/^(openai|minimax|together|deepinfra)\//i, "");

	return stripped
		.split("-")
		.map((part) => {
			const lower = part.toLowerCase();
			if (RETAIN_UPPER.has(lower)) return lower.toUpperCase();
			// Keep digit-letter runs together: "2.5" stays "2.5", "4o" stays "4o"
			if (
				/^[a-z0-9.]+$/i.test(part) &&
				/\d/.test(part) &&
				/[a-z]/i.test(part)
			) {
				return part.replace(/^([a-z])/i, (c) => c.toUpperCase());
			}
			return part.charAt(0).toUpperCase() + part.slice(1);
		})
		.join(" ");
}

/**
	* Resolve a display name for a model: prefer the static catalog name,
	* fall back to a provided `fallback`, and ultimately humanize the raw ID.
	* Per-model overrides can be layered on top here when upstream `display_name`
	* is wrong without touching the server catalog.
	*/
export function displayName(id: string, fallback?: string): string {
	return (
		FRIENDLY_NAME[id] ??
		(fallback && fallback !== id ? fallback : humanizeModelId(id))
	);
}

/**
 * Compact display name for width-capped surfaces (toolbar pill, badges).
 * Strips the trailing provider disambiguator the catalog appends to
 * same-family models — e.g. "DeepSeek V4 Flash (OMA-AI)" → "DeepSeek V4
 * Flash". The full name stays in dropdown rows and `title` tooltips so
 * no information is lost where space allows.
 */
export function shortDisplayName(id: string, fallback?: string): string {
	return displayName(id, fallback).replace(/\s*\([^()]*\)\s*$/, "");
}

// ---------------------------------------------------------------------------
// Live-model mapping — converts raw API response objects into the
// ModelOption shape consumed by the UI.  Lives here (not in ChatMessage)
// so both ChatMessage and ModelSelector can share the humanization logic
// without creating a circular import.
// ---------------------------------------------------------------------------

export interface LiveModelRaw {
	id: string;
	display_name?: string;
	category?: string;
	context_length?: number;
	provider?: string;
	/** false when the provider's API key is missing/placeholder server-side */
	available?: boolean;
	/** Modality bucket — "chat", "image", "video", etc. */
	modality?: string;
	pricing?: { prompt?: string; completion?: string };
}

function formatCtx(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
	if (n >= 1000) return `${Math.round(n / 1000)}K`;
	return `${n}`;
}

/**
	* Map a raw live-model object from the `/v1/models` API to a `ModelOption`.
	*/
export function mapLiveModel(m: LiveModelRaw): ModelOption {
	const validCats: ModelOption["category"][] = [
		"frontier",
		"premium",
		"mid",
		"budget",
		"reasoning",
		"coding",
		"uncensored",
	];
	const cat = validCats.includes(m.category as ModelOption["category"])
		? (m.category as ModelOption["category"])
		: "mid";
	const provider: ModelOption["provider"] =
		normalizeProvider(m.provider);

	return {
		id: m.id,
		name: liveDisplayName(m.id, m.display_name) || humanizeModelId(m.id),
		category: cat,
		provider,
		available: isModelAvailable(m),
		inputPer1M: m.pricing?.prompt
			? parseFloat(m.pricing.prompt)
			: 0,
		outputPer1M: m.pricing?.completion
			? parseFloat(m.pricing.completion)
			: 0,
		ctx: m.context_length ? formatCtx(m.context_length) : "128K",
	};
}
