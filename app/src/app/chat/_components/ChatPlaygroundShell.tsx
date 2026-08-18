"use client";

import { AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
	Suspense,
	useCallback,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from "react";
import type { ExampleConversation, Message } from "@/components/chat";
import { balanceToDollars, useBalance } from "@/components/chat/useBalance";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { A2UI_SYSTEM_SUFFIX, formatA2UIAction } from "@/lib/a2ui";
import { genConversationId } from "@/lib/gen-id";
import { useAuth } from "@/lib/hooks/useAuth";
import { log } from "@/lib/logger";
import {
	conversationStorageKey,
	migrateLegacyConversation,
	systemPromptStorageKey,
} from "@/lib/chat-storage";
import {
	FREE_DEFAULT_CHAT_MODEL,
	isFreeChatModel,
} from "@/lib/model-utils";
import {
	freeLeftLabel,
	GUEST_DAILY_LIMIT_DEFAULT,
} from "@/lib/guest-daily-quota";
import { useChatPersistence } from "../_hooks/useChatPersistence";
import { useChatScroll } from "../_hooks/useChatScroll";
import { useChatShortcuts } from "../_hooks/useChatShortcuts";
import { useConversationShare } from "../_hooks/useConversationShare";
import { useGuestQuota } from "../_hooks/useGuestQuota";
import { usePlaygroundState } from "../_hooks/usePlaygroundState";
import { useStreamingChat } from "../_hooks/useStreamingChat";
import { LiveModelsProvider } from "@/components/chat/chat-message-shared";
import { AuthPromptModal } from "@/components/chat/AuthPromptModal";
import { exportChatHistory } from "@/lib/chat-export";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { ChatSettingsPanel } from "./ChatSettingsPanel";
import { ChatSystemPromptPanel } from "./ChatSystemPromptPanel";
import { MemoizedChatToolbar } from "./ChatToolbar";
import { MessagesList } from "./MessagesList";

const LazyMessageInput = dynamic(
	() =>
		import("@/components/chat/MessageInputRedesign").then(
			(mod) => mod.MessageInputRedesigned,
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
	storageKey,
	systemPromptKey,
	conversationIdKey,
}: ChatPlaygroundShellProps) {
	const isChat = variant === "chat";

	const [uiMode, setUiMode] = useState(false);

	const {
		model,
		setModel,
		messages,
		setMessages,
		input,
		setInput,
		loading,
		setLoading,
		error,
		setError,
		paramsOpen,
		setParamsOpen,
		showAdvanced,
		setShowAdvanced,
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
	} = usePlaygroundState();

	const toast = useToast();
	const { isAuthenticated, isReady, user } = useAuth();
	const scopedStorageKey = conversationStorageKey(user?.id ?? null);
	const scopedPromptKey = systemPromptStorageKey(user?.id ?? null);
	const { balance, loading: balanceLoading } = useBalance();
	const balanceDollars = balanceToDollars(balance);
	const LOW_BALANCE_THRESHOLD = 1;
	// Only flag low balance after a real balance payload arrives — treating
	// null/loading as $0 was flashing "LOW CREDITS — $0.00" on every cold load.
	const isLowBalance =
		isChat &&
		isAuthenticated &&
		balance != null &&
		!balanceLoading &&
		balanceDollars < LOW_BALANCE_THRESHOLD;

	// ─── Auth prompt modal (guest gating) ───
	const [authPromptOpen, setAuthPromptOpen] = useState(false);
	const [authPromptReason, setAuthPromptReason] = useState<
		"paid-model" | "message-limit"
	>("message-limit");
	const [authPromptModel, setAuthPromptModel] = useState<string>();

	const handleAuthRequired = useCallback(
		(modelName: string) => {
			setAuthPromptReason("paid-model");
			setAuthPromptModel(modelName);
			setAuthPromptOpen(true);
		},
		[],
	);

	// ─── Guest free-tier quota (server is source of truth) ───
	const handleQuotaExhausted = useCallback(() => {
		setAuthPromptReason("message-limit");
		setAuthPromptModel(undefined);
		setAuthPromptOpen(true);
	}, []);
	const { guestQuota, onDailyQuota, allowGuestSend } = useGuestQuota({
		isAuthenticated,
		onExhausted: handleQuotaExhausted,
	});

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

	useEffect(() => {
		if (isReady && !user?.id) migrateLegacyConversation();
	}, [isReady, user?.id]);

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

	// Keep sendMessageRef in sync for shortcuts + compare panel
	const sendMessageRef = useRef<(prompt?: string) => Promise<void>>(
		async () => {},
	);
	useEffect(() => {
		sendMessageRef.current = sendMessage;
	}, [sendMessage]);

	// Gated send: block only when remaining is known-zero (server/cache).
	// Successful quota updates come from response headers / 429 body.
	const gatedSend = useCallback(
		async (prompt?: string) => {
			if (!allowGuestSend()) return;
			await sendMessage(prompt);
		},
		[allowGuestSend, sendMessage],
	);
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
		setCompareMessages,
		setMessages,
		messages.length,
		compareMessages.length,
		toast,
	]);

	// Guests stay on free OMA-AI models so example/preset clicks never
	// switch them to a paid model that 401/402s without a key.
	const pickModelForGuest = useCallback(
		(candidate?: string) => {
			if (isAuthenticated) {
				return candidate;
			}
			if (candidate && isFreeChatModel(candidate)) return candidate;
			if (isFreeChatModel(model)) return model;
			return FREE_DEFAULT_CHAT_MODEL;
		},
		[isAuthenticated, model],
	);

		const handlePreset = useCallback(
			(prompt: string, modelOverride?: string) => {
				setInput(prompt);
				const next = pickModelForGuest(modelOverride);
				if (next) {
					setModel(next);
				}
				inputRef.current?.focus();
			},
			[setInput, setModel, pickModelForGuest],
		);

		const handleExampleSelect = useCallback(
			(example: ExampleConversation) => {
				setInput(example.prompt);
				setModel(pickModelForGuest(example.model) ?? FREE_DEFAULT_CHAT_MODEL);
				inputRef.current?.focus();
			},
			[setModel, setInput, pickModelForGuest],
		);

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
		if (loading) return;
		const current = messagesRef.current;
		const lastAss = current.findLast((m) => m.role === "assistant");
		if (!lastAss) return;
		const assIdx = current.lastIndexOf(lastAss);
		const pairUser = current[assIdx - 1];
		if (!pairUser || pairUser.role !== "user") return;

		// Truncate up to but EXCLUDING the matched user prompt (we re-send it).
		const truncated = current.slice(0, assIdx - 1);
		setMessages(truncated);
		messagesRef.current = truncated;
		void gatedSendRef.current(pairUser.content);
	}, [loading, setMessages]);

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
		setConversationId(genConversationId());
		setTimeout(() => inputRef.current?.focus(), 100);
	}, [setMessages, setCompareMessages, setError, setConversationId]);

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
				onAuthRequired={handleAuthRequired}
			/>

			<div className="flex-1 flex overflow-hidden bg-[color-mix(in_srgb,var(--color-surface)_40%,transparent)]">
				<section
					aria-label="Chat messages"
					className="flex-1 flex flex-col min-w-0 relative"
				>

						{isLowBalance && (
							<div
								role="status"
								className="flex-none flex items-center justify-between gap-3 px-4 md:px-6 lg:px-8 py-2 bg-warning/10 border-b border-warning/30 text-xs text-warning font-mono"
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
						handlePreset={handlePreset}
						handleExampleSelect={handleExampleSelect}
						inputRef={inputRef}
						onRegenerate={handleRegenerate}
						onA2UIAction={(event) => {
							void sendMessageRef.current(formatA2UIAction(event));
						}}
						isAuthenticated={isAuthenticated}
					/>

					{/* Text composer — chat surface is text-only */}
					{isChat && (
						// Added safe-area-inset padding so the composer never sits flush
						// against the browser edge (mobile bottom bar / iOS notch home bar)
						// and there's breathing room above the copyright/footer.
						<div
							className="flex-none px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4 sm:pb-5 lg:px-8 bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] border-t border-border shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md z-10"
							style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
						>
							<div className="max-w-4xl mx-auto">
								<ChatErrorBanner
									error={error}
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
									disabled={false}
									webSearchEnabled={webSearchEnabled}
									setWebSearchEnabled={setWebSearchEnabled}
									uiMode={uiMode}
									setUiMode={setUiMode}
								/>

								<div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 sm:mt-2.5 sm:px-2">
									<p className="text-[11px] text-text-muted/80 tracking-wide font-mono min-w-0 break-words select-none">
										{!isAuthenticated && (
											<span className="text-accent/80 font-semibold">
												{freeLeftLabel(guestQuota, GUEST_DAILY_LIMIT_DEFAULT)} free
												left
											</span>
										)}
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
			/>

			<AuthPromptModal
				open={authPromptOpen}
				onClose={() => setAuthPromptOpen(false)}
				reason={authPromptReason}
				modelName={authPromptModel}
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
