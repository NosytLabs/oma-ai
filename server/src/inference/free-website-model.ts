/** Website chat is subsidized by OMA. OpenBroker consumes GNK; it is not free to operate.
 * API-key traffic always pays. Paused models remain identifiable as free-tier
 * choices for saved chats, but availability and request validation block use.
 */
export const FREE_WEBSITE_MODEL_IDS = new Set([
	"deepseek-v4-flash-0731-openbroker", // OpenBroker DeepSeek V4 Flash (0731)
	"minimax-m2-7", //                    OpenBroker MiniMax M2.7
	"zai-org-glm-5-3", //                 OpenBroker GLM-5.3 Flash
]);

export function isFreeWebsiteModel(modelId: string): boolean {
	return FREE_WEBSITE_MODEL_IDS.has(modelId);
}
