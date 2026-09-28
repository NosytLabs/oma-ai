"use client";

/**
	* MESSAGES LIST — Scrollable message area
	*
	* Renders the starter surface when no messages are present, otherwise the
	* message list with jump-to-bottom controls. The chat
	* surface is text + multimodal LLM only — no image / video studio.
	*/

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { ChevronDown } from "lucide-react";
import type { RefObject } from "react";
import type { Message } from "@/components/chat";
import { A2UIRenderer, isA2UI, type A2UIActionEvent } from "@/components/chat/A2UIRenderer";
import { ChatEmptyState, type EmptyStateProps } from "@/components/chat/ChatEmptyState";
import { ChatMessageed } from "@/components/chat/ChatMessage";

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

export function classifyMessage(content: string): Classification {
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
		// The A2UI envelope may arrive AFTER a prose preamble — e.g. when web
		// search prepends a "N SOURCES" block to the model's reply. The model
		// emits a valid `{ createSurface / updateComponents / ... }` envelope
		// as the last JSON object in the message, but because the content does
		// not START with `{`, the old logic bailed to plain text and dumped the
		// whole JSON spec (escaped quotes included) as raw markdown. Detect an
		// embedded envelope by scanning from the last top-level `{` object and
		// re-parsing — so WEB + A2UI responses still render as interactive UI.
		result = detectEmbeddedA2UI(trimmed);
	}

	classificationCache.set(key, result);
	return result;
}

/**
 * Search for an A2UI envelope embedded in text whose first characters are
 * NOT a brace — e.g. a web-search "N SOURCES" preamble that the model's reply
 * (a valid `{ createSurface / updateComponents / ... }` envelope) follows.
 * Without this, such a message was classified "plain" and the whole JSON spec
 * (escaped quotes included) dumped as raw markdown instead of an interactive
 * UI. We collect every balanced top-level `{...}` object in the text plus
 * JSONL lines, then test the LAST one first (models append the envelope last).
 */
function detectEmbeddedA2UI(text: string): Classification {
	if (!text.includes("{")) return { kind: "plain" };

	// Each balanced top-level JSON object, in document order, and line-JSONs.
	const candidates: string[] = [];
	let depth = 0;
	let openAt = -1;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "{") {
			if (depth === 0) openAt = i;
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0 && openAt >= 0) {
				candidates.push(text.slice(openAt, i + 1));
				openAt = -1;
			}
		}
	}
	for (const line of text.split("\n")) {
		const t = line.trim();
		if (t.startsWith("{") && t.endsWith("}")) candidates.push(t);
	}

	// Check the last candidate first (models append the envelope last).
	for (let i = candidates.length - 1; i >= 0; i--) {
		const parsed = safeJsonParse(candidates[i]);
		if (parsed && isA2UI(parsed)) return { kind: "a2ui", payload: parsed };
	}
	if (isA2UI(text)) return { kind: "a2ui", payload: text };
	return { kind: "plain" };
}


interface MessagesListProps {
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	messagesEndRef: RefObject<HTMLDivElement | null>;
	isScrolledAway: boolean;
	loading: boolean;
	jumpToBottom: () => void;
	handleScroll: () => void;
	deferredMessages: Message[];
	handleCopy: () => void;
	/** Regenerate the last assistant turn (ChatGPT-style Retry). */
	onRegenerate?: () => void;
	/** Fired when the user clicks an A2UI action button (server action event). */
	onA2UIAction?: (event: A2UIActionEvent) => void;
	/** Signed-in users skip guest marketing (welcome + example dump). */
	isAuthenticated?: boolean;
	emptyStateProps?: Omit<EmptyStateProps, "signedIn" | "onPickPrompt">;
	/**
	 * Seeds the composer when a starter prompt is clicked. Threaded in from
	 * the shell (which owns the input state) rather than imported, so the
	 * empty state stays a pure presentational component.
	 */
	onPickPrompt?: (prompt: string) => void;
}

export function MessagesList({
	scrollContainerRef,
	messagesEndRef,
	isScrolledAway,
	loading,
	jumpToBottom,
	handleScroll,
	deferredMessages,
	handleCopy,
	onRegenerate,
	onA2UIAction,
	isAuthenticated = false,
	emptyStateProps,
	onPickPrompt,
}: MessagesListProps) {
	return (
		<div
			ref={scrollContainerRef}
			onScroll={handleScroll}
			className="gutter-page relative flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent sm:py-5 md:py-6 lg:py-8"
		>
			<div
				className="pointer-events-none absolute inset-0 bg-grid-animated mask-radial"
				aria-hidden="true"
			/>
			<div className="max-w-4xl mx-auto relative z-0 min-h-full">
				{deferredMessages.length === 0 ? (
					<div className="pb-8">
						{/*
						  The empty state reserved min-h-[58vh]/md:min-h-[62vh]
						  around ~250px of content, so at 1440x900 the
						  scroll area held a 558px box whose text sat
						  between 166px of padding above and 142px below
						  — a ~300px void between the model selector and
						  the composer. The starter prompts below fill
						  that space with something useful, so the box
						  only needs to clear the composer rather than
						  claim a fixed share of the viewport.
						*/}
						<div
							className={
								isAuthenticated
									? "pt-8 md:pt-16"
									: "flex flex-col justify-center pt-6 md:pt-10"
							}
						>
							<ChatEmptyState {...emptyStateProps} signedIn={isAuthenticated} onPickPrompt={onPickPrompt} />
						</div>
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
									<ChatMessageed
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
