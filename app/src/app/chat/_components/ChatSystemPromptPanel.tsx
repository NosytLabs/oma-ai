"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

export interface ChatSystemPromptPanelProps {
	systemPrompt: string;
	setSystemPrompt: Dispatch<SetStateAction<string>>;
	systemPromptOpen: boolean;
	setSystemPromptOpen: Dispatch<SetStateAction<boolean>>;
}

export function ChatSystemPromptPanel({
	systemPrompt,
	setSystemPrompt,
	systemPromptOpen,
	setSystemPromptOpen,
}: ChatSystemPromptPanelProps) {
	return (
		<div className="flex-none border-b border-border bg-[color-mix(in_srgb,var(--color-surface)_40%,transparent)]">
			<button
				type="button"
				onClick={() => setSystemPromptOpen(!systemPromptOpen)}
				aria-expanded={systemPromptOpen}
				aria-label={`Toggle system prompt panel — Instructions ${systemPrompt.trim() ? "· Active" : "· Optional"}`}
				className="w-full flex items-center justify-between px-4 md:px-6 py-3 text-[11.5px] font-mono text-text-secondary uppercase tracking-wider hover:text-text-bright hover:bg-surface/30 transition-colors duration-200 ease-out focus-ring"
			>
				<span className="flex items-center gap-2.5">
					<span
						className={`w-1.5 h-1.5 rounded-full ${systemPrompt.trim() ? "bg-success" : "bg-surface-elevated"}`}
					/>
					Instructions{""}
					{systemPrompt.trim() ? "· Active" : "· Optional"}
				</span>
				{systemPromptOpen ? (
					<ChevronUp className="w-4 h-4 text-text-muted" />
				) : (
					<ChevronDown className="w-4 h-4 text-text-muted" />
				)}
			</button>
			{systemPromptOpen && (
				<div className="px-4 md:px-6 pb-3">
					<textarea
						value={systemPrompt}
						onChange={(e) => setSystemPrompt(e.target.value)}
						placeholder="Set behavior, persona, or instructions for the model. Sent as the first message of every request."
						aria-label="System prompt"
						rows={3}
						className="w-full resize-y bg-surface border border-border px-3 py-2 rounded-[var(--radius-lg)] text-sm text-text-secondary font-sans leading-relaxed placeholder-text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
						style={{ minHeight: "64px", maxHeight: "160px" }}
					/>
				</div>
			)}
		</div>
	);
}
