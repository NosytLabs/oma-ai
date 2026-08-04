"use client";

/**
 * MESSAGE INPUT REDESIGN — "Terminal Noir" Aesthetic
 *
 * Key features:
 * - Glass morphism with animated focus border
 * - Send button glow pulse when input is active
 * - Stop button with rotating ring animation
 * - Mobile-first: proper touch targets, keyboard handling
 * - Auto-resize textarea with smooth transitions
 * - Feature hints below input (first visit)
 *
 * Mobile improvements:
 * - 44px minimum touch targets (iOS/Android guidelines)
 * - Auto-scroll to keep input visible when keyboard opens
 * - Proper `inputMode` for mobile keyboards
 * - Reduced padding on small screens
 */

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { BorderBeam } from "border-beam";
import { Loader2, Search, Send, Sparkles } from "lucide-react";
import type { Ref } from "react";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { Magnetic, EASE_SPRING } from "@/lib/animation";

interface MessageInputProps {
	input: string;
	setInput: (v: string) => void;
	onSubmit: () => void;
	onStop: () => void;
	loading: boolean;
	textareaRef?: Ref<HTMLTextAreaElement>;
	/**
	 * When true, the send button is disabled and a hint is shown next to the
	 * input. Set when the user's balance is $0 (or below the cost of any
	 * available model) so we don't burn a failed round-trip on every keystroke.
	 * Defaults to false — leave unset for playground/demo modes that don't
	 * charge per request.
	 */
	disabled?: boolean;
	/** Optional reason surfaced to the user when `disabled` is true. */
	disabledReason?: string;
	/** Web-search toggle rendered inside the composer (primary location). */
	webSearchEnabled?: boolean;
	setWebSearchEnabled?: (v: boolean) => void;
}

const INPUT_HINTS = [
	{ key: "Enter", action: "Send" },
	{ key: "Shift+Enter", action: "New line" },
	{ key: "?", action: "Shortcuts" },
];

const HINTS_KEY = "oma-chat-input-hints-seen";

export const MessageInputRedesigned = forwardRef<
	HTMLTextAreaElement,
	MessageInputProps
>(function MessageInputRedesigned(
	{
		input,
		setInput,
		onSubmit,
		onStop,
		loading,
		textareaRef: externalTextareaRef,
		disabled = false,
		disabledReason,
		webSearchEnabled = false,
		setWebSearchEnabled,
	},
	forwardedRef,
) {
	const [showHints, setShowHints] = useState(() => {
		try {
			return localStorage.getItem(HINTS_KEY) !== "1";
		} catch {
			return false;
		}
	});
	const [focused, setFocused] = useState(false);
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setReduceMotion(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	// Auto-dismiss hints after first interaction
	useEffect(() => {
		if (input.length > 0 && showHints) {
			try {
				localStorage.setItem(HINTS_KEY, "1");
			} catch {}
			setShowHints(false);
		}
	}, [input, showHints]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (disabled) return;
				onSubmit();
			}
		},
		[onSubmit, disabled],
	);

	const setTextareaRef = useCallback(
		(node: HTMLTextAreaElement | null) => {
			if (typeof forwardedRef === "function") forwardedRef(node);
			else if (forwardedRef) forwardedRef.current = node;
			if (typeof externalTextareaRef === "function") externalTextareaRef(node);
			else if (externalTextareaRef) externalTextareaRef.current = node;
		},
		[forwardedRef, externalTextareaRef],
	);

	const hasInput = input.trim().length > 0;

	// Auto-resize with smooth height transition
	const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = "auto";
		target.style.height = `${Math.min(target.scrollHeight, 200)}px`;

		// Scroll input into view on mobile when keyboard opens
		if (window.innerWidth < 768) {
			setTimeout(() => {
				target.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}, 100);
		}
	}, []);

	const beamActive =
		!reduceMotion && (loading || (focused && hasInput));

	return (
		<div className="relative z-10 bg-void">
			<BorderBeam
				size={loading ? "pulse-inner" : "line"}
				colorVariant={loading ? "ocean" : "mono"}
				theme="auto"
				strength={loading ? 0.55 : 0.4}
				duration={loading ? 2.6 : 3.2}
				active={beamActive}
				borderRadius={12}
				className="w-full"
			>
			<div
				className="glass relative flex items-end gap-0.5 rounded-xl px-2 py-2 transition-[border-color,box-shadow,background-color] duration-200 ease-out focus-within:border-accent/50 focus-within:shadow-[0_0_24px_-8px_var(--color-accent-glow)] chat-scrollbar"
				role="group"
				aria-label="New message"
				aria-busy={loading}
				data-state={loading ? "loading" : focused ? "focus" : "idle"}
			>
				<textarea
					ref={setTextareaRef}
					id="chat-message-input"
					name="chat-message"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					placeholder="Message OMA…"
					aria-label="Enter your message"
					aria-describedby="message-hint"
					rows={1}
					maxLength={100 * 1024}
					inputMode="text"
					enterKeyHint="send"
					className="min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3 font-sans text-[15px] leading-relaxed text-text-bright placeholder-text-muted outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void md:px-4"
					disabled={loading}
					style={{ minHeight: "52px", maxHeight: "200px" }}
					onInput={handleInput}
				/>

				{setWebSearchEnabled && (
					<div className="flex items-center self-end p-1">
						<button
							type="button"
							onClick={() => setWebSearchEnabled(!webSearchEnabled)}
							aria-pressed={webSearchEnabled}
							aria-label="Toggle web search — ground responses in live internet data"
							title={
								webSearchEnabled
									? "Web search on — responses use live sources when available"
									: "Web search off — turn on to ground answers in the internet"
							}
							className={`flex h-12 min-h-[44px] items-center justify-center gap-1.5 rounded-full px-3 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:translate-y-[1px] md:h-11 ${
								webSearchEnabled
									? "border border-success/30 bg-surface text-success shadow-[0_0_16px_-6px_var(--color-success-glow)]"
									: "border border-border bg-void text-text-muted hover:border-accent/40 hover:bg-surface hover:text-text"
							}`}
						>
							<Search
								className={`h-3.5 w-3.5 ${webSearchEnabled ? "text-success" : ""}`}
								aria-hidden="true"
							/>
							<span>WEB</span>
						</button>
					</div>
				)}

				<div className="p-1">
					{loading ? (
						<Magnetic strength={4}>
							<button
								type="button"
								onClick={onStop}
								aria-label="Stop generation"
								className="
                    flex h-12 w-12 md:h-11 md:w-11 items-center justify-center
                    bg-danger/15 text-danger hover:bg-danger/25 border border-danger/40
                    btn-destructive
                    relative min-h-[44px] min-w-[44px]
                  "
							>
								{/* Rotating ring */}
								{!reduceMotion && (
									<m.span
										className="absolute inset-0 border-4 border-danger/60 animate-pulse rounded-full drop-shadow-[0_2px_4px_var(--color-error-glow)] bg-danger/10"
										animate={{ rotate: 360 }}
										transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
									/>
								)}
								<Loader2 className="w-4 h-4 relative z-10" />
							</button>
						</Magnetic>
					) : (
						<Magnetic strength={6}>
							<m.button
								type="button"
								onClick={() => onSubmit()}
								disabled={!hasInput || disabled}
								title={disabled ? disabledReason ?? "Send disabled" : undefined}
								aria-label="Send message"
								aria-describedby="message-hint"
								whileTap={reduceMotion ? undefined : { scale: 0.9 }}
								whileHover={
									hasInput && !reduceMotion ? { scale: 1.04 } : undefined
								}
								transition={EASE_SPRING}
								className={`
                     group/send relative flex h-12 w-12 md:h-11 md:w-11 items-center justify-center
                     rounded-xl font-semibold transition-all duration-200 min-h-[44px] min-w-[44px]
                     ${
											hasInput && !disabled
												? "bg-gradient-to-br from-accent to-accent-hover text-accent-fg shadow-[0_0_24px_-4px_var(--color-accent-glow),0_8px_24px_-12px_var(--color-accent-glow)] hover:shadow-[0_0_32px_-2px_var(--color-accent-glow),0_10px_28px_-10px_var(--color-accent-glow)]"
												: "bg-surface-elevated/80 text-text-tertiary border border-border cursor-not-allowed"
										}
                   `}
							>
								<Send
									className={`w-5 h-5 transition-transform duration-200 ${
										hasInput && !disabled
											? "drop-shadow-[0_2px_4px_var(--color-accent-glow)] group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5"
											: ""
									}`}
									strokeWidth={hasInput && !disabled ? 2.4 : 1.8}
								/>
								{hasInput && !disabled && !reduceMotion && (
									<span
										aria-hidden="true"
										className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-accent/30"
									/>
								)}
							</m.button>
						</Magnetic>
					)}
				</div>
			</div>
			</BorderBeam>

			{/* ─── Input hints (first visit) ─── */}
			<AnimatePresence>
				{showHints && !loading && (
					<m.div
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						className="absolute bottom-full left-0 right-0 mb-2 px-2 hidden md:flex"
					>
						<div className="flex items-center gap-3 mx-auto px-3 py-1.5 bg-surface/80 border border-border/40 backdrop-blur-sm">
							<Sparkles className="w-3 h-3 text-accent/60" />
							{INPUT_HINTS.map((hint, i) => (
								<span
									key={i}
									className="flex items-center gap-1 text-[9px] font-mono text-text-muted"
								>
									<kbd className="px-1.5 py-0.5 bg-void border border-border text-text-secondary text-[9px]">
										{hint.key}
									</kbd>
									{hint.action}
								</span>
							))}
						</div>
					</m.div>
				)}
			</AnimatePresence>

			<span id="message-hint" className="sr-only">
				Shift+Enter for new line, Enter to send
			</span>
		</div>
	);
});

MessageInputRedesigned.displayName = "MessageInputRedesigned";
