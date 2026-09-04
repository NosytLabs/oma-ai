/**
 * Models that may be used without credits on the public website chat.
 * Keep this allowlist as the single source of truth for access and quotas.
 */
export const FREE_WEBSITE_MODEL_IDS = new Set([
	"deepseek-v4-flash-0731-openbroker",
	"gemini-3-flash-preview",
	"kimi-k2-6",
	"minimax-m2-7",
	// Venice fallback keeps the public playground available during upstream issues.
	"mistral-small-2603",
]);

export function isFreeWebsiteModel(modelId: string): boolean {
	return FREE_WEBSITE_MODEL_IDS.has(modelId);
}
