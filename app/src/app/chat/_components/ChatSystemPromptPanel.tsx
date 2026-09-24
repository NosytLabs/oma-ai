"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

interface ChatSystemPromptPanelProps {
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
				className="gutter-page flex w-full items-center justify-between py-3 text-[11.5px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)] transition-colors duration-200 ease-out hover:bg-[var(--color-surface)]/30 hover:text-[var(--color-text-bright)] focus-ring"
			>
				<span className="flex items-center gap-2.5">
					<span
						className={`w-1.5 h-1.5 rounded-full ${systemPrompt.trim() ? "bg-[var(--color-success)]" : "bg-[var(--color-surface-elevated)]"}`}
					/>
					Instructions{" "}
					{systemPrompt.trim() ? "· Active" : "· Optional"}
				</span>
				{systemPromptOpen ? (
					<ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
				) : (
					<ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
				)}
			</button>
			{systemPromptOpen && (
				<div className="gutter-page pb-3">
					<textarea
						value={systemPrompt}
						onChange={(e) => setSystemPrompt(e.target.value)}
						placeholder="Set behavior, persona, or instructions for the model. Sent as the first message of every request."
						aria-label="System prompt"
						rows={3}
						className="w-full resize-y bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 rounded-[var(--radius-lg)] text-sm text-[var(--color-text-secondary)] font-sans leading-relaxed placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30"
						style={{ minHeight: "64px", maxHeight: "160px" }}
					/>
				</div>
			)}
		</div>
	);
}
