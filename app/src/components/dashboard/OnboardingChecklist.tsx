"use client";

import { memo } from "react";
import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { BookOpen, Check, Key, Terminal, Wallet, X, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const DISMISS_KEY = "oma-onboarding-dismissed";

interface OnboardingChecklistProps {
	/** Whether the user already has a real session (email or wallet). */
	signedIn?: boolean;
	/** Whether the user has connected their wallet (always true when visible). */
	walletConnected: boolean;
	/** Whether the user has at least one API key. */
	hasApiKey: boolean;
	/** Whether the account has made a chat or API request. */
	hasUsage: boolean;
	/** Callback to create an API key (navigates to API Keys tab). */
	onCreateKey?: () => void;
	/** Callback to create key from the checklist itself. */
	onNavigateToApiKeys?: () => void;
}

interface Step {
	id: string;
	label: string;
	description: string;
	icon: React.ElementType;
	done: boolean;
	action?: React.ReactNode;
}

/**
	* A dismissible onboarding checklist that appears on the dashboard overview
	* for first-time users. Shows progressive steps: wallet → API key → first call.
	*
	* Persists dismissal to localStorage so it doesn't reappear after the user
	* explicitly closes it.
	*/
export const OnboardingChecklist = memo(function OnboardingChecklist({
	signedIn,
	walletConnected,
	hasApiKey,
	hasUsage,
	onNavigateToApiKeys,
}: OnboardingChecklistProps) {
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
	try {
	setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
	} catch {
	// SSR or private browsing — assume not dismissed
	}
	}, []);

	const handleDismiss = useCallback(() => {
	setDismissed(true);
	try {
	localStorage.setItem(DISMISS_KEY, "1");
	} catch {
	// ignore
	}
	}, []);

	const steps: Step[] = [
	{
	id: "wallet",
	// Account-number sessions also count as signed-in (walletConnected=true).
	label: "Sign in",
	description: "Magic link or wallet — no password required.",
	icon: Wallet,
	done: Boolean(signedIn || walletConnected),
	},
	{
	id: "api-key",
	label: "Create an API key",
	description: "Needed to authenticate API requests.",
	icon: Key,
	done: hasApiKey,
	action: !hasApiKey ? (
	<button
	type="button"
	onClick={onNavigateToApiKeys}
	className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
	>
	<Key className="h-3 w-3" aria-hidden="true" />
	Create key
	</button>
	) : undefined,
	},
	{
	id: "first-call",
	label: "Make your first request",
	description: "Try the chat playground or send an API request.",
	icon: Terminal,
	done: hasUsage,
	action: !hasUsage ? (
	<Link
	href="/docs"
	target="_blank"
	rel="noopener noreferrer"
	className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors duration-200 ease-out"
	>
	<BookOpen className="h-3 w-3" aria-hidden="true" />
	Read the docs
	</Link>
	) : undefined,
	},
	];

	const completedCount = steps.filter((s) => s.done).length;
	const allDone = completedCount === steps.length;

	// Don't show if dismissed or all steps complete
	if (dismissed || allDone) return null;

	return (
	<m.div
	initial={{ opacity: 0, y: -8 }}
	animate={{ opacity: 1, y: 0 }}
	exit={{ opacity: 0, y: -8 }}
	transition={springs.card}
	className="mb-6 border border-[var(--color-accent)]/20 bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-md)]"
	role="region"
	aria-label="Getting started"
	>
	{/* Header */}
	<div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-accent)]/10">
	<div className="flex items-center gap-3">
	<div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-accent)]/20 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]">
	<Zap className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
	</div>
	<div>
	<h2 className="text-sm font-semibold text-text-bright">
	Getting started
	</h2>
	<p className="text-[11px] text-text-muted">
	{completedCount} of {steps.length} complete
	</p>
	</div>
	</div>
	<button
	type="button"
	onClick={handleDismiss}
	aria-label="Dismiss onboarding"
	className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-[var(--color-text-primary)] transition-colors duration-200 ease-out rounded-[var(--radius-sm)] hover:bg-[var(--color-surface)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
	>
	<X className="h-4 w-4" aria-hidden="true" />
	</button>
	</div>

	{/* Progress bar */}
	<div className="h-0.5 bg-[var(--color-border)]">
	{/* scaleX instead of width — compositor-only, no per-frame layout */}
	<m.div
	className="h-full w-full bg-[var(--color-accent)] origin-left"
	initial={{ scaleX: 0 }}
	animate={{ scaleX: completedCount / steps.length }}
	transition={springs.counter}
	/>
	</div>

	{/* Steps */}
	<div className="divide-y divide-[var(--color-border)]">
	{steps.map((step, i) => {
	return (
	<m.div
	key={step.id}
	initial={{ opacity: 0, x: -8 }}
	animate={{ opacity: 1, x: 0 }}
	transition={{ ...springs.soft, delay: 0.05 * i }}
	className={`flex items-center gap-4 px-5 py-3.5 transition-colors duration-200 ease-out ${
	step.done ? "bg-[color-mix(in_srgb,var(--color-success)_5%,transparent)]" : "hover:bg-[var(--color-surface)]/50"
	}`}
	>
	{/* Step indicator */}
	<div
	className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors duration-200 ease-out ${
	step.done
	? "border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)]"
	: "border-[var(--color-border)] bg-[var(--color-surface)] text-text-muted"
	}`}
	aria-hidden="true"
	>
	{step.done ? (
	<Check className="h-3.5 w-3.5" />
	) : (
	<span className="font-mono">{i + 1}</span>
	)}
	</div>

	{/* Step content */}
	<div className="flex-1 min-w-0">
	<div className="flex items-center gap-2">
	<span
	className={`text-sm font-medium ${
	step.done ? "text-[var(--color-success)]" : "text-text-bright"
	}`}
	>
	{step.label}
	</span>
	{step.done && (
	<Badge variant="success" className="text-[10px]">
	Done
	</Badge>
	)}
	</div>
	<p className="text-[11px] text-text-muted mt-0.5 truncate">
	{step.description}
	</p>
	</div>

	{/* Action */}
	{step.action && <div className="shrink-0">{step.action}</div>}
	</m.div>
	);
	})}
	</div>
	</m.div>
	);
});
