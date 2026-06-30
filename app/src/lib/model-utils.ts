/**
 * Shared model-name humanization utilities.
 *
 * Used by both ChatMessage (live model display) and ModelSelector
 * (dropdown labels) so the two surfaces stay visually consistent.
 */

import { MODELS } from "@/lib/models-data";
import type { ModelOption } from "@/lib/types/model";

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
 */
export function displayName(id: string, fallback?: string): string {
	return (
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
		m.provider === "AntSeed" ? "AntSeed" : "Venice";

	return {
		id: m.id,
		name: humanizeModelId(m.id),
		category: cat,
		provider,
		inputPer1M: m.pricing?.prompt
			? parseFloat(m.pricing.prompt) * 1_000_000
			: 0,
		outputPer1M: m.pricing?.completion
			? parseFloat(m.pricing.completion) * 1_000_000
			: 0,
		ctx: m.context_length ? formatCtx(m.context_length) : "128K",
	};
}
