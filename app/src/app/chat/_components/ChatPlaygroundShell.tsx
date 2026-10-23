"use client";

import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
	Suspense,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	type SetStateAction,
} from "react";
import type { Message } from "@/components/chat";
import {
	ConversationHistory,
	type ConversationHistoryProps,
} from "@/components/chat/ConversationHistory";
import { balanceToDollars, useBalance } from "@/components/chat/useBalance";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { formatA2UIAction } from "@/lib/a2ui";
import { OPENUI_SYSTEM_SUFFIX } from "@/lib/openui";
import type { OpenUIActionHandler } from "@/lib/openui-actions";
import { useAuth } from "@/lib/hooks/useAuth";
import { log } from "@/lib/logger";
import {
	conversationStorageKey,
	systemPromptStorageKey,
} from "@/lib/chat-storage";
import {
	displayName,
	isFreeChatModel,
	FREE_DEFAULT_CHAT_MODEL,
} from "@/lib/model-utils";
import { consumeChatSignInDraft, registerChatSignInDraft, saveChatDraftForSignIn } from "@/lib/chat-signin-draft";
import { buildLoginHref } from "@/lib/login-href";
import { playgroundHrefForModel } from "@/lib/playground-href";
import { GUEST_DAILY_LIMIT_DEFAULT } from "@/lib/guest-daily-quota";
import { useSystemPromptPersistence } from "../_hooks/useSystemPromptPersistence";
import { useConversationHistory } from "../_hooks/useConversationHistory";
import { useChatScroll } from "../_hooks/useChatScroll";
import { useChatShortcuts } from "../_hooks/useChatShortcuts";
import { useModelLinkShare } from "../_hooks/useModelLinkShare";
import { useGuestQuota } from "../_hooks/useGuestQuota";
import { usePlaygroundState } from "../_hooks/usePlaygroundState";
import { useStreamingChat, type SendMessageOptions } from "../_hooks/useStreamingChat";
import {
	LiveModelsProvider,
	useSharedLiveModelCatalog,
} from "@/components/chat/chat-message-shared";
import { AuthPromptModal } from "@/components/chat/AuthPromptModal";
import { exportChatHistory } from "@/lib/chat-export";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { ChatSettingsPanel } from "./ChatSettingsPanel";
import { ChatSystemPromptPanel } from "./ChatSystemPromptPanel";
import { MemoizedChatToolbar } from "./ChatToolbar";
import { MessagesList } from "./MessagesList";

/** Retains the existing interactive-mode preference across the renderer upgrade. */
const UI_MODE_STORAGE_KEY = "oma_chat_ui_mode";

const LazyMessageInput = dynamic(
	() =>
		import("@/components/chat/MessageInput").then(
			(mod) => mod.MessageInput,
		),
	{ ssr: false, loading: () => <Skeleton className="h-16 w-full" /> },
);

const LazyCostEstimate = dynamic(
	() =>
		import("@/components/chat/CostEstimate").then((mod) => mod.CostEstimate),
	{ ssr: false, loading: () => <Skeleton className="h-3 w-32" /> },
);

const LazyKeyboardShortcutsModal = dynamic(
	() =>
		import("@/components/chat/KeyboardShortcutsModal").then(
			(mod) => mod.KeyboardShortcutsModal,
		),
	{ ssr: false, loading: () => null },
);

const LazyModelComparePanel = dynamic(
	() =>
		import("@/components/chat/ModelComparePanel").then(
			(mod) => mod.ModelComparePanel,
		),
	{ ssr: false, loading: () => null },
);

export interface RegeneratePlan {
	prompt: string;
	primaryMessages: Message[];
	compareMessages: Message[];
}

/**
 * Remove the latest shared user turn and every response produced from it.
 * New compare sends reuse the primary user message object, so its id is the
 * stable join key between the two histories.
 */
export function buildRegeneratePlan(
	primaryMessages: Message[],
	compareMessages: Message[],
): RegeneratePlan | null {
	const userIndex = primaryMessages.findLastIndex(
		(message) => message.role === "user",
	);
	if (userIndex < 0) return null;

	const userMessage = primaryMessages[userIndex];
	const compareUserIndex = userMessage.id
		? compareMessages.findLastIndex(
				(message) =>
					message.role === "user" && message.id === userMessage.id,
			)
		: -1;

	return {
		prompt: userMessage.content,
		primaryMessages: primaryMessages.slice(0, userIndex),
		compareMessages:
			compareUserIndex >= 0
				? compareMessages.slice(0, compareUserIndex)
				: compareMessages,
	};
}

function ShellContent() {
	const [historyOpen, setHistoryOpen] = useState(false);
	const historyDrawerRef = useRef<HTMLDivElement | null>(null);
	const historyReturnFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches) {
			setHistoryOpen(true);
		}
	}, []);

	useEffect(() => {
		if (!historyOpen || typeof window === "undefined") return;
		const mobile = window.matchMedia?.("(max-width: 1023px)").matches;
		if (!mobile) return;
		if (!historyReturnFocusRef.current) {
			historyReturnFocusRef.current = document.activeElement as HTMLElement | null;
		}
		const drawer = historyDrawerRef.current;
		const focusableSelector =
			'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
		const focusSearch = window.setTimeout(() => {
			drawer?.querySelector<HTMLElement>('input[type="search"]')?.focus();
		}, 0);
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setHistoryOpen(false);
				return;
			}
			if (event.key !== "Tab" || !drawer) return;
			const focusable = Array.from(
				drawer.querySelectorAll<HTMLElement>(focusableSelector),
			);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			window.clearTimeout(focusSearch);
			document.removeEventListener("keydown", handleKeyDown);
			historyReturnFocusRef.current?.focus();
			historyReturnFocusRef.current = null;
		};
	}, [historyOpen]);

	// Keep the Interactive preference across reloads; unavailable browser
	// storage must not prevent the chat from opening.
	const [uiMode, setUiModeState] = useState<boolean>(() => {
		if (typeof window === "undefined") return false;
		try {
			return localStorage.getItem(UI_MODE_STORAGE_KEY) === "1";
		} catch {
			return false;
		}
	});
	const setUiMode = useCallback((v: SetStateAction<boolean>) => {
		setUiModeState((prev) => {
			const next = typeof v === "function" ? v(prev) : v;
			try {
				if (next) localStorage.setItem(UI_MODE_STORAGE_KEY, "1");
				else localStorage.removeItem(UI_MODE_STORAGE_KEY);
			} catch {
				/* private mode */
			}
			return next;
		});
	}, []);

	const toast = useToast();
	const { isAuthenticated: hasSession, isDemo, isReady, user } = useAuth();
	const isAuthenticated = hasSession && !isDemo;
	const scopedStorageKey = conversationStorageKey(user?.id ?? null);

	// Only validate availability after the live catalog resolves; a static
	// fallback must not replace a valid deep-linked model during loading.
	const { models: liveModels, status: catalogStatus } = useSharedLiveModelCatalog();
	const availableModelIds = useMemo(
		() => liveModels.filter((m) => m.available !== false).map((m) => m.id).sort(),
		[liveModels],
	);

	const {
		model,
		modelHydrated,
		hasInitialUrlModel,
		setModel,
		messages,
		setMessages,
		input,
		setInput,
		loading,
		setLoading,
		error,
		setError,
		compareError,
		setCompareError,
		paramsOpen,
		setParamsOpen,
		showAdvanced,
		setShowAdvanced,
		paramsError,
		clearParamsError,
		applyChatParams,
		temperature,
		setTemperature,
		topP,
		setTopP,
		maxTokens,
		setMaxTokens,
		topK,
		setTopK,
		freqPenalty,
		setFreqPenalty,
		presPenalty,
		setPresPenalty,
		stream,
		setStream,
		webSearchEnabled,
		setWebSearchEnabled,
		searching,
		setSearching,
		systemPrompt,
		setSystemPrompt,
		systemPromptOpen,
		setSystemPromptOpen,
		compareMode,
		setCompareMode,
		compareModel,
		setCompareModel,
		compareMessages,
		setCompareMessages,
		shortcutsOpen,
		setShortcutsOpen,
	} = usePlaygroundState({
		// Pass the user id so the saved model lives in the correct
		// per-user localStorage bucket. `user?.id` is `undefined` until
		// auth resolves; the hook treats that as a guest read.
		userId: user?.id ?? null,
		authReady: isReady,
		availableModelIds: catalogStatus === "live" ? availableModelIds : undefined,
	});
	const checkedSignInDraft = useRef(false);
	const restoredDraftOwner = useRef<string | null | undefined>(undefined);
	const restoredDraftValue = useRef("");

	// BUG-G: a selection that isn't in the live set can't be sent.
	const isModelUnavailable =
		catalogStatus === "live" && !availableModelIds.includes(model);
	const selectedModel = liveModels.find((item) => item.id === model);
	const modelName = selectedModel?.name ?? displayName(model);
	const freeModelSelected = isFreeChatModel(model);
	const guestNeedsSignIn = isReady && !isAuthenticated && !freeModelSelected;
	const verifiedFreeSelection =
		catalogStatus === "live" && !isModelUnavailable && freeModelSelected;
	const guestAccess = guestNeedsSignIn
		? "sign-in"
		: verifiedFreeSelection && isReady ? "free" : "unknown";
	const freeAlternative = catalogStatus === "live"
		? liveModels.find((item) => item.id === FREE_DEFAULT_CHAT_MODEL && item.available !== false)
			?? liveModels.find((item) => isFreeChatModel(item.id) && item.available !== false)
		: undefined;
	const loginHref = buildLoginHref(playgroundHrefForModel(model));

	const scopedPromptKey = systemPromptStorageKey(user?.id ?? null);
	const { balance, loading: balanceLoading, refresh: refreshBalance } = useBalance();
	const balanceDollars = balanceToDollars(balance);
	const LOW_BALANCE_THRESHOLD = 1;
	// Only flag low balance after a real balance payload arrives — treating
	// null/loading as $0 was flashing "LOW CREDITS — $0.00" on every cold load.
	const isLowBalance =
		isAuthenticated &&
		(!freeModelSelected || (compareMode && !isFreeChatModel(compareModel))) &&
		balance != null &&
		!balanceLoading &&
		balanceDollars < LOW_BALANCE_THRESHOLD;

	// ─── Auth prompt modal (guest gating) ───
	const [authPromptOpen, setAuthPromptOpen] = useState(false);
	const [authPromptReason, setAuthPromptReason] = useState<"paid-model" | "message-limit">(
		"message-limit",
	);

	const [authPromptModel, setAuthPromptModel] = useState(model);
	const chooseFreeModel = useCallback(() => {
		if (!freeAlternative) return;
		if (!freeModelSelected) setModel(freeAlternative.id);
		if (compareMode && !isFreeChatModel(compareModel)) setCompareModel(freeAlternative.id);
		setAuthPromptOpen(false);
		setError(null);
	}, [freeAlternative, freeModelSelected, setModel, compareMode, compareModel, setCompareModel, setError]);

	// ─── Guest free-tier quota (server is source of truth) ───
	const handleQuotaExhausted = useCallback(() => {
		setAuthPromptReason("message-limit");
		setAuthPromptOpen(true);
	}, []);
	const { guestQuota, onDailyQuota, allowGuestSend } = useGuestQuota({
		isAuthenticated,
		onExhausted: handleQuotaExhausted,
	});

	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const messagesRef = useRef<Message[]>(messages);
	const compareMessagesRef = useRef<Message[]>(compareMessages);
	const deferredMessages = useDeferredValue(messages);

	useEffect(() => {
		compareMessagesRef.current = compareMessages;
	}, [compareMessages]);

	useSystemPromptPersistence({
		systemPrompt,
		setSystemPrompt,
		setSystemPromptOpen,
		systemPromptKey: scopedPromptKey,
		enabled: isReady,
	});
	const conversationHistory = useConversationHistory({
		enabled: isReady && modelHydrated,
		userId: user?.id ?? null,
		legacyStorageKey: scopedStorageKey,
		messages,
		setMessages,
		messagesRef,
		input,
		setInput,
		readCurrentDraft: () => inputRef.current?.value ?? input,
		model,
		setModel,
		preserveInitialModel: hasInitialUrlModel,
	});

	// Restore a draft carried through sign-in after the local thread has
	// hydrated, so an empty saved draft cannot overwrite the handoff.
	useEffect(() => {
		if (!isReady || !modelHydrated || !conversationHistory.hydrated) return;
		const userId = user?.id ?? null;
		if (!checkedSignInDraft.current) {
			checkedSignInDraft.current = true;
			const draft = consumeChatSignInDraft(model, userId);
			if (draft !== null) {
				setInput((current) => current || draft);
				restoredDraftOwner.current = userId;
				restoredDraftValue.current = draft;
			}
		} else if (restoredDraftOwner.current === null && userId !== null) {
			restoredDraftOwner.current = userId;
			setInput((current) => current || restoredDraftValue.current);
		} else if (
			restoredDraftOwner.current !== undefined &&
			restoredDraftOwner.current !== userId
		) {
			setInput("");
			restoredDraftOwner.current = undefined;
			restoredDraftValue.current = "";
		}
	}, [
		conversationHistory.hydrated,
		isReady,
		modelHydrated,
		model,
		user?.id,
		setInput,
	]);
	useEffect(
		() =>
			registerChatSignInDraft(
				() => ({ model, input, userId: user?.id ?? null }),
				conversationHistory.clearActiveDraftForHandoff,
			),
		[conversationHistory, model, input, user?.id],
	);

	const {
		scrollContainerRef,
		messagesEndRef,
		isNearBottomRef,
		isScrolledAway,
		handleScroll,
		jumpToBottom,
	} = useChatScroll(loading, messages, deferredMessages);

	const interactiveContext = useMemo(() => uiMode ? JSON.stringify({
		selectedModel: model,
		requestSettings: { temperature, topP, maxTokens },
		catalogStatus,
		availableModels: liveModels.filter((item) => item.available !== false).map((item) => ({
			id: item.id, name: item.name, freeInWebsiteChat: isFreeChatModel(item.id),
		})),
	}) : "", [uiMode, model, temperature, topP, maxTokens, catalogStatus, liveModels]);
	const effectiveSystemPrompt = uiMode
		? `${systemPrompt}${OPENUI_SYSTEM_SUFFIX}\nCurrent OMA context: ${interactiveContext}`
		: systemPrompt;

	const { sendMessage, abortRef } = useStreamingChat({
		ownerKey: `${user?.id ?? "guest"}:${conversationHistory.activeThreadId}`,
		messagesRef,
		compareMessagesRef,
		input,
		loading,
		setInput,
		setMessages,
		setLoading,
		setError,
		setCompareError,
		model,
		systemPrompt: effectiveSystemPrompt,
		responseFormat: uiMode ? "openui" : "text",
		compareMode,
		compareModel,
		setCompareMessages,
		inputRef,
		isNearBottomRef,
		temperature,
		topP,
		maxTokens,
		topK,
		freqPenalty,
		presPenalty,
		stream,
		webSearchEnabled,
		setSearching,
		onDailyQuota,
	});

	// Check access before the streaming hook clears the composer or appends history.
	const checkSendAccess = useCallback(() => {
		if (!isReady) return false;
		if (isModelUnavailable) {
			setError("The selected model is not currently available — pick another model.");
			return false;
		}
		const paidModel = !isFreeChatModel(model) ? model
			: compareMode && !isFreeChatModel(compareModel) ? compareModel : null;
		if (!isAuthenticated && paidModel) {
			setAuthPromptModel(paidModel);
			setAuthPromptReason("paid-model");
			setAuthPromptOpen(true);
			return false;
		}
		// Credit warnings are informational; the API enforces the required request reservation.
		return allowGuestSend();
	}, [isReady, isModelUnavailable, setError, model, compareMode, compareModel, isAuthenticated, allowGuestSend]);
	const gatedSend = useCallback(async (prompt?: string, options?: SendMessageOptions) => {
		if (!checkSendAccess()) {
			if (prompt) setInput(prompt);
			if (options?.throwOnError) throw new Error("The follow-up could not be sent. Resolve the chat access notice and try again.");
			return;
		}
		try {
			await sendMessage(prompt, options);
		} finally {
			if (isAuthenticated) void refreshBalance();
		}
	}, [checkSendAccess, setInput, sendMessage, refreshBalance, isAuthenticated]);

	const gatedSendRef = useRef(gatedSend);
	useEffect(() => {
		gatedSendRef.current = gatedSend;
	}, [gatedSend]);

	const handleOpenUIAction = useCallback<OpenUIActionHandler>(async (action) => {
		if (!isReady || !conversationHistory.hydrated) throw new Error("Chat is still loading. Try again in a moment.");
		if (loading) throw new Error("Wait for the current response before using this action.");
		if (action.type === "followup") {
			await gatedSendRef.current(action.prompt, { throwOnError: true });
			return;
		}
		const { model: targetModel, ...parameters } = action.settings;
		if (targetModel) {
			if (catalogStatus !== "live" || !availableModelIds.includes(targetModel)) {
				throw new Error("That model is not currently available. Choose a model from the live catalog.");
			}
			if (!isAuthenticated && !isFreeChatModel(targetModel)) {
				throw new Error("Sign in to select this model, or choose a free chat model.");
			}
		}
		if (Object.keys(parameters).length > 0 && !applyChatParams(parameters)) {
			throw new Error("Could not save these settings in your browser. Your settings were not changed.");
		}
		if (targetModel) setModel(targetModel);
	}, [isReady, conversationHistory.hydrated, loading, catalogStatus, availableModelIds, isAuthenticated, applyChatParams, setModel]);

	const stopGeneration = useCallback(() => {
		abortRef.current?.abort();
	}, [abortRef]);

	const clearChat = useCallback(() => {
		if (loading) return;
		const hasContent =
			messages.length > 0 || compareMessages.length > 0;
		if (hasContent) {
			const ok =
				typeof window !== "undefined" &&
				window.confirm(
					"Clear this conversation? Its messages in this browser will be removed.",
				);
			if (!ok) return;
		}
		if (!conversationHistory.clearActiveThread()) return;
		setCompareMessages([]);
		setError(null);
		setCompareError(null);
		toast.success("Conversation cleared");
		setTimeout(() => inputRef.current?.focus(), 100);
	}, [
		conversationHistory,
		setError,
		setCompareError,
		setCompareMessages,
		messages.length,
		compareMessages.length,
		loading,
		toast,
	]);

	/**
	 * Regenerate the last assistant response (ChatGPT / Claude-style Retry).
	 * Drops the latest shared user turn and both models' responses to it, then
	 * re-sends that prompt so the primary and comparison histories stay aligned.
	 */
	const handleRegenerate = useCallback(() => {
		if (loading || !checkSendAccess()) return;
		const plan = buildRegeneratePlan(
			messagesRef.current,
			compareMessagesRef.current,
		);
		if (!plan) return;

		setMessages(plan.primaryMessages);
		messagesRef.current = plan.primaryMessages;
		setCompareMessages(plan.compareMessages);
		compareMessagesRef.current = plan.compareMessages;
		void gatedSendRef.current(plan.prompt);
	}, [loading, setMessages, setCompareMessages, checkSendAccess]);

	const exportConversation = useCallback((format: "json" | "txt" | "md" = "json") => {
		try {
			exportChatHistory(
				messages,
				format,
				conversationHistory.activeThreadId,
			);
		} catch (err) {
			log.warn("Failed to export conversation", err);
		}
	}, [conversationHistory.activeThreadId, messages]);
	const exportHistoryThread = useCallback((threadId: string) => {
		const thread = conversationHistory.threads.find((item) => item.id === threadId);
		if (!thread) return;
		try {
			exportChatHistory(thread.messages, "json", thread.id);
		} catch (err) {
			log.warn("Failed to export conversation", err);
		}
	}, [conversationHistory.threads]);

	const importConversation = useCallback((importedMessages: Message[]) => {
		if (loading || !conversationHistory.importThread(importedMessages)) return;
		setCompareMessages([]);
		setError(null);
		setCompareError(null);
		toast.success("Conversation imported successfully");
	}, [
		conversationHistory,
		loading,
		setCompareMessages,
		setError,
		setCompareError,
		toast,
	]);

	const newConversation = useCallback(() => {
		if (loading || !conversationHistory.newThread()) return;
		setCompareMessages([]);
		setError(null);
		setCompareError(null);
		if (window.matchMedia?.("(max-width: 1023px)").matches) {
			setHistoryOpen(false);
		}
		setTimeout(() => inputRef.current?.focus(), 100);
	}, [
		conversationHistory,
		loading,
		setCompareMessages,
		setError,
		setCompareError,
	]);

	const selectHistoryThread = useCallback((threadId: string) => {
		if (loading) return;
		const mobile = window.matchMedia?.("(max-width: 1023px)").matches;
		if (threadId === conversationHistory.activeThreadId) {
			if (mobile) setHistoryOpen(false);
			return;
		}
		if (!conversationHistory.selectThread(threadId)) return;
		setCompareMessages([]);
		setError(null);
		setCompareError(null);
		if (mobile) setHistoryOpen(false);
	}, [
		conversationHistory,
		loading,
		setCompareMessages,
		setError,
		setCompareError,
	]);

	const deleteHistoryThread = useCallback((threadId: string) => {
		if (loading) return;
		const deletingActive = threadId === conversationHistory.activeThreadId;
		if (!conversationHistory.deleteThread(threadId)) return;
		if (deletingActive) {
			setCompareMessages([]);
			setError(null);
			setCompareError(null);
		}
	}, [
		conversationHistory,
		loading,
		setCompareMessages,
		setError,
		setCompareError,
	]);

	useChatShortcuts({
		sendMessageRef: gatedSendRef,
		input,
		loading,
		shortcutsOpen,
		setShortcutsOpen,
		paramsOpen,
		setParamsOpen,
		compareMode,
		setCompareMode,
		setSystemPromptOpen,
		newConversation,
	});

	const modelLinkShare = useModelLinkShare({ model, toast });
	const historyPanelProps: ConversationHistoryProps = {
		threads: conversationHistory.threads,
		activeThreadId: conversationHistory.activeThreadId,
		disabled: loading,
		persistenceStatus: conversationHistory.persistenceStatus,
		persistenceError: conversationHistory.persistenceError,
		onNew: newConversation,
		onSelect: selectHistoryThread,
		onRename: (threadId, title) => {
			if (!loading) conversationHistory.renameThread(threadId, title);
		},
		onTogglePinned: (threadId) => {
			if (!loading) conversationHistory.togglePinned(threadId);
		},
		onDelete: deleteHistoryThread,
		onExport: exportHistoryThread,
	};

	return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-void font-sans text-text">
			<h1 className="sr-only">OMA Playground — AI chat with interactive responses</h1>
			<MemoizedChatToolbar
				model={model}
				setModel={setModel}
				paramsOpen={paramsOpen}
				setParamsOpen={(open) => { setParamsOpen(open); if (open) setHistoryOpen(false); }}
				searching={searching}
				isAuthenticated={isAuthenticated}
				balance={balance}
				balanceDollars={balanceDollars}
				isLowBalance={isLowBalance}
				compareMode={compareMode}
				setCompareMode={setCompareMode}
				modelLinkStatus={modelLinkShare.status}
				copyModelLink={modelLinkShare.copyModelLink}
				exportConversation={exportConversation}
				importConversation={importConversation}
				newConversation={newConversation}
				clearChat={clearChat}
				messagesLength={messages.length}
				deferredMessages={deferredMessages}
				setShortcutsOpen={setShortcutsOpen}
				loading={loading}
				historyOpen={historyOpen}
				onToggleHistory={() => {
					if (!historyOpen) {
						historyReturnFocusRef.current = document.activeElement as HTMLElement | null;
					}
					setHistoryOpen((open) => !open);
				}}
			/>

			<div className="flex-1 flex overflow-hidden bg-[color-mix(in_srgb,var(--color-surface)_40%,transparent)]">
				{historyOpen && (
					<div className="hidden w-72 shrink-0 lg:block">
						<ConversationHistory {...historyPanelProps} />
					</div>
				)}
				<section
					aria-label="Chat messages"
					className="flex-1 flex flex-col min-w-0 relative"
				>

						{isLowBalance && (
							<div
								role="status"
								className="gutter-page flex flex-none items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 py-2 font-mono text-xs text-warning"
							>
								<span className="flex items-center gap-2 tracking-wide">
									<AlertTriangle
										className="w-3.5 h-3.5 shrink-0"
										aria-hidden="true"
									/>
									Low credits — ${balanceDollars.toFixed(2)}
								</span>
								<Link
									href="/deposit"
									className="px-2 py-0.5 bg-accent text-void text-[11px] font-semibold tracking-wide hover:bg-accent/90 transition-colors duration-200 ease-out"
								>
									Top up
								</Link>
							</div>
						)}

					{/* System instructions only apply to text chat */}
					<ChatSystemPromptPanel
						systemPrompt={systemPrompt}
						setSystemPrompt={setSystemPrompt}
						systemPromptOpen={systemPromptOpen}
						setSystemPromptOpen={setSystemPromptOpen}
					/>

					<MessagesList
						scrollContainerRef={scrollContainerRef}
						messagesEndRef={messagesEndRef}
						isScrolledAway={isScrolledAway}
						loading={loading}
						jumpToBottom={jumpToBottom}
						handleScroll={handleScroll}
						deferredMessages={deferredMessages}
						onRegenerate={handleRegenerate}
						onA2UIAction={(event) => {
							void gatedSendRef.current(formatA2UIAction(event));
						}}
						onOpenUIAction={handleOpenUIAction}
						isAuthenticated={isAuthenticated}
						emptyStateProps={{
							modelName,
							guestAccess,
							dailyLimit: guestQuota?.limit ?? GUEST_DAILY_LIMIT_DEFAULT,
							loginHref,
							freeModelName: freeAlternative?.name,
							onChooseFreeModel: freeAlternative ? chooseFreeModel : undefined,
						}}
						onPickPrompt={(prompt) => {
							setInput(prompt);
							inputRef.current?.focus();
						}}
						/>

					{/* Keep the composer above mobile browser chrome and the consent banner. */}
					<div
						className="gutter-page z-10 flex-none border-t border-border bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md sm:pt-4 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
					>
							<div className="max-w-4xl mx-auto">
								<ChatErrorBanner
									error={error}
									isAuthenticated={isAuthenticated}
									loginHref={loginHref}
									onDismiss={() => setError(null)}
									onRetry={() => {
										setError(null);
										if (input.trim()) {
											void gatedSend();
										} else {
											handleRegenerate();
										}
									}}
								/>

								<LazyMessageInput
									input={input}
									setInput={setInput}
									onSubmit={() => { void gatedSend(); }}
									onStop={stopGeneration}
									loading={loading}
									textareaRef={inputRef}
									disabled={!isReady || !conversationHistory.hydrated}
									disabledReason="Restoring your chats…"
									modelUnavailable={isModelUnavailable}
									webSearchEnabled={webSearchEnabled}
									setWebSearchEnabled={setWebSearchEnabled}
									uiMode={uiMode}
									setUiMode={setUiMode}
									showAdvancedTools
								/>

								<div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 sm:mt-2.5 sm:px-2">
									<p className="text-[11px] text-text-muted/80 tracking-wide font-mono min-w-0 break-words select-none">
										{isReady && !isAuthenticated && verifiedFreeSelection && (
											<span className="text-accent/80 font-semibold">
												{guestQuota ? `${guestQuota.remaining} free left` : "Free daily allowance"}
											</span>
										)}
										{guestNeedsSignIn && <Link href={loginHref} onClick={() => saveChatDraftForSignIn()} className="text-accent hover:underline">Sign in to use {modelName}</Link>}
										{isLowBalance && (
											<Link
												href="/deposit"
												className="text-warning hover:underline"
											>
												Low credits — top up for paid models
											</Link>
										)}
									</p>
									<LazyCostEstimate
										inputText={input}
										model={model}
										maxTokens={maxTokens}
										freeWebsiteChat={isReady && verifiedFreeSelection}
									/>
								</div>
							</div>
					</div>
				</section>

				<ChatSettingsPanel
					paramsOpen={paramsOpen}
					setParamsOpen={setParamsOpen}
					temperature={temperature}
					setTemperature={setTemperature}
					topP={topP}
					setTopP={setTopP}
					maxTokens={maxTokens}
					setMaxTokens={setMaxTokens}
					topK={topK}
					setTopK={setTopK}
					freqPenalty={freqPenalty}
					setFreqPenalty={setFreqPenalty}
					presPenalty={presPenalty}
					setPresPenalty={setPresPenalty}
					stream={stream}
					setStream={setStream}
					showAdvanced={showAdvanced}
					setShowAdvanced={setShowAdvanced}
					model={model}
					saveError={paramsError}
					onDismissSaveError={clearParamsError}
				/>
			</div>

			{historyOpen && createPortal(
				<div className="fixed inset-x-0 top-0 bottom-[var(--consent-banner-height,0px)] z-[80] lg:hidden">
					<button
						type="button"
						aria-label="Close conversation history"
						className="absolute inset-0 bg-black/65 backdrop-blur-sm"
						onClick={() => setHistoryOpen(false)}
					/>
					<div
						ref={historyDrawerRef}
						id="conversation-history-drawer"
						role="dialog"
						aria-modal="true"
						aria-label="Conversation history"
						className="relative h-full w-[min(88vw,22rem)] shadow-2xl shadow-black/60"
					>
						<ConversationHistory {...historyPanelProps} autoFocusSearch onClose={() => setHistoryOpen(false)} />
					</div>
				</div>, document.body,
			)}

			<LazyKeyboardShortcutsModal
				open={shortcutsOpen}
				onClose={() => setShortcutsOpen(false)}
			/>

			<LazyModelComparePanel
				open={compareMode}
				onClose={() => setCompareMode(false)}
				primaryModel={model}
				compareModel={compareModel}
				setCompareModel={setCompareModel}
				prompt={input}
				onSubmit={(p) => {
					const text = (p ?? "").trim();
					if (text && !loading) {
						void gatedSendRef.current(text);
					}
				}}
				loading={loading}
				compareMessages={compareMessages}
				onRegenerate={handleRegenerate}
				onOpenUIAction={handleOpenUIAction}
				onA2UIAction={(event) => { void gatedSendRef.current(formatA2UIAction(event)); }}
				error={compareError}
				onDismissError={() => setCompareError(null)}
			/>

			<AuthPromptModal
				open={authPromptOpen}
				onClose={() => setAuthPromptOpen(false)}
				reason={authPromptReason}
				modelName={liveModels.find((item) => item.id === authPromptModel)?.name ?? displayName(authPromptModel)}
				onSignIn={() => saveChatDraftForSignIn(authPromptReason === "paid-model" ? authPromptModel : model)}
				loginHref={buildLoginHref(playgroundHrefForModel(authPromptReason === "paid-model" ? authPromptModel : model))}
				freeModelName={freeAlternative?.name}
				onChooseFreeModel={authPromptReason === "paid-model" && freeAlternative ? chooseFreeModel : undefined}
				dailyLimit={guestQuota?.limit ?? GUEST_DAILY_LIMIT_DEFAULT}
			/>
		</div>
	);
}

function ShellLoadingFallback() {
	return (
		<div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">
			<Skeleton className="h-8 w-48" />
			<div className="flex gap-4">
				<Skeleton className="w-10 h-10 shrink-0 rounded-[var(--radius-sm)]" />
				<div className="flex flex-col max-w-[80%] gap-2 flex-1">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-4 w-20" />
				</div>
			</div>
			<Skeleton className="h-16 w-full" />
		</div>
	);
}

export function ChatPlaygroundShell() {
	return (
		<Suspense fallback={<ShellLoadingFallback />}>
			<LiveModelsProvider>
				<ShellContent />
			</LiveModelsProvider>
		</Suspense>
	);
}
