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
import type { A2UIActionEvent } from "@/components/chat/A2UIRenderer";
import type { OpenUIActionHandler } from "@/lib/openui-actions";
import { ChatEmptyState, type EmptyStateProps } from "@/components/chat/ChatEmptyState";
import { ChatMessage } from "@/components/chat/ChatMessage";

interface MessagesListProps {
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	messagesEndRef: RefObject<HTMLDivElement | null>;
	isScrolledAway: boolean;
	loading: boolean;
	jumpToBottom: () => void;
	handleScroll: () => void;
	deferredMessages: Message[];
	/** Regenerate the last assistant turn (ChatGPT-style Retry). */
	onRegenerate?: () => void;
	/** Fired when the user clicks an A2UI action button (server action event). */
	onA2UIAction?: (event: A2UIActionEvent) => void;
	/** Fired for the small, validated OpenUI action allowlist. */
	onOpenUIAction?: OpenUIActionHandler;
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
	onRegenerate,
	onA2UIAction,
	onOpenUIAction,
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
						{/* Starter prompts fill the empty chat without reserving viewport height. */}
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
								const isLastAssistant =
									msg.role === "assistant" && isLast;
								const isStreaming = loading && isLastAssistant;
								return (
									<ChatMessage
										key={msg.id ?? `${msg.role}-${msg.timestamp}`}
										msg={msg}
										loading={isStreaming}
										onRegenerate={
											isLastAssistant && !loading
												? onRegenerate
												: undefined
										}
										isLastAssistant={isLastAssistant}
										onA2UIAction={onA2UIAction}
										onOpenUIAction={onOpenUIAction}
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
