/**
 * Model fallback map + chain builder + SSE model rewrite.
 * Extracted from proxy.ts so the router stays readable and tests can
 * import pure helpers without loading the full provider/billing stack.
 */
import { getModelById } from "./models.js";

export const FALLBACK_MAP: Record<string, string[]> = {
	// Frontier
	"openai-gpt-56-sol": ["kimi-k3", "deepseek-v4-flash-0731-openbroker", "minimax-m2-7"],
	"claude-opus-5": ["claude-sonnet-4-6", "kimi-k3", "grok-4-5"],
	"claude-sonnet-4-6": ["kimi-k3", "grok-4-5", "zai-org-glm-5-2"],
	"grok-4-5": ["kimi-k3", "claude-sonnet-4-6", "deepseek-v4-flash-0731-openbroker"],

	// Premium
	"kimi-k3": ["zai-org-glm-5-2", "minimax-m2-7", "deepseek-v4-flash-0731-openbroker"],
	"zai-org-glm-5-2": ["kimi-k3", "minimax-m2-7", "deepseek-v4-flash-0731-openbroker"],
	// (kimi-k2-6 removed 2026-09-05 — OpenBroker dropped it from the active set.
	// The two remaining OMA-AI peers below cover the same role.)
	"deepseek-v4-pro": ["qwen-3-8-max", "kimi-k3"],
	"qwen-3-8-max": ["deepseek-v4-pro", "kimi-k3"],

	// Mid
	"llama-3.3-70b": ["qwen-3-7-plus", "zai-org-glm-5-1"],
	"zai-org-glm-5-1": ["qwen-3-7-plus", "llama-3.3-70b"],
	"qwen-3-7-plus": ["zai-org-glm-5-1", "llama-3.3-70b"],
	"hermes-3-llama-3.1-405b": ["llama-3.3-70b", "qwen-3-7-plus"],

	// Mid / Venice-only that previously had no chain
	"gemini-3-6-flash": ["deepseek-v4-flash-0731-openbroker", "minimax-m2-7", "xiaomi-mimo-v2-5"],
	"google-gemma-4-31b-it": ["mistral-small-2603", "deepseek-v4-flash-0731-openbroker", "xiaomi-mimo-v2-5"],
	"venice-uncensored-1-2": ["mistral-small-2603", "llama-3.3-70b", "xiaomi-mimo-v2-5"],

	// Budget
	"xiaomi-mimo-v2-5": ["deepseek-v4-flash-0731-openbroker", "minimax-m2-7"],
	// OpenBroker MiniMax — free peers first (freeOnly website chat stays on openbroker)
	"minimax-m2-7": [
		"deepseek-v4-flash-0731-openbroker",
		"xiaomi-mimo-v2-5",
		"mistral-small-2603",
	],
	"deepseek-v4-flash-0731": [
		"deepseek-v4-flash-0731-openbroker",
		"minimax-m2-7",
		"xiaomi-mimo-v2-5",
		"mistral-small-2603",
	],
	// OpenBroker default — prefer oma-ai peers first, then budget Venice
	"deepseek-v4-flash-0731-openbroker": [
		"minimax-m2-7",
		"xiaomi-mimo-v2-5",
		"mistral-small-2603",
	],
	// Venice budget — Gonka peers first so a dead VENICE_API_KEY still
	// fails over on the free website path.
	"mistral-small-2603": [
		"deepseek-v4-flash-0731-openbroker",
		"minimax-m2-7",
		"deepseek-v4-flash-0731",
		"xiaomi-mimo-v2-5",
	],
};

/**
 * Build the ordered model chain: primary → client `models[]` → server map.
 * Dedupes and drops ids missing from the catalog. When `freeOnly` is set
 * (anonymous Gonka website chat), only Gonka Network openbroker-upstream
 * peers are allowed — Venice-routed OMA-AI resale is never attempted
 * because it costs money. (Pre-2026-08-17 this also blocked Zyloo-routed
 * OMA-AI resale; Zyloo has since been removed entirely.)
 */
export function buildFallbackChain(
	primary: string,
	clientFallbacks: string[] = [],
	freeOnly = false,
): string[] {
	const serverPeers = FALLBACK_MAP[primary] ?? [];
	const ordered = [primary, ...clientFallbacks, ...serverPeers];
	const seen = new Set<string>();
	const chain: string[] = [];
	for (const id of ordered) {
		if (!id || seen.has(id)) continue;
		const def = getModelById(id);
		if (!def) continue;
		// Keep the requested primary even if it is Venice — failover
		// peers after it must still be Gonka/openbroker on the free path.
		if (freeOnly && id !== primary && def.upstream !== "openbroker") continue;
		seen.add(id);
		chain.push(id);
	}
	return chain.length > 0 ? chain : [primary];
}

/**
 * OpenRouter-style: rewrite `model` in SSE `data:` lines so clients always
 * see the OMA catalog id that actually served the request (after failover).
 * Leaves non-JSON / [DONE] lines untouched. Best-effort — malformed lines pass through.
 */
export function rewriteSseModelField(
	chunkText: string,
	actualModelId: string,
): string {
	if (!chunkText.includes("data:") || !actualModelId) return chunkText;
	return chunkText
		.split("\n")
		.map((line) => {
			if (!line.startsWith("data:")) return line;
			const payload = line.slice(5).trim();
			if (!payload || payload === "[DONE]") return line;
			try {
				const obj = JSON.parse(payload) as Record<string, unknown>;
				if (obj && typeof obj === "object" && obj.model !== actualModelId) {
					obj.model = actualModelId;
					return `data: ${JSON.stringify(obj)}`;
				}
			} catch {
				// pass through
			}
			return line;
		})
		.join("\n");
}
