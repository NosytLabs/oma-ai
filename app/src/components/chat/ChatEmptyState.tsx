"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { Coins } from "lucide-react";

interface EmptyStateProps {
	/** Hide guest-quota marketing when the user is signed in. */
	signedIn?: boolean;
}

export function ChatEmptyState({ signedIn = false }: EmptyStateProps) {

	return (
		<div className="flex flex-col items-center justify-start text-center px-4 py-4 md:py-6">
			<m.div
				initial={{ scale: 0.95, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={springs.soft}
				className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] shadow-[0_0_24px_-6px_var(--color-accent-glow)]"
			>
				<span className="text-[18px] font-mono font-bold text-[var(--color-accent)]" aria-hidden="true">
					{">"}
				</span>
			</m.div>

			<m.h2
				initial={{ y: 12, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.08, ...springs.soft }}
				className="mb-1.5 text-xl font-mono tracking-tight text-text-bright sm:text-2xl"
			>
				Chat with any model
			</m.h2>
			<m.p
				initial={{ y: 12, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.12, ...springs.soft }}
				className="mb-5 max-w-md text-sm leading-relaxed text-text-secondary"
			>
				{signedIn
					? "Start with a question below."
					: "Start with a question below. Guest chats are free on OMA-AI models."}
			</m.p>

			{!signedIn && (
			<m.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5, ...springs.soft }}
				className="mt-4 flex items-center gap-2 text-[11px] font-mono text-text-muted uppercase tracking-wider"
			>
				<Coins className="h-3.5 w-3.5 text-[var(--color-accent)] opacity-80" aria-hidden="true" />
				Free tier: 20 requests/day · no card needed
			</m.div>
			)}
		</div>
	);
}
