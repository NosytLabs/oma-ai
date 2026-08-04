"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { Message } from "@/components/chat";
import { log } from "@/lib/logger";

const STORAGE_KEY = "oma_chat_conversation";
const DEFAULT_SYSTEM_PROMPT_KEY = "oma_chat_system_prompt";

export interface UseChatPersistenceOptions {
	messages: Message[];
	setMessages: Dispatch<SetStateAction<Message[]>>;
	systemPrompt: string;
	setSystemPrompt: Dispatch<SetStateAction<string>>;
	setSystemPromptOpen: Dispatch<SetStateAction<boolean>>;
	messagesRef: RefObject<Message[]>;
	/** Override the conversation localStorage key. Defaults to `oma_chat_conversation`. */
	storageKey?: string;
	/** Override the system-prompt localStorage key. Defaults to `oma_chat_system_prompt`. */
	systemPromptKey?: string;
}

/**
 * Conversation + system prompt persistence.
 *
 * On mount: hydrate `messages` from localStorage (only if a non-empty array
 * is present) and reopen the system prompt panel if a prompt was stored.
 *
 * On change: write `systemPrompt` to localStorage (delete on empty), and
 * debounce-write `messages` to localStorage on a 2s window so a long
 * conversation survives a reload without thrashing storage on every
 * streaming token. The 2s timer is cancelled on unmount and on the next
 * change so the last write still wins.
 *
 * Also mirrors `messages` to `messagesRef` so non-React readers (the SSE
 * loop inside `useStreamingChat`) see the latest list without re-binding.
 */
export function useChatPersistence({
	messages,
	setMessages,
	systemPrompt,
	setSystemPrompt,
	setSystemPromptOpen,
	messagesRef,
	storageKey = STORAGE_KEY,
	systemPromptKey = DEFAULT_SYSTEM_PROMPT_KEY,
}: UseChatPersistenceOptions): void {
	useEffect(() => {
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed) && parsed.length > 0) {
					// Validate each message conforms to the Message interface.
					// Strip malformed entries so corrupted localStorage doesn't crash the app.
					const valid = (parsed as unknown[]).filter((m): m is Message => {
						if (!m || typeof m !== "object") return false;
						const obj = m as Record<string, unknown>;
						return (
							typeof obj.role === "string" &&
							(obj.role === "user" ||
								obj.role === "assistant" ||
								obj.role === "system") &&
							typeof obj.content === "string" &&
							typeof obj.timestamp === "number"
						);
					});
					if (valid.length > 0) {
						setMessages(valid);
					}
				}
			} catch {}
		}
		const storedPrompt = localStorage.getItem(systemPromptKey);
		if (storedPrompt) {
			setSystemPrompt(storedPrompt);
			setSystemPromptOpen(true);
		}
	}, [
		setSystemPrompt,
		systemPromptKey,
		storageKey,
		setSystemPromptOpen,
		setMessages,
	]);

	useEffect(() => {
		try {
			if (systemPrompt) {
				localStorage.setItem(systemPromptKey, systemPrompt);
			} else {
				localStorage.removeItem(systemPromptKey);
			}
		} catch {}
		// systemPromptKey is a module constant for chat; for playground it can vary
		// per-mount but only on first render (when initial localStorage hydrates),
		// so we intentionally don't re-fire on every change to avoid write loops.
	}, [systemPrompt, systemPromptKey]);

	useEffect(() => {
		messagesRef.current = messages;
	}, [messages, messagesRef]);

	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastMessagesRef = useRef<Message[]>([]);

	const debouncedSave = useMemo(() => {
		const save = (msgs: Message[]) => {
			lastMessagesRef.current = msgs;
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => {
				try {
					localStorage.setItem(storageKey, JSON.stringify(msgs));
				} catch (err) {
					log.warn("Failed to save conversation to storage", err);
				}
			}, 2000);
		};
		save.flush = () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			if (lastMessagesRef.current.length > 0) {
				try {
					localStorage.setItem(storageKey, JSON.stringify(lastMessagesRef.current));
				} catch (err) {
					log.warn("Failed to flush conversation to storage", err);
				}
			}
		};
		save.cancel = () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
		return save;
	}, [storageKey]);

	useEffect(() => {
		if (messages.length > 0) {
			debouncedSave(messages);
		} else {
			// Cleared conversation — drop storage immediately so a pending
			// debounce / beforeunload flush cannot resurrect the old thread.
			debouncedSave.cancel();
			lastMessagesRef.current = [];
			try {
				localStorage.removeItem(storageKey);
			} catch {
				/* quota / private mode */
			}
		}
		return () => {
			debouncedSave.cancel();
		};
	}, [messages, debouncedSave, storageKey]);

	// Flush pending debounced save on tab close / navigation
	useEffect(() => {
		const handleBeforeUnload = () => {
			debouncedSave.flush();
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [debouncedSave]);
}
