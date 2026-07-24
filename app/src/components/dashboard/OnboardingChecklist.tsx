"use client";

import { memo } from "react";
import { m } from "@/lib/framer-motion-client";
import {
	BookOpen,
	Check,
	Key,
	Terminal,
	Wallet,
	X,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const DISMISS_KEY = "oma-onboarding-dismissed";

interface OnboardingChecklistProps {
	/** Whether the user has connected their wallet (always true when visible). */
	walletConnected: boolean;
	/** Whether the user has at least one API key. */
	hasApiKey: boolean;
	/** Whether the user has made at least one API call. */
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
			description: "Account number or wallet — no email required.",
			icon: Wallet,
			done: walletConnected,
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
					className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
				>
					<Key className="h-3 w-3" aria-hidden="true" />
					Create key
				</button>
			) : undefined,
		},
		{
			id: "first-call",
			label: "Make your first API call",
			description: "Test the gateway with a simple request.",
			icon: Terminal,
			done: hasUsage,
			action: !hasUsage ? (
				<Link
					href="/docs"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
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
			transition={{ duration: 0.3 }}
			className="mb-6 border border-accent/20 bg-accent/5"
			role="region"
			aria-label="Getting started"
		>
			{/* Header */}
			<div className="flex items-center justify-between px-5 py-4 border-b border-accent/10">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
						<Zap className="h-4 w-4 text-accent" aria-hidden="true" />
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
					className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text transition-colors rounded hover:bg-surface"
				>
					<X className="h-4 w-4" aria-hidden="true" />
				</button>
			</div>

			{/* Progress bar */}
			<div className="h-0.5 bg-border">
				<m.div
					className="h-full bg-accent"
					initial={{ width: 0 }}
					animate={{ width: `${(completedCount / steps.length) * 100}%` }}
					transition={{ duration: 0.5, ease: "easeOut" }}
				/>
			</div>

			{/* Steps */}
			<div className="divide-y divide-border">
				{steps.map((step, i) => {
					return (
						<m.div
							key={step.id}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.25, delay: 0.05 * i }}
							className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
								step.done
									? "bg-success/5"
									: "hover:bg-surface/50"
							}`}
						>
							{/* Step indicator */}
							<div
								className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
									step.done
										? "border-success/30 bg-success/10 text-success"
										: "border-border bg-surface text-text-muted"
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
											step.done ? "text-success" : "text-text-bright"
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