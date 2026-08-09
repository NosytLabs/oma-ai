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

import { m } from "@/lib/framer-motion-client";
import { BorderBeam } from "border-beam";
import { Loader2, Search, Send, Wand2 } from "lucide-react";
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
	/** UI-mode toggle (A2UI) rendered inside the composer next to WEB. */
	uiMode?: boolean;
	setUiMode?: (v: boolean) => void;
}

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
		uiMode = false,
		setUiMode,
	},
	forwardedRef,
) {
	const [focused, setFocused] = useState(false);
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setReduceMotion(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

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
		<div className="relative z-10 bg-transparent">
			<BorderBeam
				size={loading ? "pulse-inner" : "line"}
				colorVariant={loading ? "ocean" : "mono"}
				theme="auto"
				strength={loading ? 0.75 : 0.6}
				duration={loading ? 2.0 : 2.8}
				active={beamActive || focused}
				borderRadius={14}
				className="w-full"
			>
			<div
				className={`bg-surface relative flex items-end gap-0.5 rounded-[var(--radius-lg)] px-2 py-1.5 transition-[border-color,box-shadow,background-color] duration-200 ease-out chat-scrollbar border shadow-sm ${
					focused
						? "border-accent/60 shadow-[0_0_32px_-4px_var(--color-accent-glow)] bg-[color-mix(in_srgb,var(--color-surface)_90%,white_10%)]"
						: "border-border shadow-sm hover:border-border-hi"
				}`}
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
					className="min-h-[44px] flex-1 resize-none bg-transparent px-4 py-3 font-sans text-[15px] leading-relaxed text-text-bright placeholder-text-muted outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:px-5"
					disabled={loading}
					style={{ minHeight: "44px", maxHeight: "200px" }}
					onInput={handleInput}
				/>

				{setUiMode && (
					<div className="flex items-center self-end p-2 shrink-0">
						<button
							type="button"
							onClick={() => setUiMode(!uiMode)}
							aria-pressed={uiMode}
							aria-label="Toggle UI mode — model can render interactive interfaces"
							title={
								uiMode
									? "UI mode on — model can render interactive interfaces"
									: "UI mode off — turn on to let the model build interactive UIs"
							}
							className={`flex h-[42px] min-h-[42px] items-center justify-center gap-2 rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-wider transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.97] ${
								uiMode
									? "border border-[var(--color-accent)]/40 bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] shadow-[0_0_16px_-6px_var(--color-accent-glow)]"
									: "border border-[var(--color-border)] bg-[var(--color-void)] text-text-muted hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
							}`}
						>
							<Wand2
								className={`h-4 w-4 ${uiMode ? "text-[var(--color-accent)]" : ""}`}
								aria-hidden="true"
							/>
							<span>UI</span>
						</button>
					</div>
				)}

				{setWebSearchEnabled && (
					<div className="flex items-center self-end p-2 shrink-0">
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
								className={`flex h-[42px] min-h-[42px] items-center justify-center gap-2 rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-wider transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.97] ${
									webSearchEnabled
										? "border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)] shadow-[0_0_16px_-6px_var(--color-success-glow)]"
										: "border border-[var(--color-border)] bg-[var(--color-void)] text-text-muted hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
								}`}
							>
							<Search
								className={`h-4 w-4 ${webSearchEnabled ? "text-[var(--color-success)]" : ""}`}
								aria-hidden="true"
							/>
							<span>WEB</span>
						</button>
					</div>
				)}

				<div className="p-2">
					{loading ? (
						<Magnetic strength={4}>
							<button
								type="button"
								onClick={onStop}
								aria-label="Stop generation"
								className="
 flex h-[42px] w-[42px] items-center justify-center
 bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] border border-[var(--color-danger)]/40
 rounded-[var(--radius-lg)] relative min-h-[42px] min-w-[42px]
 transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out active:scale-[0.97] focus-ring 
 "
							>
								{/* Rotating ring */}
								{!reduceMotion && (
									<m.span
										className="absolute inset-0 border-[3px] border-[var(--color-danger)]/60 animate-pulse rounded-[var(--radius-lg)] drop-shadow-[0_2px_4px_var(--color-error-glow)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
										animate={{ rotate: 360 }}
										transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
									/>
								)}
								<Loader2 className="w-5 h-5 relative z-10" />
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
								whileTap={reduceMotion ? undefined : { scale: 0.95 }}
								whileHover={
									hasInput && !reduceMotion ? { scale: 1.02 } : undefined
								}
								transition={EASE_SPRING}
								className={`
 group/send relative flex h-[42px] w-[42px] items-center justify-center
 rounded-[var(--radius-lg)] font-semibold transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out min-h-[42px] min-w-[42px] active:scale-[0.97] focus-ring 
 ${
											hasInput && !disabled
												? "bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] text-[var(--color-accent-fg)] shadow-[0_0_24px_-4px_var(--color-accent-glow),0_8px_24px_-12px_var(--color-accent-glow)] hover:shadow-[0_0_32px_-2px_var(--color-accent-glow),0_10px_28px_-10px_var(--color-accent-glow)]"
												: "bg-[var(--color-surface-elevated)]/80 text-[var(--color-text-tertiary)] border border-[var(--color-border)] cursor-not-allowed"
										}
 `}
							>
								<Send
									className={`w-[18px] h-[18px] transition-transform duration-200 ${
										hasInput && !disabled
											? "drop-shadow-[0_2px_4px_var(--color-accent-glow)] group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5"
											: ""
									}`}
									strokeWidth={hasInput && !disabled ? 2.4 : 1.8}
								/>
								{hasInput && !disabled && !reduceMotion && (
									<span
										aria-hidden="true"
										className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)] ring-1 ring-[var(--color-accent)]/30"
									/>
								)}
							</m.button>
						</Magnetic>
					)}
				</div>
			</div>
			</BorderBeam>
		</div>
	);
});

MessageInputRedesigned.displayName = "MessageInputRedesigned";
