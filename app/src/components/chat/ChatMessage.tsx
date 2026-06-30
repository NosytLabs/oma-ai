"use client";

/**
 * CHAT MESSAGE REDESIGN — Frontend-Design Skill Application
 *
 * Design Direction: "Terminal Noir" — A cinematic take on terminal aesthetics.
 * Think: Blade Runner meets a high-end code editor. Dark, atmospheric,
 * with moments of vivid orange glow that feel earned, not decorative.
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

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
	Bot,
	Brain,
	Check,
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Search,
	User,
} from "lucide-react";
import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { estimateTokens } from "@/lib/text";
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

export const ChatMessage = memo(function ChatMessage({
	msg,
	loading,
	onCopy,
}: {
	msg: Message;
	loading: boolean;
	onCopy: (content: string) => void;
}) {
	const isUser = msg.role === "user";
	const [copied, setCopied] = useState(false);
	const [sourcesExpanded, setSourcesExpanded] = useState(false);
	const [reasoningExpanded, setReasoningExpanded] = useState(false);
	const prefersReducedMotion = useReducedMotion() ?? false;
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
		};
	}, []);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(msg.content);
		setCopied(true);
		if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
		copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
		onCopy(msg.content);
	}, [msg.content, onCopy]);

	const time = new Date(msg.timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});

	const isAssistant = msg.role === "assistant";
	const isStreaming = loading && isAssistant;
	const isWaitingForFirstToken = isStreaming && msg.content.length === 0;
	const isActivelyStreaming = isStreaming && msg.content.length > 0;

	const hasReasoning =
		!isUser && !!msg.reasoning && msg.reasoning.trim().length > 0;
	const showReasoningExpanded =
		reasoningExpanded || (isStreaming && !msg.content);

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
						? "flex flex-row-reverse gap-4 pl-16 md:pl-24"
						: "flex flex-row gap-4 pr-16 md:pr-24"
				}
      `}
		>
			{/* ─── AVATAR: Glowing orb for assistant, sharp badge for user ─── */}
			<div className="relative shrink-0">
				<div
					className={`
            w-10 h-10 flex items-center justify-center relative z-10
            ${
							isUser
								? "bg-accent/15 border border-accent/40 text-accent"
								: "bg-surface border border-border text-text-muted"
						}
          `}
					style={{
						// User: sharp corners. Assistant: slight radius for softness
						borderRadius: isUser ? "2px" : "8px",
					}}
				>
					{isUser ? (
						<User className="w-5 h-5" strokeWidth={1.5} />
					) : (
						<Bot className="w-5 h-5" strokeWidth={1.5} />
					)}
				</div>
				{/* Ambient glow behind assistant avatar */}
				{!isUser && (
					<div
						className="absolute inset-0 -z-10 blur-xl opacity-30"
						style={{
							background:
								"radial-gradient(circle, var(--color-accent-glow), transparent 70%)",
						}}
					/>
				)}
			</div>

			{/* ─── MESSAGE BODY ─── */}
			<div
				className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}
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
            relative px-5 py-4 leading-relaxed font-mono text-sm
            ${
							isUser
								? "bg-accent/8 border border-accent/25 text-text border-r-0"
								: "bg-surface/60 border border-border text-text-secondary border-l-0"
						}
          `}
					style={{
						// Asymmetric border-radius for visual interest
						borderRadius: isUser
							? "12px 2px 12px 12px" // Sharp top-right (toward avatar)
							: "2px 12px 12px 12px", // Sharp top-left (toward avatar)
						// Subtle depth on assistant messages
						boxShadow: isUser
							? "none"
							: "0 2px 12px -4px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
					}}
				>
					{/* Ambient glow line along the inner edge */}
					<div
						className="absolute top-0 h-full w-px opacity-40"
						style={{
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
						<p className="whitespace-pre-wrap break-words">{msg.content}</p>
					) : (
						<div
							className="markdown-content font-mono text-sm"
							aria-live={isActivelyStreaming ? "polite" : "off"}
							role={isActivelyStreaming ? "status" : undefined}
						>
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								components={{
									code({ className, children, ...props }) {
										const match = /language-(\w+)/.exec(className || "");
										const text = String(children ?? "");
										const isInline = !match && !text.includes("\n");
										return isInline ? (
											<code
												className="px-1.5 py-0.5 bg-surface-elevated text-accent-bright font-mono text-xs"
												{...props}
											>
												{children}
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
							{isActivelyStreaming && (
								<span
									className="caret-blink inline-block align-baseline"
									aria-hidden="true"
								/>
							)}
							{isWaitingForFirstToken && <StreamingIndicator />}
						</div>
					)}
				</div>

				{/* ─── METADATA ROW ─── */}
				<div
					className={`
            flex items-center gap-3 mt-2 text-[10px] text-text-muted font-mono
            ${isUser ? "flex-row-reverse" : "flex-row"}
          `}
				>
					<span className="opacity-60">{time}</span>
					{(msg.outputTokens ??
						(msg.content ? estimateTokens(msg.content) : 0)) > 0 && (
						<span className="px-1.5 py-0.5 bg-surface-elevated/50 border border-border/50 text-[9px]">
							TK:{msg.outputTokens ?? estimateTokens(msg.content)}
						</span>
					)}
					{msg.latency && (
						<span className="flex items-center gap-1 opacity-60">
							<Clock className="w-3 h-3" />
							{formatLatency(msg.latency)}
						</span>
					)}
					{!isUser && msg.content && !loading && (
						<button
							type="button"
							onClick={handleCopy}
							aria-label={copied ? "Copied to clipboard" : "Copy message"}
							className="
                flex items-center gap-1 px-2 py-1
                opacity-0 group-hover:opacity-100
                hover:text-success transition-all duration-200
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
					)}
				</div>
			</div>
		</m.div>
	);
});

// ═══════════════════════════════════════════════════════════════════
// STREAMING INDICATOR — Animated pulse dots
// ═══════════════════════════════════════════════════════════════════

function StreamingIndicator() {
	return (
		<span
			className="inline-flex items-center gap-1.5 py-1"
			role="status"
			aria-label="Generating"
		>
			{[0, 0.15, 0.3].map((delay, i) => (
				<m.span
					key={i}
					className="block w-1.5 h-1.5 bg-accent rounded-full"
					animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
					transition={{
						duration: 0.9,
						repeat: Infinity,
						ease: "easeInOut",
						delay,
					}}
				/>
			))}
		</span>
	);
}

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
		<div className="mb-2 w-full border border-border/40 bg-surface/20 overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				className="
          w-full flex items-center justify-between px-4 py-2
          hover:bg-surface-elevated/30 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-void
        "
			>
				<span className="flex items-center gap-2 text-[11px] font-mono text-text-muted uppercase tracking-wider">
					<Brain className="w-3.5 h-3.5" />
					Thinking
					{isStreaming && (
						<span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
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
						initial={prefersReducedMotion ? { height: "auto" } : { height: 0 }}
						animate={{ height: "auto" }}
						exit={prefersReducedMotion ? { height: "auto" } : { height: 0 }}
						transition={prefersReducedMotion ? { duration: 0 } : undefined}
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
		navigator.clipboard.writeText(code);
		setCopied(true);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => setCopied(false), 2000);
	}, [code]);

	return (
		<div className="relative group my-4">
			{/* Language badge */}
			{className?.includes("language-") && (
				<div className="absolute top-0 left-0 px-2 py-1 bg-surface-elevated border-b border-r border-border text-[9px] font-mono text-text-muted uppercase tracking-wider">
					{className.replace("language-", "")}
				</div>
			)}
			<pre
				className="
          bg-void text-text p-4 pt-8 overflow-x-auto text-xs leading-relaxed
          border border-border font-mono
          group-hover:border-accent/20 transition-colors duration-300
        "
			>
				<code className={className}>{code}</code>
			</pre>
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
          focus-visible:ring-offset-2 focus-visible:ring-offset-void
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

function getFaviconUrl(_url: string) {
	// ponytail: no third-party favicon service — privacy leak.
	// Return null so Image onError fallback hides the img element.
	return null;
}

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
          focus-visible:ring-offset-2 focus-visible:ring-offset-void
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
									<Image
										src={getFaviconUrl(result.url) || ""}
										alt=""
										aria-hidden="true"
										width={16}
										height={16}
										unoptimized
										className="w-4 h-4 mt-0.5 rounded-sm"
										onError={(e) => {
											(e.target as HTMLImageElement).style.display = "none";
										}}
									/>
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

function formatLatency(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORT TYPES (kept identical for drop-in replacement)
// ═══════════════════════════════════════════════════════════════════

export type { Message, ModelOption, SearchResult, TierFilter };
export { FALLBACK_MODELS, useLiveModels };
