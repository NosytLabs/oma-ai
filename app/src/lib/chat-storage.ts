/**
 * Playground conversation storage.
 *
 * ChatGPT / Claude keep threads server-side per account. OMA's playground
 * is local-only — so the key MUST be scoped per identity. A shared
 * `oma_chat_conversation` key leaked guest threads into signed-in
 * sessions (and vice versa) on the same browser.
 *
 * localStorage stays the store (one JSON blob, ~5 MB cap). Writes are
 * capped + QuotaExceeded trims oldest turns. IndexedDB is the next step
 * if threads grow past that — not needed for a single playground thread.
 */

export const MAX_PERSISTED_MESSAGES = 80;

export function conversationStorageKey(userId: string | null | undefined): string {
	return userId ? `oma_chat_conversation:u:${userId}` : "oma_chat_conversation:guest";
}

export function systemPromptStorageKey(userId: string | null | undefined): string {
	return userId ? `oma_chat_system_prompt:u:${userId}` : "oma_chat_system_prompt:guest";
}

export function persistMessages(key: string, messages: unknown[]): boolean {
	if (typeof localStorage === "undefined") return false;
	const capped = messages.length > MAX_PERSISTED_MESSAGES
		? messages.slice(-MAX_PERSISTED_MESSAGES)
		: messages;
	try {
		localStorage.setItem(key, JSON.stringify(capped));
		return true;
	} catch {
		const trimmed = capped.slice(-Math.max(20, Math.floor(capped.length / 2)));
		try {
			localStorage.setItem(key, JSON.stringify(trimmed));
			return true;
		} catch {
			return false;
		}
	}
}