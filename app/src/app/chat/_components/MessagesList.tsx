"use client";

/**
	* MESSAGES LIST — Scrollable message area
	*
	* Renders the welcome banner + examples when no messages are present,
	* otherwise the message list with jump-to-bottom controls. The chat
	* surface is text + multimodal LLM only — no image / video studio.
	*/

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { ChevronDown, GitCompare, Keyboard } from "lucide-react";
import dynamic from "next/dynamic";
import type { RefObject } from "react";
import type { ExampleConversation, Message } from "@/components/chat";
import { A2UIRenderer, isA2UI, type A2UIActionEvent } from "@/components/chat/A2UIRenderer";
import { Skeleton } from "@/components/ui/Skeleton";

const LazyWelcomeBanner = dynamic(
	() =>
		import("@/components/chat/WelcomeBannerRedesign").then(
			(mod) => mod.WelcomeBanner,
		),
	{ ssr: false, loading: () => null },
);

const LazyExampleConversations = dynamic(
	() =>
		import("@/components/chat/ExampleConversations").then(
			(mod) => mod.ExampleConversations,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

const LazyChatMessage = dynamic(
	() =>
		import("@/components/chat/ChatMessageRedesign").then(
			(mod) => mod.ChatMessageRedesigned,
		),
	{
		ssr: false,
		loading: () => (
			<div className="flex gap-4">
				<Skeleton className="w-10 h-10 shrink-0 rounded-[var(--radius-sm)]" />
				<div className="flex flex-col max-w-[80%] gap-2">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-4 w-20" />
				</div>
			</div>
		),
	},
);

const LazyEmptyState = dynamic(
	() =>
		import("@/components/chat/ChatEmptyState").then(
			(mod) => mod.ChatEmptyState,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

/** Safe JSON parse that returns null on failure or non-object input. */
function safeJsonParse(s: string): unknown {
	try {
		const v = JSON.parse(s);
		if (v && typeof v === "object") return v;
		return null;
	} catch {
		return null;
	}
}

type Classification =
	| { kind: "plain" }
	| { kind: "a2ui"; payload: unknown };

// memoize message classification per content string so token
// flushes don't trigger repeated JSON.parse + isA2UI checks per render.
// Streaming text changes the content reference but the *classification*
// flips at most once per assistant message (when it finishes); the cache
// key uses content length so we re-evaluate at terminal chunks only.
/** LRU Cache with TTL for message classification.
	* - Max 1000 entries
	* - 30 minute TTL (1800000 ms)
	* - O(1) get/set operations
	*/
class ClassificationCache {
	private cache = new Map<string, { value: Classification; timestamp: number }>();
	private accessOrder = new Map<string, number>(); // key -> access counter
	private accessCounter = 0;
	private readonly maxSize = 1000;
	private readonly ttlMs = 30 * 60 * 1000; // 30 minutes

	get(key: string): Classification | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;

		// Check TTL
		if (Date.now() - entry.timestamp > this.ttlMs) {
			this.cache.delete(key);
			this.accessOrder.delete(key);
			return undefined;
		}

		// Update access order (LRU)
		this.accessCounter++;
		this.accessOrder.set(key, this.accessCounter);
		return entry.value;
	}

	set(key: string, value: Classification): void {
		// Evict expired entries first
		this.evictExpired();

		// If at capacity, evict LRU entry
		if (this.cache.size >= this.maxSize) {
			this.evictLRU();
		}

		this.accessCounter++;
		this.cache.set(key, { value, timestamp: Date.now() });
		this.accessOrder.set(key, this.accessCounter);
	}

	private evictExpired(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > this.ttlMs) {
				this.cache.delete(key);
				this.accessOrder.delete(key);
			}
		}
	}

	private evictLRU(): void {
		let oldestKey: string | null = null;
		let oldestAccess = Infinity;

		for (const [key, access] of this.accessOrder.entries()) {
			if (access < oldestAccess) {
				oldestAccess = access;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
			this.accessOrder.delete(oldestKey);
		}
	}

	clear(): void {
		this.cache.clear();
		this.accessOrder.clear();
		this.accessCounter = 0;
	}

	get size(): number {
		return this.cache.size;
	}
}

const classificationCache = new ClassificationCache();

/**
	* FNV-1a 32-bit hash of the content. Cheap, no deps, deterministic.
	* Used as the cache key so a streaming message that flips from plain → A2UI
	* after a partial JSONL envelope arrives re-classifies correctly.
	* (Previously the key was `${length}:${startsWithBrace}` — the same length
	* could hit a stale "plain" entry mid-stream and silently swallow A2UI.)
	*/
function contentHash(s: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(36);
}

function classifyMessage(content: string): Classification {
	// Hash the *full* content so a streaming message that grows into A2UI
	// gets a fresh cache key on each token flush.
	const key = `${content.length}:${contentHash(content)}`;
	const cached = classificationCache.get(key);
	if (cached) return cached;

	const trimmed = content.trimStart();
	let result: Classification;
	if (trimmed.startsWith("{")) {
		// Single object envelope, or a JSONL stream (one envelope per line).
		const parsed = safeJsonParse(trimmed);
		if (parsed && isA2UI(parsed)) {
			result = { kind: "a2ui", payload: parsed };
		} else if (isA2UI(trimmed)) {
			// JSONL: pass the raw string; the renderer parses line by line.
			result = { kind: "a2ui", payload: trimmed };
		} else {
			result = { kind: "plain" };
		}
	} else {
		result = { kind: "plain" };
	}

	classificationCache.set(key, result);
	return result;
}

export interface MessagesListProps {
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	messagesEndRef: RefObject<HTMLDivElement | null>;
	isScrolledAway: boolean;
	loading: boolean;
	jumpToBottom: () => void;
	handleScroll: () => void;
	deferredMessages: Message[];
	handleCopy: () => void;
	handlePreset: (prompt: string, model?: string) => void;
	handleExampleSelect: (example: ExampleConversation) => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	/** Regenerate the last assistant turn (ChatGPT-style Retry). */
	onRegenerate?: () => void;
	/** Fired when the user clicks an A2UI action button (server action event). */
	onA2UIAction?: (event: A2UIActionEvent) => void;
	/** Signed-in users skip guest marketing (welcome + example dump). */
	isAuthenticated?: boolean;
}

/**
	* Feature hints shown below the empty state on first visit.
	* These help users discover advanced capabilities they might
	* not find on their own (compare mode, system prompts, etc.).
	*/
const FEATURE_HINTS = [
	{
		icon: GitCompare,
		label: "Compare Models",
		description:
			"Try two models side-by-side with the COMPARE button in the toolbar",
	},
	{
		icon: Keyboard,
		label: "Shortcuts",
		description:
			"Press ? for keyboard shortcuts — Cmd+K models · Cmd+Shift+P params",
	},
];

const FEATURE_HINTS_KEY = "oma-chat-feature-hints-seen";

export function MessagesList({
	scrollContainerRef,
	messagesEndRef,
	isScrolledAway,
	loading,
	jumpToBottom,
	handleScroll,
	deferredMessages,
	handleCopy,
	handlePreset,
	handleExampleSelect,
	inputRef,
	onRegenerate,
	onA2UIAction,
	isAuthenticated = false,
}: MessagesListProps) {
	const showFeatureHints =
		deferredMessages.length === 0 &&
		(() => {
			try {
				return localStorage.getItem(FEATURE_HINTS_KEY) !== "1";
			} catch {
				return false;
			}
		})();

	return (
		<div
			ref={scrollContainerRef}
			onScroll={handleScroll}
			className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent relative"
		>
			<div
				className="pointer-events-none absolute inset-0 bg-grid-animated mask-radial"
				aria-hidden="true"
			/>
			<div className="max-w-4xl mx-auto relative z-0 min-h-full">
				{deferredMessages.length === 0 ? (
					<div className="pb-8">
						{!isAuthenticated && (
							<LazyWelcomeBanner
								onSelectExample={() => {
									const el = document.getElementById("example-conversations");
									el?.scrollIntoView({ behavior: "smooth", block: "start" });
								}}
								onGetStarted={() => {
									inputRef.current?.focus();
								}}
							/>
						)}
						<div className={isAuthenticated ? "pt-8 md:pt-16" : "pt-4 md:pt-6"}>
							<LazyEmptyState
								onPreset={handlePreset}
								signedIn={isAuthenticated}
							/>
						</div>
						{!isAuthenticated && (
							<LazyExampleConversations onSelect={handleExampleSelect} />
						)}

						{/* Feature discovery hints — guests only */}
						{showFeatureHints && !isAuthenticated && (
							<m.div
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.6, ...springs.soft }}
								className="mt-8 px-4 md:px-0"
							>
								<div className="max-w-4xl mx-auto">
									<h3 className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-3 font-bold">
										DISCOVER MORE
									</h3>
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
										{FEATURE_HINTS.map((hint, i) => (
											<div
												key={i}
												className="flex items-start gap-2.5 px-3 py-3 border border-border/40 bg-surface/30 text-[10px] font-mono text-text-muted"
											>
												<hint.icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-text-muted/50" />
												<div>
													<span className="font-bold text-text-secondary block mb-0.5">
														{hint.label}
													</span>
													<span className="leading-relaxed normal-case">
														{hint.description}
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							</m.div>
						)}
					</div>
				) : (
					<div className="space-y-3 md:space-y-4 pb-12">
						<AnimatePresence mode="popLayout">
							{deferredMessages.map((msg, index) => {
								const isLast = index === deferredMessages.length - 1;
								// Skip legacy empty assistant payloads (e.g. from
								// failed sends before history sanitizing) — they
								// render as hollow bubbles otherwise.
								const emptyAssistant =
									msg.role === "assistant" &&
									!msg.content?.trim() &&
									!msg.reasoning?.trim() &&
									!(loading && isLast);
								if (emptyAssistant) return null;
								// memoize the JSON-classification result per
								// message so SSE token flushes (which replace the
								// content array reference) don't re-parse every line
								// on every render. The cache lives in a ref because
								// we don't want it to trigger re-renders.
								const classification = classifyMessage(msg.content);
								if (classification.kind === "a2ui") {
									return (
										<div
											key={msg.id ?? `${msg.role}-${msg.timestamp}`}
											className="flex gap-4"
										>
											<A2UIRenderer payload={classification.payload} onAction={onA2UIAction} />
										</div>
									);
								}
								const isLastAssistant =
									msg.role === "assistant" && isLast;
								return (
									<LazyChatMessage
										key={msg.id ?? `${msg.role}-${msg.timestamp}`}
										msg={msg}
										loading={loading && isLastAssistant}
										onCopy={handleCopy}
										onRegenerate={
											isLastAssistant && !loading
												? onRegenerate
												: undefined
										}
										isLastAssistant={isLastAssistant}
									/>
								);
							})}
						</AnimatePresence>
						<div ref={messagesEndRef} />
						{/* Floating "Jump to bottom" pill — only visible while the
	user is scrolled up AND a response is loading. Standard
	chat-UI affordance (Discord, ChatGPT, Slack). */}
						<AnimatePresence>
							{isScrolledAway && loading && (
								<m.button
									type="button"
									onClick={jumpToBottom}
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 8 }}
									transition={springs.soft}
									aria-label="Jump to latest message"
									className="
	sticky bottom-4 left-1/2 -translate-x-1/2 z-10
	inline-flex items-center gap-1.5 rounded-full
	border border-accent/40 bg-accent/10
	px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-accent
	shadow-lg backdrop-blur-md hover:bg-accent/20 transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]
	min-h-[44px]
	focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
	"
								>
									<ChevronDown className="w-3 h-3" aria-hidden="true" />
									New messages
								</m.button>
							)}
						</AnimatePresence>
					</div>
				)}
			</div>
		</div>
	);
}
