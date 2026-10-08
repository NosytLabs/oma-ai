"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type RefObject,
	type SetStateAction,
} from "react";
import type { Message } from "@/components/chat";
import {
	CONVERSATION_HISTORY_VERSION,
	conversationHistoryStorageKey,
	conversationTitle,
	createConversationThread,
	loadConversationHistory,
	persistConversationHistory,
	type ConversationHistoryState,
	type ConversationThread,
} from "@/lib/chat-storage";

export type ChatPersistenceStatus = "idle" | "saved" | "error";

interface UseConversationHistoryOptions {
	enabled: boolean;
	userId: string | null | undefined;
	legacyStorageKey: string;
	messages: Message[];
	setMessages: Dispatch<SetStateAction<Message[]>>;
	messagesRef: RefObject<Message[]>;
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	/** Reads the live composer value before React has necessarily committed it. */
	readCurrentDraft?: () => string;
	model: string;
	setModel: Dispatch<SetStateAction<string>>;
	/** Keep the current model for the first history hydration (for `?model=`). */
	preserveInitialModel?: boolean;
}

interface HistorySession {
	key: string;
	history: ConversationHistoryState;
	canPersist: boolean;
}

interface PendingThreadApplication {
	key: string;
	threadId: string;
	messages: Message[];
	draft: string;
	model: string;
}

export interface UseConversationHistoryResult {
	hydrated: boolean;
	threads: ConversationThread[];
	activeThreadId: string;
	persistenceStatus: ChatPersistenceStatus;
	persistenceError: string | null;
	selectThread: (threadId: string) => boolean;
	newThread: () => boolean;
	importThread: (messages: Message[]) => boolean;
	clearActiveDraftForHandoff: () => boolean;
	renameThread: (threadId: string, title: string) => boolean;
	togglePinned: (threadId: string) => boolean;
	deleteThread: (threadId: string) => boolean;
	clearActiveThread: () => boolean;
}

function createThreadId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function replaceActiveSnapshot(
	history: ConversationHistoryState,
	messages: Message[],
	draft: string,
	model: string,
): ConversationHistoryState {
	let changed = false;
	const threads = history.threads.map((thread) => {
		if (thread.id !== history.activeThreadId) return thread;
		const title = thread.customTitle ? thread.title : conversationTitle(messages);
		if (
			thread.messages === messages &&
			thread.draft === draft &&
			thread.model === model &&
			thread.title === title
		) {
			return thread;
		}
		changed = true;
		return {
			...thread,
			title,
			updatedAt: Date.now(),
			messages,
			draft,
			model,
		};
	});
	return changed ? { ...history, threads } : history;
}

/**
	* Owns browser-local multi-thread persistence. The session carries its
	* storage key so an auth identity change cannot write the previous user's
	* state into the next user's bucket while React is hydrating the new data.
	*/
export function useConversationHistory({
	enabled,
	userId,
	legacyStorageKey,
	messages,
	setMessages,
	messagesRef,
	input,
	setInput,
	readCurrentDraft,
	model,
	setModel,
	preserveInitialModel = false,
}: UseConversationHistoryOptions): UseConversationHistoryResult {
	const historyKey = conversationHistoryStorageKey(userId);
	const [session, setSession] = useState<HistorySession | null>(null);
	const [persistenceStatus, setPersistenceStatus] =
		useState<ChatPersistenceStatus>("idle");
	const [persistenceError, setPersistenceError] = useState<string | null>(null);
	const pendingApplicationRef = useRef<PendingThreadApplication | null>(null);
	const suppressedDraftRef = useRef<{
		threadId: string;
		input: string;
	} | null>(null);
	const latestSessionRef = useRef<HistorySession | null>(null);
	const visibleMessagesRef = useRef(messages);
	const inputRef = useRef(input);
	const readCurrentDraftRef = useRef(readCurrentDraft);
	const modelRef = useRef(model);
	const initialModelHistoryKeyRef = useRef<string | null>(null);
	visibleMessagesRef.current = messages;
	inputRef.current = input;
	readCurrentDraftRef.current = readCurrentDraft;
	modelRef.current = model;
	latestSessionRef.current = session;

	// Keep imperative consumers such as streaming and regeneration aligned with
	// ordinary message updates. Thread applications also assign synchronously
	// below so a switch cannot expose the previous thread before this effect runs.
	useEffect(() => {
		messagesRef.current = messages;
	}, [messages, messagesRef]);

	const draftForPersistence = useCallback(
		(history: ConversationHistoryState, currentInput: string) => {
			const suppressed = suppressedDraftRef.current;
			if (!suppressed) return currentInput;
			if (
				suppressed.threadId === history.activeThreadId &&
				suppressed.input === currentInput
			) {
				return "";
			}
			suppressedDraftRef.current = null;
			return currentInput;
		},
		[],
	);

	const applyThread = useCallback(
		(key: string, thread: ConversationThread, restoreModel = true) => {
			pendingApplicationRef.current = {
				key,
				threadId: thread.id,
				messages: thread.messages,
				draft: thread.draft,
				model: thread.model,
			};
			visibleMessagesRef.current = thread.messages;
			inputRef.current = thread.draft;
			messagesRef.current = thread.messages;
			setMessages(thread.messages);
			setInput(thread.draft);
			if (restoreModel && thread.model && thread.model !== modelRef.current) {
				setModel(thread.model);
			}
		},
		[messagesRef, setInput, setMessages, setModel],
	);

	useEffect(() => {
		if (!enabled || typeof localStorage === "undefined") return;

		const previous = latestSessionRef.current;
		if (
			previous &&
			previous.key !== historyKey &&
			previous.canPersist
		) {
			persistConversationHistory(localStorage, previous.key, previous.history);
		}

		const loaded = loadConversationHistory(localStorage, {
			historyKey,
			legacyKey: legacyStorageKey,
			model: modelRef.current,
			createId: createThreadId,
		});
		const nextSession = {
			key: historyKey,
			history: loaded.history,
			canPersist: loaded.canPersist,
		};
		latestSessionRef.current = nextSession;
		setSession(nextSession);
		setPersistenceStatus(loaded.canPersist ? "idle" : "error");
		setPersistenceError(loaded.error);
		const active = loaded.history.threads.find(
			(thread) => thread.id === loaded.history.activeThreadId,
		);
		if (active) {
			const preserveForThisLoad =
				preserveInitialModel &&
				(initialModelHistoryKeyRef.current === null ||
					initialModelHistoryKeyRef.current === historyKey);
			if (preserveForThisLoad && initialModelHistoryKeyRef.current === null) {
				initialModelHistoryKeyRef.current = historyKey;
			}
			const restoreModel = !preserveForThisLoad;
			applyThread(historyKey, active, restoreModel);
		}
	}, [
		applyThread,
		enabled,
		historyKey,
		legacyStorageKey,
		preserveInitialModel,
	]);

	// Ignore external state until a thread switch has fully reached all four
	// state slots. Without this gate, an auth or thread switch could snapshot
	// the previous draft/messages over the newly selected thread.
	useEffect(() => {
		if (!enabled || !session || session.key !== historyKey) return;
		const pending = pendingApplicationRef.current;
		if (pending) {
			if (pending.key !== historyKey) return;
			pendingApplicationRef.current = null;
			if (
				messages === pending.messages &&
				input === pending.draft &&
				model === pending.model
			) {
				return;
			}
			// A sign-in handoff or model-availability correction may intentionally
			// override one restored field in the same commit. Snapshot that final
			// visible state instead of holding the thread in a permanent pending
			// state.
		}
		setSession((current) => {
			if (!current || current.key !== historyKey) return current;
			const history = replaceActiveSnapshot(
				current.history,
				messages,
				draftForPersistence(current.history, input),
				model,
			);
			if (history === current.history) return current;
			const next = { ...current, history };
			latestSessionRef.current = next;
			return next;
		});
	}, [draftForPersistence, enabled, historyKey, input, messages, model, session]);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (
			!enabled ||
			!session ||
			session.key !== historyKey ||
			!session.canPersist ||
			typeof localStorage === "undefined"
		) {
			return;
		}
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			saveTimerRef.current = null;
			if (persistConversationHistory(localStorage, session.key, session.history)) {
				setPersistenceStatus("saved");
				setPersistenceError(null);
			} else {
				setPersistenceStatus("error");
				setPersistenceError(
					"Could not save on this device. Export this conversation before closing the page.",
				);
			}
		}, 400);
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
			}
		};
	}, [enabled, historyKey, session]);

	useEffect(() => {
		const flush = () => {
			const current = latestSessionRef.current;
			if (!current?.canPersist || typeof localStorage === "undefined") return;
			persistConversationHistory(localStorage, current.key, current.history);
		};
		const flushWhenHidden = () => {
			if (document.visibilityState === "hidden") flush();
		};
		window.addEventListener("beforeunload", flush);
		window.addEventListener("pagehide", flush);
		document.addEventListener("visibilitychange", flushWhenHidden);
		return () => {
			window.removeEventListener("beforeunload", flush);
			window.removeEventListener("pagehide", flush);
			document.removeEventListener("visibilitychange", flushWhenHidden);
			flush();
		};
	}, []);

	const updateSession = useCallback(
		(
			update: (
				history: ConversationHistoryState,
			) => { history: ConversationHistoryState; apply?: ConversationThread } | null,
		): boolean => {
			const current = latestSessionRef.current;
			if (!current || current.key !== historyKey) return false;
			const snapshot = replaceActiveSnapshot(
				current.history,
				visibleMessagesRef.current,
				draftForPersistence(
					current.history,
					readCurrentDraftRef.current?.() ?? inputRef.current,
				),
				modelRef.current,
			);
			const result = update(snapshot);
			if (!result) return false;
			const next = { ...current, history: result.history };
			latestSessionRef.current = next;
			setSession(next);
			if (result.apply) applyThread(historyKey, result.apply);
			return true;
		},
		[applyThread, draftForPersistence, historyKey],
	);

	const clearActiveDraftForHandoff = useCallback(() => {
		const current = latestSessionRef.current;
		if (!current || current.key !== historyKey) return false;
		suppressedDraftRef.current = {
			threadId: current.history.activeThreadId,
			input: inputRef.current,
		};
		const history = replaceActiveSnapshot(
			current.history,
			visibleMessagesRef.current,
			"",
			modelRef.current,
		);
		const next = history === current.history ? current : { ...current, history };
		latestSessionRef.current = next;
		setSession(next);
		return true;
	}, [historyKey]);

	const selectThread = useCallback(
		(threadId: string) =>
			updateSession((history) => {
				if (threadId === history.activeThreadId) return null;
				const target = history.threads.find((thread) => thread.id === threadId);
				if (!target) return null;
				return {
					history: { ...history, activeThreadId: threadId },
					apply: target,
				};
			}),
		[updateSession],
	);

	const newThread = useCallback(
		() =>
			updateSession((history) => {
				const thread = createConversationThread({
					id: createThreadId(),
					now: Date.now(),
						model: modelRef.current,
				});
				return {
					history: {
						version: CONVERSATION_HISTORY_VERSION,
						activeThreadId: thread.id,
						threads: [...history.threads, thread],
					},
					apply: thread,
				};
			}),
		[updateSession],
	);

	const importThread = useCallback(
		(importedMessages: Message[]) =>
			updateSession((history) => {
				if (importedMessages.length === 0) return null;
				const thread = createConversationThread({
					id: createThreadId(),
					now: Date.now(),
						model: modelRef.current,
					messages: importedMessages,
				});
				return {
					history: {
						version: CONVERSATION_HISTORY_VERSION,
						activeThreadId: thread.id,
						threads: [...history.threads, thread],
					},
					apply: thread,
				};
			}),
		[updateSession],
	);

	const renameThread = useCallback(
		(threadId: string, title: string) =>
			updateSession((history) => {
				const trimmed = title.trim();
				let found = false;
				const threads = history.threads.map((thread) => {
					if (thread.id !== threadId) return thread;
					found = true;
					return {
						...thread,
						title: trimmed || conversationTitle(thread.messages),
						customTitle: Boolean(trimmed),
						updatedAt: Date.now(),
					};
				});
				return found ? { history: { ...history, threads } } : null;
			}),
		[updateSession],
	);

	const togglePinned = useCallback(
		(threadId: string) =>
			updateSession((history) => {
				let found = false;
				const threads = history.threads.map((thread) => {
					if (thread.id !== threadId) return thread;
					found = true;
					return { ...thread, pinned: !thread.pinned };
				});
				return found ? { history: { ...history, threads } } : null;
			}),
		[updateSession],
	);

	const deleteThread = useCallback(
		(threadId: string) =>
			updateSession((history) => {
				if (!history.threads.some((thread) => thread.id === threadId)) return null;
				let threads = history.threads.filter((thread) => thread.id !== threadId);
				if (threads.length === 0) {
					threads = [
						createConversationThread({
							id: createThreadId(),
							now: Date.now(),
								model: modelRef.current,
						}),
					];
				}
				if (threadId !== history.activeThreadId) {
					return { history: { ...history, threads } };
				}
				const target = [...threads].sort(
					(a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
				)[0];
				return {
					history: { ...history, activeThreadId: target.id, threads },
					apply: target,
				};
			}),
		[updateSession],
	);

	const clearActiveThread = useCallback(
		() =>
			updateSession((history) => {
				const threads = history.threads.map((thread) => {
					if (thread.id !== history.activeThreadId) return thread;
					return {
						...thread,
						title: thread.customTitle ? thread.title : conversationTitle([]),
						messages: [],
						draft: "",
						updatedAt: Date.now(),
					};
				});
				const active = threads.find((thread) => thread.id === history.activeThreadId);
				return {
					history: { ...history, threads },
					apply: active,
				};
			}),
		[updateSession],
	);

	const threads = useMemo(
		() =>
			[...(session?.history.threads ?? [])].sort(
				(a, b) =>
					Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
			),
		[session?.history.threads],
	);

	return {
		hydrated: Boolean(enabled && session?.key === historyKey),
		threads,
		activeThreadId:
			session?.key === historyKey ? session.history.activeThreadId : "",
		persistenceStatus,
		persistenceError,
		selectThread,
		newThread,
		importThread,
		clearActiveDraftForHandoff,
		renameThread,
		togglePinned,
		deleteThread,
		clearActiveThread,
	};
}
