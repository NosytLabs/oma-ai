/**
 * Models that may be used without credits on the public website chat.
 *
 * ONLY OpenBroker/Gonka-hosted models can be free — they have no upstream
 * cost. Verified live against api.openbroker.gonka.gg/v1/models, which
 * currently returns exactly 3 models: minimax-m2-7, kimi-k2-6, and
 * deepseek-ai/DeepSeek-V4-Flash-0731 (the latter exposed to users under
 * the curated id `deepseek-v4-flash-openbroker` and `deepseek-v4-flash-0731-openbroker`).
 *
 * Keep this list in sync with the OpenBroker catalog — adding a Venice-routed
 * model here would silently cost the operator money on every guest message.
 */
export const FREE_WEBSITE_MODEL_IDS = new Set([
	"deepseek-v4-flash-openbroker",          // OpenBroker DeepSeek V4 Flash, 0 markup
	"deepseek-v4-flash-0731-openbroker", // OpenBroker DeepSeek V4 Flash (direct)
	"kimi-k2-6",                       // OpenBroker Kimi K2.6
	"minimax-m2-7",                    // OpenBroker MiniMax M2.7
]);

export function isFreeWebsiteModel(modelId: string): boolean {
	return FREE_WEBSITE_MODEL_IDS.has(modelId);
}
