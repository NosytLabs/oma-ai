/**
 * Shared model-name humanization utilities.
 *
 * Used by both ChatMessage (live model display) and ModelSelector
 * (dropdown labels) so the two surfaces stay visually consistent.
 */

import { MODELS, normalizeProvider } from "@/lib/models-data";
import type { ModelOption } from "@/lib/types/model";

/**
 * Default free website-chat model. Must be provider=oma-ai on the server
 * (`isFreeWebsiteModel` in server/src/routes/chat) — Venice ids require auth.
 */
export const FREE_DEFAULT_CHAT_MODEL = "gemini-3-flash-preview";

/**
 * Known free catalog ids (provider=oma-ai). Keep in sync with live
 * GET /v1/models where provider === "oma-ai". Mirrors server-side
 * `isFreeWebsiteModel` (server/src/routes/chat) — ids listed here must
 * resolve to provider=oma-ai on the server, otherwise anonymous website
 * chat gets 401'd for a "free" model.
 */
export const FREE_CHAT_MODEL_IDS = new Set([
	"gemini-3.1-pro-preview",
	"gemini-3-flash-preview",
	"gpt-4.1",
	"gpt-4o",
	"kimi-k2-6",
	"minimax-m2-7",
]);

/** Canonical model id for docs / marketing code samples (paid Venice path). */
export const DOCS_EXAMPLE_MODEL = "llama-3.3-70b";

/**
 * Live-API display-name overrides. The upstream `/v1/models` endpoint returns
 * low-quality names for some entries (e.g. "Google Gemini 3" instead of "Gemini 3 Flash").
 * This map canonicalises them on the client without touching the server
 * catalog.
 */
const LIVE_DISPLAY_NAME_OVERRIDES: Record<string, string> = {};

/**
 * Pick the canonical display name for a model coming from the live API.
 * Used by `mapLiveModel` so the chat dropdown shows the right name even when
 * the upstream server is stale.
 */
function liveDisplayName(
	id: string,
	rawName: string | undefined,
): string | undefined {
	const override = LIVE_DISPLAY_NAME_OVERRIDES[id.toLowerCase()];
	if (override) return override;
	return rawName?.trim() || undefined;
}

/**
 * Whether the website chat may call completions without sign-in / API key.
 * Free OMA-AI models are resold cheaply enough to offer as guest chat.
 */
export function isFreeChatModel(
	modelId: string,
	provider?: ModelOption["provider"] | string | null,
): boolean {
	if (FREE_CHAT_MODEL_IDS.has(modelId)) return true;
	const p = typeof provider === "string" ? normalizeProvider(provider) : provider;
	// OMA-AI (own routing) and OMA-AI/OpenBroker (ultra-low-cost) models are
	// free at the chat surface; Venice / Surplus are paid.
	return p === "OMA-AI";
}

// ---------------------------------------------------------------------------
// Friendly-name lookup — maps raw model IDs from the static catalog to
// their human-readable names (e.g. "llama-3.2-3b" → "Llama 3.2 3B").
// ---------------------------------------------------------------------------
const FRIENDLY_NAME: Record<string, string> = Object.fromEntries(
	MODELS.map((m) => [m.id, m.name]),
);

// Override map layered ON TOP of FRIENDLY_NAME so model-name fixes don't have
// to wait for a server-side catalog redeploy. Anything in this map wins over
// both the static fallback name and the upstream `display_name`.
const NAME_OVERRIDES: Record<string, string> = {};

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
 * The NAME_OVERRIDES map is the highest-priority source — used to canonicalise
 * model names whose upstream `display_name` is wrong without touching the
 * server catalog.
 */
export function displayName(id: string, fallback?: string): string {
	return (
		NAME_OVERRIDES[id.toLowerCase()] ??
		FRIENDLY_NAME[id] ??
		(fallback && fallback !== id ? fallback : humanizeModelId(id))
	);
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
		inputPer1M: m.pricing?.prompt
			? parseFloat(m.pricing.prompt)
			: 0,
		outputPer1M: m.pricing?.completion
			? parseFloat(m.pricing.completion)
			: 0,
		ctx: m.context_length ? formatCtx(m.context_length) : "128K",
	};
}
