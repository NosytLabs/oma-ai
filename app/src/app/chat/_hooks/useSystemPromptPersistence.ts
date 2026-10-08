"use client";

import {
	useEffect,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { log } from "@/lib/logger";

const DEFAULT_SYSTEM_PROMPT_KEY = "oma_chat_system_prompt";

interface UseSystemPromptPersistenceOptions {
	systemPrompt: string;
	setSystemPrompt: Dispatch<SetStateAction<string>>;
	setSystemPromptOpen: Dispatch<SetStateAction<boolean>>;
	systemPromptKey?: string;
	/** Skip hydration and writes until the authentication identity is known. */
	enabled?: boolean;
}

interface PromptSession {
	key: string;
	canPersist: boolean;
}

/** Persists system instructions in the current account's storage bucket. */
export function useSystemPromptPersistence({
	systemPrompt,
	setSystemPrompt,
	setSystemPromptOpen,
	systemPromptKey = DEFAULT_SYSTEM_PROMPT_KEY,
	enabled = true,
}: UseSystemPromptPersistenceOptions): void {
	const [promptSession, setPromptSession] = useState<PromptSession | null>(null);

	useEffect(() => {
		if (!enabled || typeof localStorage === "undefined") return;
		try {
			const storedPrompt = localStorage.getItem(systemPromptKey) ?? "";
			setSystemPrompt(storedPrompt);
			setSystemPromptOpen(Boolean(storedPrompt));
			setPromptSession({ key: systemPromptKey, canPersist: true });
		} catch (error) {
			// Never keep another identity's instructions active when this bucket
			// is unreadable. Persistence remains disabled, so the unreadable value
			// is not overwritten by the cleared UI state.
			setSystemPrompt("");
			setSystemPromptOpen(false);
			setPromptSession({ key: systemPromptKey, canPersist: false });
			log.warn("Failed to hydrate system prompt from storage", error);
		}
	}, [enabled, setSystemPrompt, setSystemPromptOpen, systemPromptKey]);

	useEffect(() => {
		if (
			!enabled ||
			!promptSession?.canPersist ||
			promptSession.key !== systemPromptKey ||
			typeof localStorage === "undefined"
		) {
			return;
		}
		try {
			if (systemPrompt) {
				localStorage.setItem(systemPromptKey, systemPrompt);
			} else {
				localStorage.removeItem(systemPromptKey);
			}
		} catch (error) {
			log.warn("Failed to persist system prompt", error);
		}
	}, [enabled, promptSession, systemPrompt, systemPromptKey]);
}
