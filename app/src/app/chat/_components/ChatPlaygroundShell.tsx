"use client";

import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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
import { useWallet } from "@/components/wallet-provider";
import { log } from "@/lib/logger";
import { useChatPersistence } from "../_hooks/useChatPersistence";
import { useChatScroll } from "../_hooks/useChatScroll";
import { useChatShortcuts } from "../_hooks/useChatShortcuts";
import { usePlaygroundState } from "../_hooks/usePlaygroundState";
import { useStreamingChat } from "../_hooks/useStreamingChat";
import { ChatErrorBanner } from "./ChatErrorBanner";
import { ChatSettingsPanel } from "./ChatSettingsPanel";
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

function genConversationId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ShellContent({
	variant,
	storageKey,
	systemPromptKey,
	conversationIdKey,
}: ChatPlaygroundShellProps) {
	const isChat = variant === "chat";

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
		exportStatus,
		setExportStatus,
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
		mediaMode,
		setMediaMode,
	} = usePlaygroundState();

	const toast = useToast();
	const { isAuthenticated } = useWallet();
	const { balance } = useBalance();
	const balanceDollars = balanceToDollars(balance);
	const LOW_BALANCE_THRESHOLD = 1;
	const isLowBalance =
		isChat &&
		isAuthenticated &&
		balanceDollars < LOW_BALANCE_THRESHOLD &&
		balanceDollars >= 0;

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
			} catch {}
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
		storageKey,
		systemPromptKey,
	});

	const {
		scrollContainerRef,
		messagesEndRef,
		isNearBottomRef,
		isScrolledAway,
		handleScroll,
		jumpToBottom,
	} = useChatScroll(loading, messages);

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
		systemPrompt,
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
	});

	// Keep sendMessageRef in sync for shortcuts + compare panel
	const sendMessageRef = useRef<(prompt?: string) => Promise<void>>(
		async () => {},
	);
	useEffect(() => {
		sendMessageRef.current = sendMessage;
	}, [sendMessage]);

	useChatShortcuts({
		sendMessageRef,
		input,
		loading,
		shortcutsOpen,
		setShortcutsOpen,
		paramsOpen,
		setParamsOpen,
		compareMode,
		setCompareMode,
	});

	const stopGeneration = useCallback(() => {
		abortRef.current?.abort();
	}, [abortRef]);

	const clearChat = useCallback(() => {
		setMessages([]);
		setCompareMessages([]);
		setError(null);
		localStorage.removeItem(storageKey);
		setTimeout(() => inputRef.current?.focus(), 100);
	}, [storageKey, setError, setCompareMessages, setMessages]);

	const handlePreset = useCallback(
		(prompt: string, modelOverride?: string) => {
			setInput(prompt);
			if (modelOverride) setModel(modelOverride);
			inputRef.current?.focus();
		},
		[setInput, setModel],
	);

	const handleExampleSelect = useCallback(
		(example: ExampleConversation) => {
			setInput(example.prompt);
			setModel(example.model);
			inputRef.current?.focus();
		},
		[setModel, setInput],
	);

	const handleCopy = useCallback(() => {
		if (!isChat) {
			toast.success("Copied to clipboard");
		}
		// Chat intentionally does NOT toast — the per-message inline copied state
		// already gives feedback, and a second success toast is noisy when the
		// user copies many messages in a row.
	}, [isChat, toast]);

	const exportConversation = useCallback(() => {
		setExportStatus("loading");
		try {
			const data = JSON.stringify(messages, null, 2);
			const blob = new Blob([data], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `oma-export-${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);
			setExportStatus("success");
			setTimeout(() => setExportStatus("default"), 2000);
		} catch (err) {
			log.warn("Failed to export conversation", err);
			setExportStatus("error");
			setTimeout(() => setExportStatus("default"), 2000);
		}
	}, [messages, setExportStatus]);

	const shareConversation = useCallback(async () => {
		if (messages.length === 0) return;
		const origin = typeof window !== "undefined" ? window.location.origin : "";

		if (isChat) {
			// Chat: copy a link that opens chat with the current model pre-selected
			const url = `${origin}/chat?model=${encodeURIComponent(model)}`;
			setShareStatus("default");
			try {
				await navigator.clipboard.writeText(url);
				setShareStatus("success");
				toast.success(
					`Model link copied — opens chat with ${model} pre-selected`,
				);
				setTimeout(() => setShareStatus("default"), 2000);
			} catch {
				setShareStatus("error");
				toast.error("Could not copy link — check clipboard permissions");
				setTimeout(() => setShareStatus("default"), 2000);
			}
		} else {
			// Playground: copy a replay link with conversation id + message count
			let cid = conversationId;
			if (!cid && conversationIdKey) {
				cid = genConversationId();
				setConversationId(cid);
				try {
					localStorage.setItem(conversationIdKey, cid);
				} catch {}
			}
			const userMessageCount = messages.filter((m) => m.role === "user").length;
			const url = `${origin}/chat?cid=${encodeURIComponent(cid ?? "")}&msgs=${userMessageCount}&model=${encodeURIComponent(model)}`;
			setShareStatus("default");
			try {
				await navigator.clipboard.writeText(url);
				setShareStatus("success");
				toast.success("Replay link copied to clipboard");
				setTimeout(() => setShareStatus("default"), 2000);
			} catch {
				setShareStatus("error");
				toast.error("Could not copy share link — check clipboard permissions");
				setTimeout(() => setShareStatus("default"), 2000);
			}
		}
	}, [
		isChat,
		messages,
		model,
		conversationId,
		conversationIdKey,
		toast,
		setShareStatus,
	]);

	return (
		<div className="min-h-dvh h-dvh w-full flex flex-col bg-void text-text-secondary font-mono overflow-hidden">
			<h1 className="sr-only">{isChat ? "OMA Chat" : "OMA API Playground"}</h1>
			<MemoizedChatToolbar
				variant={variant}
				model={model}
				setModel={setModel}
				paramsOpen={paramsOpen}
				setParamsOpen={setParamsOpen}
				webSearchEnabled={webSearchEnabled}
				setWebSearchEnabled={setWebSearchEnabled}
				mediaMode={mediaMode}
				setMediaMode={setMediaMode}
				searching={searching}
				isAuthenticated={isAuthenticated}
				balance={balance}
				balanceDollars={balanceDollars}
				isLowBalance={isLowBalance}
				compareMode={compareMode}
				setCompareMode={setCompareMode}
				shareStatus={shareStatus}
				shareConversation={shareConversation}
				exportStatus={exportStatus}
				exportConversation={exportConversation}
				clearChat={clearChat}
				messagesLength={messages.length}
				deferredMessages={deferredMessages}
				setShortcutsOpen={setShortcutsOpen}
			/>

			<div className="flex-1 flex overflow-hidden bg-void">
				<section
					aria-label="Chat messages"
					className="flex-1 flex flex-col min-w-0 border-r border-border relative"
				>
					{isLowBalance && (
						<div
							role="status"
							className="flex-none flex items-center justify-between gap-3 px-4 md:px-8 py-2 bg-warning/10 border-b border-warning/30 text-[11px] text-warning font-mono"
						>
							<span className="flex items-center gap-2 uppercase tracking-wider">
								<AlertTriangle
									className="w-3.5 h-3.5 shrink-0"
									aria-hidden="true"
								/>
								Low credits — ${balanceDollars.toFixed(2)} remaining
							</span>
							<Link
								href="/deposit"
								className="px-2 py-0.5 bg-accent text-void text-[10px] font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors"
							>
								Top up →
							</Link>
						</div>
					)}

					<div className="flex-none border-b border-border bg-void">
						<button
							type="button"
							onClick={() => setSystemPromptOpen(!systemPromptOpen)}
							aria-expanded={systemPromptOpen}
							aria-label="Toggle system prompt"
							className="w-full flex items-center justify-between px-4 md:px-8 py-2 text-[10px] font-mono text-text-muted uppercase tracking-widest hover:text-text-secondary transition-colors focus-ring"
						>
							<span className="flex items-center gap-2">
								<span
									className={`w-1.5 h-1.5 rounded-full ${systemPrompt.trim() ? "bg-success" : "bg-surface-elevated"}`}
								/>
								{isChat ? "Instructions" : "SYSTEM PROMPT"}{" "}
								{systemPrompt.trim()
									? isChat
										? "· Active"
										: "· SET"
									: isChat
										? "· Optional"
										: "· OPTIONAL"}
							</span>
							{systemPromptOpen ? (
								<ChevronUp className="w-3 h-3" />
							) : (
								<ChevronDown className="w-3 h-3" />
							)}
						</button>
						{systemPromptOpen && (
							<div className="px-4 md:px-8 pb-3">
								<textarea
									value={systemPrompt}
									onChange={(e) => setSystemPrompt(e.target.value)}
									placeholder="Set behavior, persona, or instructions for the model. Sent as the first message of every request."
									aria-label="System prompt"
									rows={3}
									className="w-full resize-y bg-surface border border-border px-3 py-2 text-xs text-text-secondary font-mono leading-relaxed placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
									style={{ minHeight: "60px", maxHeight: "160px" }}
								/>
							</div>
						)}
					</div>

					<MessagesList
						scrollContainerRef={scrollContainerRef}
						messagesEndRef={messagesEndRef}
						isScrolledAway={isScrolledAway}
						loading={loading}
						jumpToBottom={jumpToBottom}
						handleScroll={handleScroll}
						deferredMessages={deferredMessages}
						mediaMode={isChat ? mediaMode : "text"}
						handleCopy={handleCopy}
						handlePreset={handlePreset}
						handleExampleSelect={handleExampleSelect}
						inputRef={inputRef}
					/>

						<div className="flex-none p-4 bg-void border-t border-border">
							<div className="max-w-4xl mx-auto">
								<ChatErrorBanner
									error={error}
									onDismiss={() => setError(null)}
									onRetry={() => {
										setError(null);
										if (input.trim()) sendMessage();
									}}
								/>

								<LazyMessageInput
									input={input}
									setInput={setInput}
									onSubmit={sendMessage}
									onStop={stopGeneration}
									loading={loading}
									textareaRef={inputRef}
								/>

								<div className="flex items-center justify-between mt-2 px-1">
									<p className="text-[10px] text-text-muted uppercase tracking-widest">
										[ENTER] EXECUTE · [SHIFT+ENTER] NEWLINE
									</p>
									<LazyCostEstimate
										inputText={input}
										model={model}
										maxTokens={maxTokens}
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
						void sendMessageRef.current(text);
					}
				}}
				loading={loading}
				compareMessages={compareMessages}
			/>
		</div>
	);
}

function ShellLoadingFallback() {
	return (
		<div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">
			<Skeleton className="h-8 w-48" />
			<div className="flex gap-4">
				<Skeleton className="w-10 h-10 shrink-0 rounded" />
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
			<ShellContent {...props} />
		</Suspense>
	);
}
