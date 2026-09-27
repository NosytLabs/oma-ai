/**
 * Models that may be used without credits on the public website chat.
 *
 * ONLY OpenBroker/Gonka-hosted models can be free — they have no upstream
 * cost. A real OPENBROKER_API_KEY is configured.
 *
 * 2026-09-26: M2.7 + GLM-5.3 sticky-503 dead, pool briefly ONE deep.
 * 2026-09-27 re-verification: BOTH recovered (live POSTs finish_reason=stop,
 * real content). Free pool is three models deep again. Default stays GLM-5.3 —
 * DeepSeek's OpenBroker loop-degeneration note below still stands.
 *
 * Treat OpenBroker availability as a guest-chat dependency: if all three ids
 * die together, the free path fails fast and cleanly (ProviderError after
 * freeOnly's 1 retry). No hang, no empty-200, no quota burn.
 *
 * NOTE: API-token callers (Authorization: Bearer oma_sk_*) ALWAYS pay
 * real credits, including for these models. Free usage is restricted to
 * the public /chat page for signed-out visitors.
 *
 * Do NOT add a paid model (Venice-routed, or any with non-zero upstream
 * cost) here — that would silently cost the operator on every guest
 * message.
 */
export const FREE_WEBSITE_MODEL_IDS = new Set([
	"deepseek-v4-flash-0731-openbroker", // OpenBroker DeepSeek V4 Flash (0731)
	"minimax-m2-7", //                    OpenBroker MiniMax M2.7
	"zai-org-glm-5-3", //                 OpenBroker GLM-5.3 Flash
]);

export function isFreeWebsiteModel(modelId: string): boolean {
	return FREE_WEBSITE_MODEL_IDS.has(modelId);
}
