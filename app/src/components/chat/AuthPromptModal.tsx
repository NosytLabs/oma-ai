"use client";

/**
	* AuthPromptModal — lightweight signup prompt shown when a guest user
	* hits a gated action (paid model selection, free message limit).
	* Renders a focused modal with a clear CTA to /login.
	*/

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { Lock, X, Zap } from "lucide-react";
import Link from "next/link";
import { MODEL_COUNT } from "@/lib/models-data";

interface AuthPromptModalProps {
	open: boolean;
	onClose: () => void;
	/** Contextual reason shown to the user */
	reason?: "paid-model" | "message-limit";
	/** Name of the model they tried to select (for paid-model reason) */
	modelName?: string;
}

const reasons = {
	"paid-model": {
		title: "Sign in to access this model",
		body: (name: string) =>
			`${name} is a premium model. Create a free account to unlock the full catalog — ${MODEL_COUNT} curated models across text, image, and video.`,
	},
	"message-limit": {
		title: "Free messages used up",
		body: () =>
			`You've used your 20 free messages for today. Create a free account to keep chatting — plus API access to ${MODEL_COUNT} curated models.`,
	},
};

export function AuthPromptModal({
	open,
	onClose,
	reason = "message-limit",
	modelName,
}: AuthPromptModalProps) {
	const r = reasons[reason];

	return (
		<AnimatePresence>
			{open && (
				<m.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={springs.soft}
					className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay/60 backdrop-blur-sm"
					onClick={onClose}
					role="dialog"
					aria-modal="true"
					aria-label={r.title}
				>
					<m.div
						initial={{ opacity: 0, scale: 0.98, y: 4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.98, y: 4 }}
						transition={springs.soft}
						className="relative w-full max-w-sm mx-4 border border-[var(--color-border)] rounded-[var(--radius-xl)] bg-[var(--color-surface-elevated)] p-6 shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Close button */}
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="absolute top-3 right-3 p-2 text-text-muted hover:text-text-primary rounded-full hover:bg-[var(--color-surface)] transition-[color,background-color,transform] duration-200 ease-out active:scale-[0.97] focus-ring"
						>
							<X className="w-4 h-4" />
						</button>

						{/* Icon */}
						<div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] shadow-[0_0_15px_-5px_var(--color-accent-glow)]">
							{reason === "paid-model" ? (
								<Lock className="w-5 h-5 text-[var(--color-accent)]" />
							) : (
								<Zap className="w-5 h-5 text-[var(--color-accent)]" />
							)}
						</div>

						{/* Content */}
						<h2 className="text-center text-lg font-semibold text-text-primary mb-2">
							{r.title}
						</h2>
						<p className="text-center text-sm text-text-muted leading-relaxed mb-6">
							{r.body(modelName ?? "This model")}
						</p>

						{/* CTAs */}
						<div className="flex flex-col gap-2">
							<Link
								href="/login"
								className="flex items-center justify-center gap-2 w-full rounded-[var(--radius-lg)] px-4 py-2.5 bg-[var(--color-accent)] text-[var(--color-accent-fg)] text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-[background-color,transform] active:scale-[0.97]"
							>
								Create Free Account
							</Link>
							<button
								type="button"
								onClick={onClose}
								className="w-full rounded-[var(--radius-lg)] px-4 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-[var(--color-surface)] transition-[color,background-color,transform] duration-200 ease-out active:scale-[0.97] focus-ring"
							>
								Maybe later
							</button>
						</div>

						{/* Footer note */}
						<p className="mt-4 text-center text-[11px] text-text-muted/60">
							Free tier: 20 messages/day · No credit card required
						</p>
					</m.div>
				</m.div>
			)}
		</AnimatePresence>
	);
}
