"use client";

import { AnimatePresence, m } from "framer-motion";
import { Columns2, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Message } from "./chat-message-shared";
import { useLiveModels } from "./chat-message-shared";
import { ModelSelector } from "./ModelSelectorRedesign";

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
}: ModelComparePanelProps) {
	const models = useLiveModels();
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
					transition={{ type: "spring", damping: 30, stiffness: 280 }}
					className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-void border-l border-border z-50 flex flex-col shadow-2xl"
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
							aria-label="Close comparison panel"
							className="text-text-muted hover:text-text-secondary focus-ring"
						>
							<X className="w-4 h-4" />
						</button>
					</header>

					<div className="flex-none p-3 border-b border-border bg-surface/30">
						<label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">
							COMPARE MODEL
						</label>
						<ModelSelector
							model={compareModel}
							setModel={setCompareModel}
							compact
						/>
					</div>

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
								{compareMessages.map((msg) => (
									<div
										key={msg.id || `${msg.role}-${msg.timestamp}`}
										className={`p-2 border ${
											msg.role === "user"
												? "border-success/30 bg-success/5"
												: "border-border bg-surface"
										}`}
									>
										<div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">
											{msg.role === "user"
												? `YOU · ${compareName}`
												: compareName}
										</div>
										<p className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-words">
											{msg.content || (loading ? "..." : "")}
											{loading &&
												msg.role === "assistant" &&
												msg.content === "" && (
													<Loader2 className="w-3 h-3 inline ml-1 animate-spin text-success" />
												)}
										</p>
										{msg.tokens !== undefined && msg.tokens > 0 && (
											<div className="text-[10px] font-mono text-text-muted mt-1">
												TK:{msg.tokens}{" "}
												{msg.latency ? `· ${msg.latency}ms` : ""}
											</div>
										)}
									</div>
								))}
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
							className="w-full resize-none bg-void border border-border px-2 py-1.5 text-xs font-mono text-text-secondary placeholder-text-muted focus:border-accent/50 focus:outline-none disabled:opacity-50"
						/>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={(!localPrompt.trim() && !prompt.trim()) || loading}
							className="w-full mt-2 px-3 py-2 bg-accent text-text-inverse text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
