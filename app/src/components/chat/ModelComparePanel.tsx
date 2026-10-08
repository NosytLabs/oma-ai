"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { Columns2, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Message } from "./chat-message-shared";
import { useSharedLiveModels } from "./chat-message-shared";
import { ChatMessageed } from "./ChatMessage";
import { A2UIRenderer, type A2UIActionEvent } from "./A2UIRenderer";
import { OpenUIRenderer } from "./OpenUIRenderer";
import { ModelSelector } from "./ModelSelector";
import { classifyMessage } from "@/lib/openui-message-format";
import { isValidOpenUIResponse } from "@/lib/openui";
import type { OpenUIActionHandler } from "@/lib/openui-actions";

interface ModelComparePanelProps {
	open: boolean;
	onClose: () => void;
	primaryModel: string;
	compareModel: string;
	setCompareModel: (m: string) => void;
	/** Prompt shared with both panels. Trigger fires on submit. */
	prompt: string;
	onSubmit: (prompt: string) => void;
	loading: boolean;
	compareMessages: Message[];
	/**
	 * Compare-stream failure. Rendered HERE rather than in the primary
	 * ChatErrorBanner: a side stream dying must not take over the main
	 * conversation's error slot above the composer (BUG-H).
	 */
	error?: string | null;
	onDismissError?: () => void;
	onRegenerate?: () => void;
	onA2UIAction?: (event: A2UIActionEvent) => void;
	onOpenUIAction?: OpenUIActionHandler;
}

/**
	* Right-hand comparison panel. Independent chat history against a
	* second model. Shares the same prompt input on submit (caller wires
	* `prompt` + `onSubmit` to fire both sendMessage paths).
	*/
export function ModelComparePanel({
	open,
	onClose,
	primaryModel,
	compareModel,
	setCompareModel,
	prompt,
	onSubmit,
	loading,
	compareMessages,
	error = null,
	onDismissError,
	onRegenerate,
	onA2UIAction,
	onOpenUIAction,
}: ModelComparePanelProps) {
	const models = useSharedLiveModels();
	const [localPrompt, setLocalPrompt] = useState(prompt);

	useEffect(() => {
		setLocalPrompt(prompt);
	}, [prompt]);

	const primaryName =
		models.find((m) => m.id === primaryModel)?.name || primaryModel;
	const compareName =
		models.find((m) => m.id === compareModel)?.name || compareModel;

	const handleSubmit = () => {
		const p = localPrompt.trim();
		if (!p) return;
		onSubmit(p);
	};

	return (
		<AnimatePresence>
			{open && (
				<m.aside
					initial={{ x: "100%", opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					exit={{ x: "100%", opacity: 0 }}
					transition={springs.card}
					className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col border-l border-border bg-void shadow-2xl md:w-[480px]"
					role="complementary"
					aria-label="Model comparison panel"
				>
					<header className="flex-none h-12 border-b border-border flex items-center justify-between px-4 bg-void">
						<div className="flex items-center gap-2">
							<Columns2 className="w-4 h-4 text-success" />
							<h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
								COMPARE · {primaryName} vs {compareName}
							</h2>
						</div>
						<button
							type="button"
							onClick={onClose}
							disabled={loading}
							aria-label="Close comparison panel"
							className="text-text-muted hover:text-text-secondary focus-ring active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
						>
							<X className="w-4 h-4" />
						</button>
					</header>

					<div className="flex-none p-3 border-b border-border bg-surface/30">
						<label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">
							COMPARE MODEL
						</label>
						<fieldset disabled={loading} className="contents">
							<ModelSelector
								model={compareModel}
								setModel={setCompareModel}
								compact
							/>
						</fieldset>
					</div>

					{error && (
						<div
							role="alert"
							data-testid="compare-error"
							className="flex-none m-3 mb-0 flex items-start justify-between gap-3 border border-[var(--color-danger)]/40 bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-3 py-2 text-[11px] font-mono text-[var(--color-danger)]"
						>
							<span className="min-w-0 break-words">{error}</span>
							{onDismissError && (
								<button
									type="button"
									onClick={onDismissError}
									aria-label="Dismiss comparison error"
									className="shrink-0 underline underline-offset-2 hover:opacity-80"
								>
									DISMISS
								</button>
							)}
						</div>
					)}

					<div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
						{compareMessages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-center text-text-muted font-mono">
								<Columns2 className="w-8 h-8 mb-3 opacity-50" />
								<p className="text-xs">{"// COMPARE PANEL IDLE"}</p>
								<p className="text-[10px] mt-1">
									SEND A MESSAGE TO RUN BOTH MODELS
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{compareMessages.map((msg, index) => {
									const isLastAssistant =
										msg.role === "assistant" &&
										index === compareMessages.length - 1;
									const isStreaming = loading && isLastAssistant;
									const classification =
										msg.role === "assistant"
											? classifyMessage(msg.content, {
													format: msg.format,
													isStreaming,
													isValidOpenUI: isValidOpenUIResponse,
												})
											: ({ kind: "plain" } as const);
									return (
										<ChatMessageed
											key={msg.id || `${msg.role}-${msg.timestamp}`}
											msg={
												msg.role === "assistant" && !msg.model
													? { ...msg, model: compareModel }
													: msg
											}
											loading={isStreaming}
											onCopy={() => undefined}
											isLastAssistant={isLastAssistant}
											onRegenerate={
												isLastAssistant && !loading
													? onRegenerate
													: undefined
											}
											assistantContent={
												classification.kind === "a2ui" ? (
													<A2UIRenderer
														payload={classification.payload}
														onAction={onA2UIAction}
													/>
												) : classification.kind === "openui" ? (
													<OpenUIRenderer
														response={classification.response}
														isStreaming={isStreaming}
														onAction={onOpenUIAction}
													/>
												) : undefined
											}
										/>
									);
								})}
							</div>
						)}
					</div>

					<div className="flex-none p-3 border-t border-border bg-void">
						<p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
							{"// SHARED PROMPT · BOTH PANELS RECEIVE"}
						</p>
						<textarea
							value={localPrompt}
							onChange={(e) => setLocalPrompt(e.target.value)}
							placeholder="Type to compare..."
							rows={2}
							disabled={loading}
							className="w-full resize-none bg-[var(--color-void)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-xs font-mono text-text-secondary placeholder-text-muted focus:border-[var(--color-accent)]/50 focus:outline-none disabled:opacity-50"
						/>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={(!localPrompt.trim() && !prompt.trim()) || loading}
							className="w-full mt-2 px-3 py-2 bg-[var(--color-accent)] rounded-[var(--radius-md)] text-text-inverse text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--color-accent-hover)] hover:shadow-[0_0_15px_-5px_var(--color-accent-glow)] transition-[background-color,box-shadow,transform] duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] focus-ring"
						>
							{loading ? (
								<span className="inline-flex items-center gap-2">
									<Loader2 className="w-3 h-3 animate-spin" />
									RUNNING BOTH
								</span>
							) : (
								"SEND TO BOTH"
							)}
						</button>
					</div>
				</m.aside>
			)}
		</AnimatePresence>
	);
}
