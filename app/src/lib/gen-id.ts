/**
 * Unique conversation IDs. UUID when available (crypto.randomUUID is
 * supported in all modern browsers and secure contexts); falls back to a
 * time+random composite otherwise.
 */
export function genConversationId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}