"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
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
import { useAuth } from "@/lib/hooks/useAuth";
import { log } from "@/lib/logger";
import {
	FREE_DEFAULT_CHAT_MODEL,
	isFreeChatModel,
} from "@/lib/model-utils";
import {
	freeLeftLabel,
	GUEST_DAILY_LIMIT_DEFAULT,
	quotaFromServer,
	readStoredGuestQuota,
	writeStoredGuestQuota,
	type GuestQuota,
} from "@/lib/guest-daily-quota";
import { DEFAULT_API_URL } from "@/lib/config";
import { useChatPersistence } from "../_hooks/useChatPersistence";
import { useChatScroll } from "../_hooks/useChatScroll";
import { useChatShortcuts } from "../_hooks/useChatShortcuts";
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

function genConversationId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Appended to the system prompt while UI MODE is enabled. Instructs the
 * model to emit A2UI v0.9.1 envelopes (createSurface / updateComponents /
 * updateDataModel) so the playground can render interactive surfaces
 * (buttons, forms, cards) instead of plain markdown.
 */
const A2UI_SYSTEM_SUFFIX = `

[UI MODE] You are also a UI designer. When the user asks for an interface,
design, form, app, page, or anything visual or interactive, respond with ONE
A2UI v0.9.1 JSON object (no markdown code fences, no text before or after the
JSON) containing exactly these envelope keys, in order:
{"version":"v0.9.1","createSurface":{"surfaceId":"app","catalogId":"https://a2ui.org/specification/v0_9_1/catalogs/basic/catalog.json"},"updateComponents":{"surfaceId":"app","components":[...]},"updateDataModel":{"surfaceId":"app","path":"/","value":{...}}}

Component rules (flat adjacency list; every component has an id; one root id
is "root"; children are referenced by id in "children" or single "child"):
- "Text": {"id":"x","component":"Text","text":"...","variant":"h1"|"h2"|"h3"|"body"|"caption"}
- "Markdown": {"id":"x","component":"Markdown","markdown":"..."}
- "Button": {"id":"x","component":"Button","child":"label_id","variant":"primary"|"secondary"|"danger","action":{"event":{"name":"myEvent","context":{...}}}}
- "TextField": {"id":"x","component":"TextField","label":"Email","value":{"path":"/email"},"checks":[{"call":"required","message":"..."},{"call":"email","message":"..."}]}
- "CheckBox": {"id":"x","component":"CheckBox","label":"Subscribe","value":{"path":"/subscribe"}}
- "ChoicePicker": {"id":"x","component":"ChoicePicker","options":[{"label":"A","value":"a"}],"value":{"path":"/choice"}}
- "Row"/"Column": {"id":"x","component":"Column","children":["a","b"],"justify":"start"|"center"|"end"|"spaceBetween","align":"start"|"center"|"end"|"stretch"}
- "Card": {"id":"x","component":"Card","title":"...","child":"root"} — Card child is usually the root
- "Divider": {"id":"x","component":"Divider"}, "Icon": {"id":"x","component":"Icon","name":"mail"|"user"|"settings"|"check"|"sparkles"}, "Link": {"id":"x","component":"Link","url":"...","text":"..."}
Bind values to the data model with {"path":"/key"} instead of literal values
when they are user-editable. Keep the UI compact, dark-theme friendly, and
functional. If the request is not UI-related, answer normally.`;

/** Format an A2UI server action into a follow-up chat message. */
function formatA2UIAction(event: { name: string; context?: Record<string, unknown> }): string {
	const ctx = event.context && Object.keys(event.context).length > 0 ? `\n\nContext: \`\`\`json\n${JSON.stringify(event.context, null, 2)}\n\`\`\`` : "";
	return `[UI action: ${event.name}]${ctx}\n\nPlease continue — act on this UI action result.`;
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
	const { isAuthenticated } = useAuth();
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

	// ─── Free message quota for guests (server is source of truth) ───
	const [guestQuota, setGuestQuota] = useState<GuestQuota | null>(null);

	const applyGuestQuota = useCallback(
		(next: GuestQuota) => {
			setGuestQuota(next);
			writeStoredGuestQuota(next);
			if (next.remaining <= 0 && !isAuthenticated) {
				setAuthPromptReason("message-limit");
				setAuthPromptModel(undefined);
				// Don't force-open modal on every header sync — only when
				// the user hits the wall (gatedSend / 429). Callers set open.
			}
		},
		[isAuthenticated],
	);

	// Hydrate from localStorage, then refresh from GET /v1/usage/today.
	useEffect(() => {
		if (isAuthenticated) {
			setGuestQuota(null);
			return;
		}
		const cached = readStoredGuestQuota();
		if (cached) setGuestQuota(cached);

		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`${DEFAULT_API_URL}/v1/usage/today`, {
					credentials: "include",
					headers: { Accept: "application/json" },
				});
				if (!res.ok || cancelled) return;
				const body = (await res.json()) as {
					remaining?: number;
					limit?: number;
					used?: number;
				};
				if (cancelled) return;
				applyGuestQuota(quotaFromServer(body));
			} catch {
				/* offline — keep cache */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [isAuthenticated, applyGuestQuota]);

	const onDailyQuota = useCallback(
		(info: { remaining: number; limit: number; exhausted?: boolean }) => {
			if (isAuthenticated) return;
			applyGuestQuota(
				quotaFromServer({
					remaining: info.remaining,
					limit: info.limit,
					code: info.exhausted ? "daily_limit_exceeded" : undefined,
				}),
			);
			if (info.exhausted || info.remaining <= 0) {
				setAuthPromptReason("message-limit");
				setAuthPromptModel(undefined);
				setAuthPromptOpen(true);
			}
		},
		[applyGuestQuota, isAuthenticated],
	);

	/** Block send only when server (or cached) remaining is known-zero. */
	const allowGuestSend = useCallback(() => {
		if (isAuthenticated) return true;
		const left = freeLeftLabel(guestQuota, GUEST_DAILY_LIMIT_DEFAULT);
		if (guestQuota != null && left <= 0) {
			setAuthPromptReason("message-limit");
			setAuthPromptModel(undefined);
			setAuthPromptOpen(true);
			return false;
		}
		// Do NOT optimistically increment — failed/429 sends must not
		// burn the local counter ahead of the server.
		return true;
	}, [guestQuota, isAuthenticated]);

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
			} catch (e) {
				console.error('Failed to parse search config:', e)
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
			localStorage.removeItem(storageKey);
			// WEB preference intentionally kept — users expect toggle to stick.
		} catch {
			/* private mode */
		}
		toast.success("Conversation cleared");
		setTimeout(() => inputRef.current?.focus(), 100);
	}, [
		storageKey,
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
					setMediaMode("text");
				}
				inputRef.current?.focus();
			},
			[setInput, setModel, pickModelForGuest, setMediaMode],
		);
	
		const handleExampleSelect = useCallback(
			(example: ExampleConversation) => {
				setInput(example.prompt);
				setModel(pickModelForGuest(example.model) ?? FREE_DEFAULT_CHAT_MODEL);
				setMediaMode("text");
				inputRef.current?.focus();
			},
			[setModel, setInput, pickModelForGuest, setMediaMode],
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
		setExportStatus("loading");
		try {
			exportChatHistory(messages, format, conversationId);
			setExportStatus("success");
			setTimeout(() => setExportStatus("default"), 2000);
		} catch (err) {
			log.warn("Failed to export conversation", err);
			setExportStatus("error");
			setTimeout(() => setExportStatus("default"), 2000);
		}
	}, [messages, setExportStatus, conversationId]);

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
				} catch (e) {
					console.error('Failed to parse search config:', e)
				}
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
		<div className="h-[calc(100dvh-3.5rem)] w-full flex flex-col bg-void text-text font-sans overflow-hidden">
			<h1 className="sr-only">
				{isChat
					? "OMA Playground — chat, image, and video generation"
					: "OMA API Playground"}
			</h1>
			<MemoizedChatToolbar
				variant={variant}
				model={model}
				setModel={setModel}
				paramsOpen={paramsOpen}
				setParamsOpen={setParamsOpen}
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
								className="flex-none flex items-center justify-between gap-3 px-4 md:px-6 py-2 bg-warning/10 border-b border-warning/30 text-xs text-warning font-mono"
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
									Top up →
								</Link>
							</div>
						)}

					{/* System instructions only apply to text chat */}
					{mediaMode === "text" && (
						<ChatSystemPromptPanel
							systemPrompt={systemPrompt}
							setSystemPrompt={setSystemPrompt}
							systemPromptOpen={systemPromptOpen}
							setSystemPromptOpen={setSystemPromptOpen}
						/>
					)}

					<MessagesList
						scrollContainerRef={scrollContainerRef}
						messagesEndRef={messagesEndRef}
						isScrolledAway={isScrolledAway}
						loading={loading}
						jumpToBottom={jumpToBottom}
						handleScroll={handleScroll}
						deferredMessages={deferredMessages}
						mediaMode={isChat ? mediaMode : "text"}
						onMediaKindChange={(kind) => setMediaMode(kind)}
						handleCopy={handleCopy}
						handlePreset={handlePreset}
						handleExampleSelect={handleExampleSelect}
						inputRef={inputRef}
						onRegenerate={handleRegenerate}
						onA2UIAction={(event) => {
							void sendMessageRef.current(formatA2UIAction(event));
						}}
					/>

					{/* Text composer only for chat mode — image/video use their own panels */}
					{mediaMode === "text" && (
						// Added safe-area-inset padding so the composer never sits flush
						// against the browser edge (mobile bottom bar / iOS notch home bar)
						// and there's breathing room above the copyright/footer.
						<div
							className="flex-none px-4 pt-3 pb-4 sm:px-6 sm:pt-4 sm:pb-5 bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] border-t border-border shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md z-10"
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
												Low credits — top up for paid models →
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
