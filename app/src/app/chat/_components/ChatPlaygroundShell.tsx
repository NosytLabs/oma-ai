"use client";

import { AlertTriangle } from "lucide-react";
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
import { balanceToDollars, useBalance } from "@/components/chat/useBalance";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { A2UI_SYSTEM_SUFFIX, formatA2UIAction } from "@/lib/a2ui";
import { genConversationId } from "@/lib/gen-id";
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
import { useChatPersistence } from "../_hooks/useChatPersistence";
import { useChatScroll } from "../_hooks/useChatScroll";
import { useChatShortcuts } from "../_hooks/useChatShortcuts";
import { useConversationShare } from "../_hooks/useConversationShare";
import { useGuestQuota } from "../_hooks/useGuestQuota";
import { usePlaygroundState } from "../_hooks/usePlaygroundState";
import { useStreamingChat } from "../_hooks/useStreamingChat";
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

/** localStorage key for the A2UI (UI mode) composer toggle. */
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

export interface ChatPlaygroundShellProps {
	variant: "chat" | "playground";
	storageKey: string;
	systemPromptKey: string;
	conversationIdKey?: string;
}

function ShellContent({
	variant,
	storageKey: _storageKey,
	systemPromptKey: _systemPromptKey,
	conversationIdKey,
}: ChatPlaygroundShellProps) {
	const isChat = variant === "chat";

	// BUG-D: A2UI uiMode was plain component state, so it reset to off on
	// every reload and the user had to re-arm it each session. Persist the
	// preference under a fixed key and restore it on mount. The lazy
	// initializer guards SSR (no window) and the read is wrapped so private
	// mode / corrupt storage can't break the page.
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
		shareStatus,
		setShareStatus,
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
	useEffect(() => {
		if (!isReady || !modelHydrated) return;
		const userId = user?.id ?? null;
		if (!checkedSignInDraft.current) {
			checkedSignInDraft.current = true;
			const draft = consumeChatSignInDraft(model, userId);
			if (draft !== null) {
				setInput((current) => current || draft);
				restoredDraftOwner.current = userId;
			}
		} else if (restoredDraftOwner.current === null && userId !== null) {
			// Auth readiness can time out before the sign-in session resolves.
			// Let the guest handoff adopt its first resolved account once.
			restoredDraftOwner.current = userId;
		} else if (restoredDraftOwner.current !== undefined && restoredDraftOwner.current !== userId) {
			// A restored draft belongs to the account that received the handoff.
			setInput("");
			restoredDraftOwner.current = undefined;
		}
	}, [isReady, modelHydrated, model, user?.id, setInput]);
	useEffect(() => registerChatSignInDraft(() => ({ model, input, userId: user?.id ?? null })), [model, input, user?.id]);

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
		isChat &&
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
	const showComposerAdvancedTools = !!input.trim();

	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const messagesRef = useRef<Message[]>(messages);
	const compareMessagesRef = useRef<Message[]>(compareMessages);
	const [conversationId, setConversationId] = useState<string>("");

	const deferredMessages = useDeferredValue(messages);

	useEffect(() => {
		compareMessagesRef.current = compareMessages;
	}, [compareMessages]);

	// Playground-specific: conversation ID persistence for replay links
	useEffect(() => {
		if (isChat || !conversationIdKey) return;
		let storedCid = localStorage.getItem(conversationIdKey);
		if (!storedCid) {
			storedCid = genConversationId();
			try {
				localStorage.setItem(conversationIdKey, storedCid);
			} catch {
				/* private mode / corrupt storage */
			}
		}
		setConversationId(storedCid);
	}, [isChat, conversationIdKey]);

	useChatPersistence({
		messages,
		setMessages,
		systemPrompt,
		setSystemPrompt,
		setSystemPromptOpen,
		messagesRef,
		storageKey: scopedStorageKey,
		systemPromptKey: scopedPromptKey,
		enabled: isReady,
	});

	const {
		scrollContainerRef,
		messagesEndRef,
		isNearBottomRef,
		isScrolledAway,
		handleScroll,
		jumpToBottom,
	} = useChatScroll(loading, messages, deferredMessages);

	const { sendMessage, abortRef } = useStreamingChat({
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
		systemPrompt: uiMode ? `${systemPrompt}${A2UI_SYSTEM_SUFFIX}` : systemPrompt,
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
		if (isLowBalance) {
			setError("Your credit balance is too low for this model. Top up to continue.");
			return false;
		}
		return allowGuestSend();
	}, [isReady, isModelUnavailable, setError, model, compareMode, compareModel, isAuthenticated, isLowBalance, allowGuestSend]);
	const gatedSend = useCallback(async (prompt?: string) => {
		if (!checkSendAccess()) {
			if (prompt) setInput(prompt);
			return;
		}
		await sendMessage(prompt);
		void refreshBalance();
	}, [checkSendAccess, setInput, sendMessage, refreshBalance]);

	const gatedSendRef = useRef(gatedSend);
	useEffect(() => {
		gatedSendRef.current = gatedSend;
	}, [gatedSend]);

	const stopGeneration = useCallback(() => {
		abortRef.current?.abort();
	}, [abortRef]);

	const clearChat = useCallback(() => {
		// Guard accidental wipes — export is one click away if needed.
		const hasContent =
			messages.length > 0 || compareMessages.length > 0;
		if (hasContent) {
			const ok =
				typeof window !== "undefined" &&
				window.confirm(
					"Clear this conversation? Local history in this browser will be removed.",
				);
			if (!ok) return;
		}
		setMessages([]);
		setCompareMessages([]);
		setError(null);
		setCompareError(null);
		try {
			localStorage.removeItem(scopedStorageKey);
			// WEB preference intentionally kept — users expect toggle to stick.
		} catch {
			/* private mode */
		}
		toast.success("Conversation cleared");
		setTimeout(() => inputRef.current?.focus(), 100);
	}, [
		scopedStorageKey,
		setError,
		setCompareError,
		setCompareMessages,
		setMessages,
		messages.length,
		compareMessages.length,
		toast,
	]);

	const handleCopy = useCallback(() => {
		if (!isChat) {
			toast.success("Copied to clipboard");
		}
		// Chat intentionally does NOT toast — the per-message inline copied state
		// already gives feedback, and a second success toast is noisy when the
		// user copies many messages in a row.
	}, [isChat, toast]);

	/**
	 * Regenerate the last assistant response (ChatGPT / Claude-style Retry).
	 * Drops the trailing assistant turn (and its paired user prompt if present),
	 * then re-sends the user prompt so history stays consistent.
	 */
	const handleRegenerate = useCallback(() => {
		if (loading || !checkSendAccess()) return;
		const current = messagesRef.current;
		const lastAss = current.findLast((m) => m.role === "assistant");
		if (!lastAss) {
			const lastUser = current.findLast((m) => m.role === "user");
			if (lastUser) void gatedSendRef.current(lastUser.content);
			return;
		}
		const assIdx = current.lastIndexOf(lastAss);
		const pairUser = current[assIdx - 1];
		if (!pairUser || pairUser.role !== "user") return;

		// Truncate up to but EXCLUDING the matched user prompt (we re-send it).
		const truncated = current.slice(0, assIdx - 1);
		setMessages(truncated);
		messagesRef.current = truncated;
		void gatedSendRef.current(pairUser.content);
	}, [loading, setMessages, checkSendAccess]);

	const exportConversation = useCallback((format: "json" | "txt" | "md" = "json") => {
		try {
			exportChatHistory(messages, format, conversationId);
		} catch (err) {
			log.warn("Failed to export conversation", err);
		}
	}, [messages, conversationId]);

	const importConversation = useCallback((importedMessages: Message[]) => {
		setMessages(importedMessages);
		setConversationId(genConversationId());
		toast.success("Conversation imported successfully");
	}, [setMessages, setConversationId]);

	const newConversation = useCallback(() => {
		setMessages([]);
		setCompareMessages([]);
		setError(null);
		setCompareError(null);
		setConversationId(genConversationId());
		setTimeout(() => inputRef.current?.focus(), 100);
	}, [
		setMessages,
		setCompareMessages,
		setError,
		setCompareError,
		setConversationId,
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

	const shareConversation = useConversationShare({
		isChat,
		messages,
		model,
		conversationId,
		conversationIdKey,
		toast,
		setConversationId,
		setShareStatus,
	});

		return (
		<div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-void font-sans text-text">
			<h1 className="sr-only">
				{isChat
					? "OMA Playground — text and multimodal LLM chat"
					: "OMA API Playground"}
			</h1>
			<MemoizedChatToolbar
				variant={variant}
				model={model}
				setModel={setModel}
				paramsOpen={paramsOpen}
				setParamsOpen={setParamsOpen}
				searching={searching}
				isAuthenticated={isAuthenticated}
				balance={balance}
				balanceDollars={balanceDollars}
				isLowBalance={isLowBalance}
				compareMode={compareMode}
				setCompareMode={setCompareMode}
				shareStatus={shareStatus}
				shareConversation={shareConversation}
				exportConversation={exportConversation}
				importConversation={importConversation}
				newConversation={newConversation}
				clearChat={clearChat}
				messagesLength={messages.length}
				deferredMessages={deferredMessages}
				setShortcutsOpen={setShortcutsOpen}
			/>

			<div className="flex-1 flex overflow-hidden bg-[color-mix(in_srgb,var(--color-surface)_40%,transparent)]">
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
						handleCopy={handleCopy}
						onRegenerate={handleRegenerate}
						onA2UIAction={(event) => {
							void gatedSendRef.current(formatA2UIAction(event));
						}}
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

					{/* Text composer — chat surface is text-only */}
					{isChat && (
						// Added safe-area-inset padding so the composer never sits flush
						// against the browser edge (mobile bottom bar / iOS notch home bar)
						// and there's breathing room above the copyright/footer.
						<div
							className="gutter-page z-10 flex-none border-t border-border bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md sm:pt-4 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
						>
							<div className="max-w-4xl mx-auto">
								<ChatErrorBanner
									error={error}
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
									disabled={!isReady || isLowBalance}
										disabledReason={!isReady ? "Checking your session…" : "Your credit balance is too low — top up to send"}
									modelUnavailable={isModelUnavailable}
									webSearchEnabled={webSearchEnabled}
									setWebSearchEnabled={
										showComposerAdvancedTools ? setWebSearchEnabled : undefined
									}
									uiMode={uiMode}
									setUiMode={showComposerAdvancedTools ? setUiMode : undefined}
									showAdvancedTools={showComposerAdvancedTools}
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
					)}
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

export function ChatPlaygroundShell(props: ChatPlaygroundShellProps) {
	return (
		<Suspense fallback={<ShellLoadingFallback />}>
			<LiveModelsProvider>
				<ShellContent {...props} />
			</LiveModelsProvider>
		</Suspense>
	);
}
