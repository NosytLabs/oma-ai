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

export const LEGACY_CONVERSATION_KEY = "oma_chat_conversation";
export const LEGACY_SYSTEM_PROMPT_KEY = "oma_chat_system_prompt";
export const MAX_PERSISTED_MESSAGES = 80;

export function conversationStorageKey(userId: string | null | undefined): string {
	return userId ? `oma_chat_conversation:u:${userId}` : "oma_chat_conversation:guest";
}

export function systemPromptStorageKey(userId: string | null | undefined): string {
	return userId ? `oma_chat_system_prompt:u:${userId}` : "oma_chat_system_prompt:guest";
}

/** One-time copy of the pre-scoping key into the guest bucket only. */
export function migrateLegacyConversation(): void {
	if (typeof localStorage === "undefined") return;
	try {
		const guestKey = conversationStorageKey(null);
		if (localStorage.getItem(guestKey)) {
			localStorage.removeItem(LEGACY_CONVERSATION_KEY);
			return;
		}
		const legacy = localStorage.getItem(LEGACY_CONVERSATION_KEY);
		if (legacy) {
			localStorage.setItem(guestKey, legacy);
			localStorage.removeItem(LEGACY_CONVERSATION_KEY);
		}
		const guestPrompt = systemPromptStorageKey(null);
		if (!localStorage.getItem(guestPrompt)) {
			const lp = localStorage.getItem(LEGACY_SYSTEM_PROMPT_KEY);
			if (lp) localStorage.setItem(guestPrompt, lp);
		}
		localStorage.removeItem(LEGACY_SYSTEM_PROMPT_KEY);
	} catch {
		/* private mode */
	}
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
