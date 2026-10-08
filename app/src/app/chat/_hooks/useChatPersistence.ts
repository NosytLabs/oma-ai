"use client";

import {
	useEffect,
	useState,
	type Dispatch,
	type RefObject,
	type SetStateAction,
} from "react";
import type { Message } from "@/components/chat";
import { log } from "@/lib/logger";

const DEFAULT_SYSTEM_PROMPT_KEY = "oma_chat_system_prompt";

interface UseChatPersistenceOptions {
	messages: Message[];
	systemPrompt: string;
	setSystemPrompt: Dispatch<SetStateAction<string>>;
	setSystemPromptOpen: Dispatch<SetStateAction<boolean>>;
	messagesRef: RefObject<Message[]>;
	systemPromptKey?: string;
	/** Skip hydration and writes until the authentication identity is known. */
	enabled?: boolean;
}

interface PromptSession {
	key: string;
	canPersist: boolean;
}

/**
	* Persists the account-scoped system prompt and keeps the streaming message
	* ref current. Conversation messages are owned solely by
	* `useConversationHistory`, which prevents competing storage effects.
	*/
export function useChatPersistence({
	messages,
	systemPrompt,
	setSystemPrompt,
	setSystemPromptOpen,
	messagesRef,
	systemPromptKey = DEFAULT_SYSTEM_PROMPT_KEY,
	enabled = true,
}: UseChatPersistenceOptions): void {
	const [promptSession, setPromptSession] = useState<PromptSession | null>(null);

	useEffect(() => {
		messagesRef.current = messages;
	}, [messages, messagesRef]);

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
