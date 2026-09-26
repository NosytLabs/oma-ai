/**
 * Models that may be used without credits on the public website chat.
 *
 * ONLY OpenBroker/Gonka-hosted models can be free — they have no upstream
 * cost. A real OPENBROKER_API_KEY is configured.
 *
 * 2026-09-26 re-verification — the free pool is now ONE model deep.
 * api.openbroker.gonka.gg/v1/models still lists three ids, but only
 * deepseek-ai/DeepSeek-V4-Flash-0731 actually serves inference.
 * minimax-m2-7 and zai-org-glm-5-3 both return a fast, sticky 503
 * "temporarily unavailable" (8/8 across 4s-spaced retries — not congestion,
 * not 429 rate limiting) and produced 0.000 GNK across a 300-request usage
 * window at 60-67% failure. Both are marked `upstream: undefined` in
 * models.ts, which is the non-routable marker buildFallbackChain filters on.
 *
 * CONSEQUENCE: guest chat has a single free backend. If OpenBroker drops
 * DeepSeek, the free path fails — but it fails FAST and cleanly: the router
 * gives freeOnly 1 retry, then throws ProviderError ("Inference provider
 * temporarily unavailable"). No hang, no empty-200, no quota burn. There is no
 * second free provider because `freeOnly` exists precisely to keep paid
 * Venice models out of the guest path; adding one would break that promise.
 * Treat OpenBroker availability as a guest-chat dependency.
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
