import type { Message } from "@/components/chat";
import { isChatMessage } from "@/lib/chat-message-validation";

export const CONVERSATION_HISTORY_VERSION = 1 as const;
export const UNTITLED_CONVERSATION = "New chat";

interface StorageAdapter {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export interface ConversationThread {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	pinned: boolean;
	customTitle: boolean;
	messages: Message[];
	draft: string;
	model: string;
}

export interface ConversationHistoryState {
	version: typeof CONVERSATION_HISTORY_VERSION;
	activeThreadId: string;
	threads: ConversationThread[];
}

interface LoadConversationHistoryOptions {
	historyKey: string;
	legacyKey: string;
	model: string;
	createId: () => string;
	now?: () => number;
}

interface ConversationHistoryLoadResult {
	history: ConversationHistoryState;
	source: "history" | "legacy" | "empty";
	canPersist: boolean;
	error: string | null;
}

export function conversationStorageKey(
	userId: string | null | undefined,
): string {
	return userId
		? `oma_chat_conversation:u:${userId}`
		: "oma_chat_conversation:guest";
}

export function conversationHistoryStorageKey(
	userId: string | null | undefined,
): string {
	return userId ? `oma_chat_history:v1:u:${userId}` : "oma_chat_history:v1:guest";
}

export function systemPromptStorageKey(
	userId: string | null | undefined,
): string {
	return userId
		? `oma_chat_system_prompt:u:${userId}`
		: "oma_chat_system_prompt:guest";
}

export function conversationTitle(messages: Message[]): string {
	const firstUserMessage = messages.find(
		(message) => message.role === "user" && message.content.trim(),
	);
	if (!firstUserMessage) return UNTITLED_CONVERSATION;
	const oneLine = firstUserMessage.content.replace(/\s+/g, " ").trim();
	return oneLine.length > 52 ? `${oneLine.slice(0, 49).trimEnd()}…` : oneLine;
}

export function createConversationThread({
	id,
	now,
	model,
	messages = [],
	draft = "",
	title,
	customTitle = false,
}: {
	id: string;
	now: number;
	model: string;
	messages?: Message[];
	draft?: string;
	title?: string;
	customTitle?: boolean;
}): ConversationThread {
	return {
		id,
		title: title?.trim() || conversationTitle(messages),
		createdAt: now,
		updatedAt: now,
		pinned: false,
		customTitle,
		messages,
		draft,
		model,
	};
}

function emptyHistory(
	model: string,
	createId: () => string,
	now: () => number,
): ConversationHistoryState {
	const thread = createConversationThread({ id: createId(), now: now(), model });
	return {
		version: CONVERSATION_HISTORY_VERSION,
		activeThreadId: thread.id,
		threads: [thread],
	};
}

function parseMessages(serialized: string | null): Message[] | null {
	if (!serialized) return null;
	try {
		const parsed: unknown = JSON.parse(serialized);
		if (!Array.isArray(parsed)) return null;
		const messages = parsed.filter(isChatMessage);
		return messages.length > 0 ? messages : null;
	} catch {
		return null;
	}
}

function parseThread(value: unknown): ConversationThread | null {
	if (!value || typeof value !== "object") return null;
	const thread = value as Record<string, unknown>;
	if (
		typeof thread.id !== "string" ||
		!thread.id ||
		typeof thread.title !== "string" ||
		typeof thread.createdAt !== "number" ||
		!Number.isFinite(thread.createdAt) ||
		typeof thread.updatedAt !== "number" ||
		!Number.isFinite(thread.updatedAt) ||
		typeof thread.pinned !== "boolean" ||
		!Array.isArray(thread.messages) ||
		typeof thread.draft !== "string" ||
		typeof thread.model !== "string"
	) {
		return null;
	}
	if (!thread.messages.every(isChatMessage)) return null;
	return {
		id: thread.id,
		title: thread.title.trim() || conversationTitle(thread.messages),
		createdAt: thread.createdAt,
		updatedAt: thread.updatedAt,
		pinned: thread.pinned,
		customTitle: thread.customTitle === true,
		// Retain every validated object verbatim so optional and future message
		// fields survive local persistence and migration.
		messages: thread.messages,
		draft: thread.draft,
		model: thread.model,
	};
}

function parseHistory(serialized: string): ConversationHistoryState | null {
	try {
		const parsed: unknown = JSON.parse(serialized);
		if (!parsed || typeof parsed !== "object") return null;
		const history = parsed as Record<string, unknown>;
		if (
			history.version !== CONVERSATION_HISTORY_VERSION ||
			typeof history.activeThreadId !== "string" ||
			!Array.isArray(history.threads)
		) {
			return null;
		}
		const threads = history.threads.map(parseThread);
		if (threads.length === 0 || threads.some((thread) => thread === null)) {
			return null;
		}
		const validThreads = threads as ConversationThread[];
		const ids = new Set(validThreads.map((thread) => thread.id));
		if (
			ids.size !== validThreads.length ||
			!ids.has(history.activeThreadId)
		) {
			return null;
		}
		return {
			version: CONVERSATION_HISTORY_VERSION,
			activeThreadId: history.activeThreadId,
			threads: validThreads,
		};
	} catch {
		return null;
	}
}

/**
	* Loads one identity bucket. A present but unreadable history is never
	* overwritten: callers receive an in-memory conversation with persistence
	* disabled until the page is reloaded and storage can be read safely.
	*/
export function loadConversationHistory(
	storage: StorageAdapter,
	options: LoadConversationHistoryOptions,
): ConversationHistoryLoadResult {
	const now = options.now ?? Date.now;
	let storedHistory: string | null;
	try {
		storedHistory = storage.getItem(options.historyKey);
	} catch {
		return {
			history: emptyHistory(options.model, options.createId, now),
			source: "empty",
			canPersist: false,
			error:
				"Conversation history could not be read on this device. Export this conversation before reloading.",
		};
	}

	if (storedHistory !== null) {
		const history = parseHistory(storedHistory);
		if (history) {
			return { history, source: "history", canPersist: true, error: null };
		}
		return {
			history: emptyHistory(options.model, options.createId, now),
			source: "empty",
			canPersist: false,
			error:
				"Conversation history could not be read on this device. Export this conversation before reloading.",
		};
	}

	let legacySerialized: string | null = null;
	try {
		legacySerialized = storage.getItem(options.legacyKey);
	} catch {
		return {
			history: emptyHistory(options.model, options.createId, now),
			source: "empty",
			canPersist: false,
			error:
				"Conversation history could not be read on this device. Export this conversation before reloading.",
		};
	}
	const legacyMessages = parseMessages(legacySerialized);
	if (legacyMessages) {
		const thread = createConversationThread({
			id: options.createId(),
			now: now(),
			model: options.model,
			messages: legacyMessages,
		});
		return {
			history: {
				version: CONVERSATION_HISTORY_VERSION,
				activeThreadId: thread.id,
				threads: [thread],
			},
			source: "legacy",
			canPersist: true,
			error: null,
		};
	}

	return {
		history: emptyHistory(options.model, options.createId, now),
		source: "empty",
		canPersist: true,
		error: null,
	};
}

export function persistConversationHistory(
	storage: Pick<StorageAdapter, "setItem">,
	key: string,
	history: ConversationHistoryState,
): boolean {
	try {
		storage.setItem(key, JSON.stringify(history));
		return true;
	} catch {
		return false;
	}
}
