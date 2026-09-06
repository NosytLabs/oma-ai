/**
 * Models that may be used without credits on the public website chat.
 *
 * ONLY OpenBroker/Gonka-hosted models can be free — they have no upstream
 * cost. Verified live against api.openbroker.gonka.gg/v1/models, which
 * currently returns exactly 2 serving models: MiniMaxAI/MiniMax-M2.7 and
 * deepseek-ai/DeepSeek-V4-Flash-0731 (curated as
 * `deepseek-v4-flash-0731-openbroker`). Kimi-K2.6 was dropped from OpenBroker.
 *
 * NOTE: API-token callers (Authorization: Bearer oma_sk_*) ALWAYS pay
 * real credits, including for these models. Free usage is restricted to
 * the public /chat page for signed-out visitors.
 *
 * Keep this list in sync with the OpenBroker catalog — adding a Venice-routed
 * model here would silently cost the operator money on every guest message.
 */
export const FREE_WEBSITE_MODEL_IDS = new Set([
	"deepseek-v4-flash-0731-openbroker", // OpenBroker DeepSeek V4 Flash (0731)
	"minimax-m2-7",                    // OpenBroker MiniMax M2.7
]);

export function isFreeWebsiteModel(modelId: string): boolean {
	return FREE_WEBSITE_MODEL_IDS.has(modelId);
}
