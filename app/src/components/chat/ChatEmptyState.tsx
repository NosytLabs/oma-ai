"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import Link from "next/link";
import { saveChatDraftForSignIn } from "@/lib/chat-signin-draft";
import { GUEST_DAILY_LIMIT_DEFAULT } from "@/lib/guest-daily-quota";
import { Coins } from "lucide-react";

export interface EmptyStateProps {
	modelName?: string;
	guestAccess?: "free" | "sign-in" | "unknown";
	dailyLimit?: number;
	loginHref?: string;
	onChooseFreeModel?: () => void;
	freeModelName?: string;
	/** Hide guest-quota marketing when the user is signed in. */
	signedIn?: boolean;
	/** Seeds the composer with a starter prompt. Omit to render read-only. */
	onPickPrompt?: (prompt: string) => void;
}

/**
 * Starter prompts double as the empty state's layout ballast. This surface
 * previously reserved 58-62vh around a short welcome block, leaving a large
 * void between the model selector and the composer; these fill it with
 * something a visitor can act on instead of empty space.
 */
const STARTER_PROMPTS = [
	"Explain the difference between tokens and credits.",
	"Write a Python script that calls the OMA chat completions API.",
	"Summarise what x402 settlement does and when to use it.",
] as const;

export function ChatEmptyState({
	signedIn = false,
	onPickPrompt,
	modelName,
	guestAccess = "unknown",
	dailyLimit = GUEST_DAILY_LIMIT_DEFAULT,
	loginHref = "/login",
	onChooseFreeModel,
	freeModelName,
}: EmptyStateProps) {

	return (
		<div className="flex flex-col items-center justify-start py-4 text-center md:py-6">
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
				{modelName ? `Chat with ${modelName}` : "Start a conversation"}
			</m.h2>
			<m.p
				initial={{ y: 12, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.12, ...springs.soft }}
				className="mb-5 max-w-md text-sm leading-relaxed text-text-secondary"
			>
				{signedIn
					? "Start with a question below."
					: guestAccess === "sign-in"
						? `This model requires sign-in and credits.${onChooseFreeModel ? " Sign in to continue, or choose a free model." : ""}`
						: guestAccess === "free"
							? "Start with a question below. This model is free in website chat."
							: "Start with a question below. Current pricing is shown when available."}
			</m.p>

			{!signedIn && guestAccess === "sign-in" && (
				<div className="mb-5 flex flex-wrap justify-center gap-2">
					<Link href={loginHref} onClick={() => saveChatDraftForSignIn()} className="inline-flex min-h-11 items-center rounded-[var(--radius-lg)] bg-accent px-4 py-2 text-sm font-semibold text-[var(--color-accent-fg)] hover:bg-accent-hover focus-ring">Sign in to use this model</Link>
					{onChooseFreeModel && (
						<button type="button" onClick={onChooseFreeModel} className="min-h-11 rounded-[var(--radius-lg)] border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-bright focus-ring">Try {freeModelName ?? "a model"} free</button>
					)}
				</div>
			)}

			{onPickPrompt && (
				<m.ul
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.2, ...springs.soft }}
					className="mb-6 grid w-full max-w-2xl list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3"
				>
					{STARTER_PROMPTS.map((prompt) => (
						<li key={prompt} className="min-w-0">
							<button
								type="button"
								onClick={() => onPickPrompt(prompt)}
								className="flex h-full min-h-11 w-full items-center justify-center rounded-[var(--radius-lg)] border border-border bg-surface/60 px-3 py-2 text-left text-xs leading-relaxed text-text-secondary transition-colors duration-200 ease-out hover:border-accent/40 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								{prompt}
							</button>
						</li>
					))}
				</m.ul>
			)}

			{!signedIn && guestAccess === "free" && (
			<m.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5, ...springs.soft }}
				className="mt-4 flex items-center gap-2 text-[11px] font-mono text-text-muted uppercase tracking-wider"
			>
				<Coins className="h-3.5 w-3.5 text-[var(--color-accent)] opacity-80" aria-hidden="true" />
				Free tier: {dailyLimit} requests/day · no card needed
			</m.div>
			)}
		</div>
	);
}
