"use client";

/**
 * CHAT MESSAGE REDESIGN — Frontend-Design Skill Application
 *
 * Design Direction: "Terminal Noir" — A cinematic take on terminal aesthetics.
 * Think: Blade Runner meets a high-end code editor. Dark, atmospheric,
 * with moments of emerald accent glow that feel earned, not decorative.
 *
 * Typography: JetBrains Mono (code/labels) + DM Sans (body prose)
 * — DM Sans is geometric with soft ink traps, avoiding the coldness
 * of Inter while staying clean. JetBrains Mono for all code/data.
 *
 * Key Principles Applied:
 * - Asymmetric layout: user messages shift right with a subtle skew
 * - Depth through layered shadows and ambient glow on assistant side
 * - Staggered entrance animations for message groups
 * - Atmospheric background with animated grain + subtle radial glow
 * - Typography hierarchy: display → body → micro-copy
 */

import { AnimatePresence, m, useReducedMotion } from "@/lib/framer-motion-client";
import { ThinkingOrb } from "thinking-orbs";
import {
	AlertTriangle, Bot, Brain, Check, ChevronDown, ChevronUp, Clock, Copy, RefreshCw, Search, User,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { copyToClipboard } from "@/lib/clipboard";
import { estimateTokens } from "@/lib/text";
import {
	isWaitingForFirstToken,
	shouldExpandReasoning,
} from "./message-stream-ui";
import {
	FALLBACK_MODELS,
	type Message,
	type ModelOption,
	type SearchResult,
	type TierFilter,
	useLiveModels,
} from "./chat-message-shared";

// ═══════════════════════════════════════════════════════════════════
// STAGGERED ENTRANCE — Messages appear in a cascade, not all at once
// ═══════════════════════════════════════════════════════════════════

const messageVariants = {
	hidden: (isUser: boolean) => ({
		opacity: 0,
		x: isUser ? 24 : -24,
		y: 12,
		scale: 0.97,
		rotate: isUser ? 0.5 : -0.5, // Micro-rotation for organic feel
	}),
	visible: {
		opacity: 1,
		x: 0,
		y: 0,
		scale: 1,
		rotate: 0,
		transition: {
			type: "spring" as const,
			stiffness: 260,
			damping: 24,
			mass: 0.8,
		},
	},
	exit: {
		opacity: 0,
		y: -8,
		scale: 0.98,
		transition: { duration: 0.15 },
	},
};

// ═══════════════════════════════════════════════════════════════════
// REDESIGNED ChatMessage COMPONENT
// ═══════════════════════════════════════════════════════════════════

export const ChatMessageRedesigned = memo(function ChatMessageRedesigned({
	msg,
	loading,
	onCopy,
	onRegenerate,
	isLastAssistant,
}: {
	msg: Message;
	loading: boolean;
	onCopy: (content: string) => void;
	/** Regenerate this turn (last assistant only). */
	onRegenerate?: () => void;
	isLastAssistant?: boolean;
}) {
	const isUser = msg.role === "user";
	const [copied, setCopied] = useState(false);
	const [reasoningExpanded, setReasoningExpanded] = useState(false);
	// Show sources expanded by default when web search attached results —
	// free-guest WEB mode should make citations obvious, not buried.
	const [sourcesExpanded, setSourcesExpanded] = useState(
		() => !!(msg.searchResults && msg.searchResults.length > 0),
	);
	// Expand when results arrive after mount (streaming attaches them late).
	useEffect(() => {
		if (msg.searchResults && msg.searchResults.length > 0) {
			setSourcesExpanded(true);
		}
	}, [msg.searchResults]);
	const prefersReducedMotion = useReducedMotion() ?? false;
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
		};
	}, []);

	const handleCopy = useCallback(() => {
		void copyToClipboard(msg.content).then((ok) => {
			if (!ok) return;
			setCopied(true);
			if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
			copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
			onCopy(msg.content);
		});
	}, [msg.content, onCopy]);

	const time = new Date(msg.timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});

	const isAssistant = msg.role === "assistant";
	const isStreaming = loading && isAssistant;
	const hasReasoning =
		!isUser && !!msg.reasoning && msg.reasoning.trim().length > 0;
	const waitingForFirstToken = isWaitingForFirstToken({
		streaming: isStreaming,
		content: msg.content,
		reasoning: msg.reasoning,
	});
	const isActivelyStreaming = isStreaming && msg.content.length > 0;

	const showReasoningExpanded = shouldExpandReasoning({
		streaming: isStreaming,
		content: msg.content,
		reasoning: msg.reasoning,
		userExpanded: reasoningExpanded,
	});

	return (
		<m.div
			custom={isUser}
			initial={prefersReducedMotion ? false : "hidden"}
			animate={prefersReducedMotion ? {} : "visible"}
			exit={prefersReducedMotion ? { opacity: 0 } : "exit"}
			variants={prefersReducedMotion ? undefined : messageVariants}
			layout={!prefersReducedMotion}
			className={`
        group relative
        ${
					isUser
						? "flex flex-row-reverse gap-2 sm:gap-3 md:gap-4 pl-3 sm:pl-12 md:pl-20"
						: "flex flex-row gap-2 sm:gap-3 md:gap-4 pr-3 sm:pr-12 md:pr-20"
				}
      `}
		>
			{/* ─── AVATAR: Glowing orb for assistant, sharp badge for user ─── */}
<div className="relative shrink-0">
				<div
					className={`
						w-10 h-10 flex items-center justify-center relative z-20
						${
							isUser
								? "bg-accent/10 border border-accent/30 text-accent"
								: "bg-surface border border-border text-text-muted"
						}
					`}
					style={{
						borderRadius: isUser ? "6px" : "10px",
					}}
				>
					{isUser ? (
						<User className="w-4 h-4" strokeWidth={1.75} />
					) : isStreaming ? (
						prefersReducedMotion ? (
							<span
								aria-label={
									msg.searchResults && msg.searchResults.length > 0
										? "Searching the web"
										: hasReasoning && !msg.content
											? "Reasoning"
											: "Composing response"
								}
								role="status"
								className="relative inline-flex h-4 w-4 items-center justify-center"
							>
								<span className="absolute inline-flex h-full w-full rounded-full bg-accent/40 animate-ping" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
							</span>
						) : (
							<ThinkingOrb
								state={
									msg.searchResults && msg.searchResults.length > 0
										? "searching"
										: hasReasoning && !msg.content
											? "solving"
											: "composing"
								}
								size={20}
								theme="auto"
								aria-label={
									msg.searchResults && msg.searchResults.length > 0
										? "Searching the web"
										: hasReasoning && !msg.content
											? "Reasoning"
											: "Composing response"
								}
							/>
						)
					) : (
						<Bot className="w-4 h-4" strokeWidth={1.75} />
					)}
				</div>
				{/* Ambient glow behind assistant avatar */}
				{!isUser && (
					<div
						className="absolute inset-0 -z-10 blur-xl opacity-40"
						style={{
							background:
								"radial-gradient(circle, var(--color-accent-glow), transparent 70%)",
						}}
					/>
				)}
			</div>

			{/* ─── MESSAGE BODY ─── */}
<div
					className={`min-w-[8rem] max-w-full flex-1 max-sm:max-w-[90%] sm:max-w-[78%] ${isUser ? "flex flex-col items-end" : "flex flex-col items-start"}`}
			>
				{/* Search Sources */}
				{msg.searchResults && msg.searchResults.length > 0 && (
					<SearchSources
						results={msg.searchResults}
						expanded={sourcesExpanded}
						onToggle={() => setSourcesExpanded(!sourcesExpanded)}
						prefersReducedMotion={prefersReducedMotion}
					/>
				)}

				{/* Reasoning Section */}
				{hasReasoning && (
					<ReasoningBlock
						// biome-ignore lint/style/noNonNullAssertion: value is guaranteed by preceding check
						reasoning={msg.reasoning!}
						expanded={showReasoningExpanded}
						onToggle={() => setReasoningExpanded(!reasoningExpanded)}
						isStreaming={isStreaming && !msg.content}
						prefersReducedMotion={prefersReducedMotion}
					/>
				)}

				{/* ─── THE BUBBLE ─── */}
				<div
					className={`
            relative inline-block max-w-full px-4 py-3.5 leading-relaxed font-mono text-sm break-words [overflow-wrap:anywhere] sm:px-5
            ${
							isUser
								? "bg-accent/[0.08] border border-accent/25 text-text border-r-0"
								: "bg-white/[0.06] border border-white/[0.08] text-text-secondary border-l-0"
						}
          `}
					style={{
						// Asymmetric border-radius for visual interest
						borderRadius: isUser
							? "14px 4px 14px 14px" // Sharp top-right (toward avatar)
							: "4px 14px 14px 14px", // Sharp top-left (toward avatar)
						// Subtle depth on assistant messages
						boxShadow: isUser
							? "0 0 0 1px rgba(70,211,154,0.05), 0 4px 16px -8px var(--color-accent-glow)"
							: "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px -4px rgba(0,0,0,0.4)",
					}}
				>
					{/* Ambient glow line along the inner edge */}
					<div
						className="absolute top-0 h-full w-px"
						style={{
							opacity: isUser ? 0.4 : 0.5,
							[isUser ? "right" : "left"]: 0,
							background: `linear-gradient(
                to bottom,
                transparent,
                var(--color-accent) 30%,
                var(--color-accent) 70%,
                transparent
              )`,
						}}
					/>

					{isUser ? (
						<p className="whitespace-pre-wrap break-words text-[15px]">{msg.content}</p>
					) : (
						<div className="markdown-content max-w-full min-w-0 break-words font-sans text-[15px] leading-relaxed [overflow-wrap:anywhere]" aria-live="polite">
							{/* While the model is still streaming, render plain text —
							    ReactMarkdown would otherwise emit literal `**` and other
							    punctuation for partial markdown tokens. We swap to the
							    markdown renderer the moment streaming ends so the final
							    answer gets full formatting (bold, code, lists, links). */}
							{isStreaming ? (
								<p className="whitespace-pre-wrap break-words">{msg.content}</p>
							) : (
								<ReactMarkdown
									remarkPlugins={[remarkGfm]}
									components={{
										code({ className, children, ...props }) {
											const match = /language-(\w+)/.exec(className || "");
											const text = String(children ?? "");
											const isInline = !match && !text.includes("\n");
											return isInline ? (
												<code
													className="px-1.5 py-0.5 bg-surface-elevated text-accent-bright font-mono text-[13px] rounded-sm"
													{...props}
												>
													{String(children)}
												</code>
											) : (
												<CodeBlock className={className}>
													{text.replace(/\n$/, "")}
												</CodeBlock>
											);
										},
									}}
								>
									{msg.content}
								</ReactMarkdown>
							)}
							{isActivelyStreaming && (
								<span
									className="caret-blink inline-block align-baseline"
									aria-hidden="true"
								/>
							)}
							{waitingForFirstToken && (
								<span className="inline-flex items-center gap-2 text-text-muted" role="status">
									{prefersReducedMotion ? (
										<span
											className="relative inline-flex h-3.5 w-3.5 items-center justify-center"
											aria-hidden="true"
										>
											<span className="absolute inline-flex h-full w-full rounded-full bg-accent/40 animate-ping" />
											<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
										</span>
									) : (
										<ThinkingOrb
											state="composing"
											size={20}
											theme="auto"
											aria-hidden="true"
										/>
									)}
									<span className="text-xs font-mono uppercase tracking-wider">
										Thinking…
									</span>
								</span>
							)}
						</div>
					)}
				</div>

				{/* ─── METADATA ROW ─── */}
				<div
					className={`
            mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary font-mono
            ${isUser ? "flex-row-reverse" : "flex-row"} select-none
          `}
				>
					<span className="text-text-secondary">{time}</span>
					{(msg.outputTokens ??
						(msg.content ? estimateTokens(msg.content) : 0)) > 0 && (
						<span className="px-1.5 py-0.5 bg-surface-elevated border border-border text-[10px] text-text-secondary">
							TK:{msg.outputTokens ?? estimateTokens(msg.content)}
						</span>
					)}
					{msg.latency && (
						<span className="flex items-center gap-1 opacity-60">
							<Clock className="w-3 h-3" />
							{formatTime(msg.latency)}
						</span>
					)}
					{!isUser && msg.truncated && (
						<span
							className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-warning/10 border border-warning/30 text-warning text-[9px] font-mono uppercase tracking-wider"
							title="The model hit the max_tokens budget mid-answer. Hit Retry to get a complete response."
						>
							<AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
							Truncated
						</span>
					)}
					{!isUser && msg.content && !loading && (
						<>
							<button
								type="button"
								onClick={handleCopy}
								aria-label={copied ? "Copied to clipboard" : "Copy message"}
								className="
                flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2 py-1
                opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                hover:text-success active:scale-[0.97] transition-all duration-150 ease-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-surface
              "
							>
								{copied ? (
									<Check className="w-3 h-3 text-success" />
								) : (
									<Copy className="w-3 h-3" />
								)}
								{copied ? "COPIED" : "COPY"}
							</button>
							{isLastAssistant && onRegenerate && (
<button
								type="button"
								onClick={onRegenerate}
								aria-label="Regenerate response"
								className="
                flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2 py-1
                opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                hover:text-accent active:scale-[0.97] transition-all duration-150 ease-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-surface
              "
								>
									<RefreshCw className="w-3 h-3" aria-hidden="true" />
									<span className="text-[10px] uppercase tracking-wide">
										Retry
									</span>
								</button>
							)}
						</>
					)}
				</div>
			</div>
		</m.div>
	);
});
// ═══════════════════════════════════════════════════════════════════
// REASONING BLOCK — Collapsible thinking section
// ═══════════════════════════════════════════════════════════════════

function ReasoningBlock({
	reasoning,
	expanded,
	onToggle,
	isStreaming,
	prefersReducedMotion,
}: {
	reasoning: string;
	expanded: boolean;
	onToggle: () => void;
	isStreaming: boolean;
	prefersReducedMotion: boolean;
}) {
	return (
		<div className="mb-3 w-full border border-border/40 bg-surface/20 overflow-hidden rounded-sm">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				aria-controls="reasoning-content"
				className="
          group/reason w-full flex items-center justify-between px-4 py-2.5
          hover:bg-surface-elevated/40 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        "
			>
				<span className="flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-wider">
					{isStreaming ? (
						prefersReducedMotion ? (
							<span
								className="relative inline-flex h-3.5 w-3.5 items-center justify-center"
								aria-hidden="true"
							>
								<span className="absolute inline-flex h-full w-full rounded-full bg-accent/40 animate-ping" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
							</span>
						) : (
							<ThinkingOrb
								state="solving"
								size={20}
								theme="auto"
								aria-hidden="true"
							/>
						)
					) : (
						<Brain className="w-3.5 h-3.5 text-accent/80" />
					)}
					<span
						className={
							isStreaming
								? "text-accent"
								: "text-text-secondary group-hover/reason:text-text-bright"
						}
					>
						{isStreaming ? "Thinking" : "Reasoning"}
					</span>
					{isStreaming && (
						<span
							className="hidden sm:inline-flex items-center gap-1 text-text-muted/80 normal-case tracking-normal"
							aria-hidden="true"
						>
							<span className="w-1 h-1 rounded-full bg-text-muted/60 animate-pulse" />
							<span
								className="w-1 h-1 rounded-full bg-text-muted/60 animate-pulse"
								style={{ animationDelay: "150ms" }}
							/>
							<span
								className="w-1 h-1 rounded-full bg-text-muted/60 animate-pulse"
								style={{ animationDelay: "300ms" }}
							/>
						</span>
					)}
				</span>
				{expanded ? (
					<ChevronUp className="w-3.5 h-3.5 text-text-muted" />
				) : (
					<ChevronDown className="w-3.5 h-3.5 text-text-muted" />
				)}
			</button>
			<AnimatePresence>
				{expanded && (
					<m.div
						id="reasoning-content"
						initial={prefersReducedMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={prefersReducedMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
						transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
						className="overflow-hidden"
					>
						<div className="px-4 py-3 text-xs font-mono text-text-muted italic leading-relaxed whitespace-pre-wrap break-words border-t border-border/30">
							{reasoning}
						</div>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// CODE BLOCK — Enhanced with line numbers and glow on hover
// ═══════════════════════════════════════════════════════════════════

function CodeBlock({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	const code = String(children).replace(/\n$/, "");
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	const handleCopy = useCallback(() => {
		void copyToClipboard(code).then((ok) => {
			if (!ok) return;
			setCopied(true);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setCopied(false), 2000);
		});
	}, [code]);

	return (
		<div className="relative group my-4 w-full min-w-0 max-w-full">
			{/* Language badge */}
			{className?.includes("language-") && (
				<div className="absolute top-0 left-0 z-10 px-2 py-1 bg-surface-elevated border-b border-r border-border text-[9px] font-mono text-text-muted uppercase tracking-wider">
					{className.replace("language-", "")}
				</div>
			)}
			<div className="chat-scrollbar max-w-full overflow-x-auto">
				<pre
					className="
            block w-max max-w-full min-w-full bg-void text-text p-4 pt-8 text-[13px] leading-relaxed
            border border-border font-mono
            group-hover:border-accent/20 transition-colors duration-300
            chat-scrollbar
          "
				>
					<code className={className}>{code}</code>
				</pre>
			</div>
			<button
				type="button"
				onClick={handleCopy}
				aria-label={copied ? "Copied" : "Copy code"}
				className="
          absolute top-2 right-2 p-2 min-h-[44px] min-w-[44px]
          flex items-center justify-center
          bg-surface-elevated text-text-muted hover:text-text
          opacity-0 group-hover:opacity-100 transition-all duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        "
			>
				{copied ? (
					<Check className="w-3.5 h-3.5 text-success" />
				) : (
					<Copy className="w-3.5 h-3.5" />
				)}
			</button>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH SOURCES — Expandable web results
// ═══════════════════════════════════════════════════════════════════

function getHostname(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

const SearchSources = memo(function SearchSources({
	results,
	expanded,
	onToggle,
	prefersReducedMotion,
}: {
	results: SearchResult[];
	expanded: boolean;
	onToggle: () => void;
	prefersReducedMotion?: boolean | null;
}) {
	if (results.length === 0) return null;

	return (
		<div className="my-4 border border-border/50 overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				className="
          w-full flex items-center justify-between px-4 py-3
          bg-surface/50 hover:bg-surface-elevated/50 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        "
			>
				<span className="flex items-center gap-2 text-xs font-mono text-text-muted uppercase tracking-wider">
					<Search className="w-3.5 h-3.5" />
					{results.length} SOURCE{results.length !== 1 ? "S" : ""}
				</span>
				{expanded ? (
					<ChevronUp className="w-4 h-4 text-text-muted" />
				) : (
					<ChevronDown className="w-4 h-4 text-text-muted" />
				)}
			</button>
			<AnimatePresence>
				{expanded && (
					<m.div
						initial={prefersReducedMotion ? { height: "auto" } : { height: 0 }}
						animate={{ height: "auto" }}
						exit={prefersReducedMotion ? { height: "auto" } : { height: 0 }}
						transition={prefersReducedMotion ? { duration: 0 } : undefined}
						className="overflow-hidden"
					>
						<div className="p-3 space-y-2 bg-void">
							{results.map((result, i) => (
								<m.a
									key={i}
									href={result.url}
									target="_blank"
									rel="noopener noreferrer"
									initial={{ opacity: 0, x: -8 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: i * 0.05 }}
									className="
                    flex items-start gap-3 p-3 bg-surface/50 border border-border/50
                    hover:border-success/30 hover:bg-surface transition-all duration-200 group
                  "
								>
									<div className="flex-1 min-w-0">
										<div className="text-xs font-mono text-success group-hover:underline truncate">
											{result.title}
										</div>
										<div className="text-[10px] text-text-muted font-mono truncate">
											{getHostname(result.url)}
										</div>
									</div>
								</m.a>
							))}
						</div>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
});

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatTime(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORT TYPES (kept identical for drop-in replacement)
// ═══════════════════════════════════════════════════════════════════

export type { Message, ModelOption, SearchResult, TierFilter };
export { FALLBACK_MODELS, useLiveModels };
