/**
	* Model fallback map + chain builder + SSE model rewrite.
	* Extracted from proxy.ts so the router stays readable and tests can
	* import pure helpers without loading the full provider/billing stack.
	*/
import { getModelById } from "./models.js";

export const FALLBACK_MAP: Record<string, string[]> = {
		// Frontier
		"openai-gpt-56-sol": ["kimi-k3", "gemini-3.1-pro-preview", "gpt-4.1"],
		"gemini-3.1-pro-preview": [
				"gpt-4.1",
				"gpt-4o",
				"gemini-3-flash-preview",
				"openai-gpt-56-sol",
		],

		// Premium
		"kimi-k3": ["zai-org-glm-5-2", "kimi-k2-6"],
		"zai-org-glm-5-2": ["kimi-k3", "kimi-k2-6"],
		// OMA-AI OpenBroker Kimi — free peers first so freeOnly website chat can
		// leave a dead OpenBroker key without falling into paid Venice.
		"kimi-k2-6": [
				"minimax-m2-7",
				"gemini-3-flash-preview",
				"gpt-4o",
				"kimi-k3",
				"zai-org-glm-5-2",
		],
		"deepseek-v4-pro": ["qwen-3-8-max", "kimi-k3"],
		"qwen-3-8-max": ["deepseek-v4-pro", "kimi-k3"],
		"gpt-4.1": ["gpt-4o", "gemini-3.1-pro-preview", "gemini-3-flash-preview"],
		"gpt-4o": ["gpt-4.1", "gemini-3-flash-preview", "minimax-m2-7"],

		// Mid
		"llama-3.3-70b": ["qwen-3-7-plus", "zai-org-glm-5-1", "gpt-4o"],
		"zai-org-glm-5-1": ["qwen-3-7-plus", "llama-3.3-70b", "gemini-3-flash-preview"],
		"qwen-3-7-plus": ["zai-org-glm-5-1", "llama-3.3-70b", "gpt-4o"],
		"hermes-3-llama-3.1-405b": ["llama-3.3-70b", "qwen-3-7-plus"],

		// Budget
		"xiaomi-mimo-v2-5": ["gemini-3-flash-preview", "minimax-m2-7"],
		// OpenBroker MiniMax — free peers first (same freeOnly constraint as Kimi)
		"minimax-m2-7": [
				"gemini-3-flash-preview",
				"gpt-4o",
				"kimi-k2-6",
				"xiaomi-mimo-v2-5",
		],
		"deepseek-v4-flash-0731": [
				"deepseek-v4-flash-0731-openbroker",
				"minimax-m2-7",
				"xiaomi-mimo-v2-5",
				"mistral-small-2603",
		],
		// Venice budget — Gonka peers first so a dead VENICE_API_KEY still
		// fails over on the free website path.
		"mistral-small-2603": [
				"gemini-3-flash-preview",
				"minimax-m2-7",
				"deepseek-v4-flash-0731-openbroker",
				"deepseek-v4-flash-0731",
				"xiaomi-mimo-v2-5",
		],

		// OMA-AI free default — prefer oma-ai peers first, then budget Venice
		"gemini-3-flash-preview": [
				"gpt-4o",
				"minimax-m2-7",
				"gpt-4.1",
				"xiaomi-mimo-v2-5",
		],
};

/**
	* Build the ordered model chain: primary → client `models[]` → server map.
	* Dedupes and drops ids missing from the catalog. When `freeOnly` is set
	* (anonymous Gonka website chat), only Gonka Network openbroker-upstream
	* peers are allowed — Venice-routed and Zyloo-routed OMA-AI resale are
	* never attempted because they cost money.
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
