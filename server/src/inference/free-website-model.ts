/**
 * Models that may be used without credits on the public website chat.
 *
 * ONLY OpenBroker/Gonka-hosted models can be free — they have no upstream
 * cost. Verified live against api.openbroker.gonka.gg/v1/models, which
 * exposes exactly 3 serving models: MiniMaxAI/MiniMax-M2.7,
 * deepseek-ai/DeepSeek-V4-Flash-0731, and zai-org/GLM-5.3-Flash (curated
 * as `minimax-m2-7`, `deepseek-v4-flash-0731-openbroker`; GLM not yet
 * curated). A real OPENBROKER_API_KEY is configured.
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
]);

export function isFreeWebsiteModel(modelId: string): boolean {
	return FREE_WEBSITE_MODEL_IDS.has(modelId);
}
