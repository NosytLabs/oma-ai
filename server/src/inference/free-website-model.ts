/**
 * Models that may be used without credits on the public website chat.
 *
 * OMA sponsors a capped number of OpenBroker/Gonka requests on the website.
 * These still incur GNK provider costs; API-key requests are always billed.
 *
 * Eligibility is separate from availability. Catalog-paused models are
 * rejected and excluded from fallback chains even when listed here.
 * Requests share a bounded inference deadline and fall back only to enabled
 * free peers. Provider capacity and queueing remain upstream dependencies.
 *
 * NOTE: API-token callers (Authorization: Bearer oma_sk_*) ALWAYS pay
 * real credits, including for these models. Free usage is restricted to
 * the public /chat page for website sessions and signed-out visitors.
 *
 * Adding a model here explicitly sponsors its upstream inference costs.
 */
export const FREE_WEBSITE_MODEL_IDS = new Set([
	"deepseek-v4-flash-0731-openbroker", // OpenBroker DeepSeek V4 Flash (0731)
	"minimax-m2-7", //                    OpenBroker MiniMax M2.7
	"zai-org-glm-5-3", //                 OpenBroker GLM-5.3 Flash
]);

export function isFreeWebsiteModel(modelId: string): boolean {
	return FREE_WEBSITE_MODEL_IDS.has(modelId);
}
