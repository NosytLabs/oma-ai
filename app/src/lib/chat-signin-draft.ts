/** A one-time, tab-scoped draft handoff. Saved only by a sign-in action. */
const STORAGE_KEY = "oma_chat_signin_draft";
const MAX_AGE_MS = 15 * 60_000;

type ChatDraft = { model: string; input: string; userId: string | null };
interface ActiveDraftRegistration {
	source: () => ChatDraft;
	onSaved?: () => void;
}

let activeDraft: ActiveDraftRegistration | null = null;
const modelListeners = new Set<() => void>();

export function getActiveChatSignInModel(): string | null {
	return activeDraft?.source().model ?? null;
}

export function subscribeChatSignInModel(listener: () => void): () => void {
	modelListeners.add(listener);
	return () => { modelListeners.delete(listener); };
}

/** Lets navbar sign-in inspect and save the mounted chat without mutating it. */
export function registerChatSignInDraft(
	source: () => ChatDraft,
	onSaved?: () => void,
): () => void {
	const registration = { source, onSaved };
	activeDraft = registration;
	modelListeners.forEach((listener) => listener());
	return () => {
		if (activeDraft !== registration) return;
		activeDraft = null;
		modelListeners.forEach((listener) => listener());
	};
}

export function saveChatDraftForSignIn(returnModel?: string): void {
	const registration = activeDraft;
	if (!registration) return;
	const draft = registration.source();
	try {
		if (typeof sessionStorage === "undefined") return;
		if (!draft.input.trim()) {
			sessionStorage.removeItem(STORAGE_KEY);
			return;
		}
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
			...draft,
			model: returnModel ?? draft.model,
			createdAt: Date.now(),
		}));
		registration.onSaved?.();
	} catch {
		// Storage may be unavailable in private browsing; sign-in still works.
	}
}

/** Remove even rejected records so a later model/account switch cannot revive them. */
export function consumeChatSignInDraft(model: string, userId: string | null): string | null {
	try {
		if (typeof sessionStorage === "undefined") return null;
		const raw = sessionStorage.getItem(STORAGE_KEY);
		sessionStorage.removeItem(STORAGE_KEY);
		if (!raw) return null;
		const saved: unknown = JSON.parse(raw);
		if (!saved || typeof saved !== "object") return null;
		const draft = saved as Record<string, unknown>;
		if (typeof draft.input !== "string" || !draft.input.trim() || draft.model !== model ||
			(draft.userId !== null && typeof draft.userId !== "string") ||
			typeof draft.createdAt !== "number" || !Number.isFinite(draft.createdAt)) return null;
		const age = Date.now() - draft.createdAt;
		if (age < 0 || age > MAX_AGE_MS) return null;
		// A guest draft intentionally follows the first sign-in. An existing
		// account's reauthentication draft must stay with that same account.
		if (draft.userId !== null && draft.userId !== userId) return null;
		return draft.input;
	} catch {
		return null;
	}
}
