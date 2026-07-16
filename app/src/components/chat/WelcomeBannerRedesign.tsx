"use client";

/**
 * WELCOME BANNER REDESIGN — "Terminal Noir" Aesthetic
 *
 * Cinematic entry point with:
 * - Animated gradient border + ambient glow
 * - Staggered step reveals with actionable descriptions
 * - Typewriter headline with blinking cursor
 * - Model recommendation for beginners
 * - Quick-start shortcut hints
 * - Credit estimation for first message
 *
 * Mobile-first: steps stack vertically, CTAs are full-width on small screens.
 */

import { AnimatePresence, m } from "framer-motion";
import {
	ArrowRight,
	Coins,
	GitCompare,
	Keyboard,
	MessageSquare,
	Send,
	Sparkles,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

const STORAGE_KEY = "oma-chat-welcome-dismissed";
const TIPS_KEY = "oma-chat-tips-seen";
const AUTO_DISMISS_MS = 5000;

interface WelcomeBannerProps {
	onSelectExample: () => void;
	onGetStarted: () => void;
}

const STEPS = [
	{
		id: 1,
		label: "Choose your model",
		description: "Pick from 96+ models — frontier, budget, or specialized",
		icon: Sparkles,
		accent: "var(--color-accent)",
	},
	{
		id: 2,
		label: "Craft your prompt",
		description: "Type naturally — or use a preset to get started fast",
		icon: MessageSquare,
		accent: "var(--color-success)",
	},
	{
		id: 3,
		label: "Send your request",
		description: "Press Enter to execute · Shift+Enter for new lines",
		icon: Send,
		accent: "var(--color-info)",
	},
	{
		id: 4,
		label: "Track your costs",
		description: "See token usage and cost per message in real time",
		icon: Coins,
		accent: "var(--color-warning)",
	},
] as const;

const PRO_TIPS = [
	{
		icon: GitCompare,
		text: "Compare two models side-by-side with the COMPARE button",
	},
	{
		icon: Keyboard,
		text: "Press ? for keyboard shortcuts — Cmd+K to switch models",
	},
	{
		icon: Zap,
		text: "Enable WEB SEARCH to ground responses in real-time data",
	},
];

// Stagger container for step items
const containerVariants = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.06,
			delayChildren: 0.2,
		},
	},
};

const stepVariants = {
	hidden: { opacity: 0, y: 12, scale: 0.97 },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: {
			type: "spring" as const,
			stiffness: 300,
			damping: 24,
		},
	},
};

// Typewriter headline
function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
	const [displayed, setDisplayed] = useState("");
	const [showCursor, setShowCursor] = useState(true);

	useEffect(() => {
		const chars = text.split("");

		const timeout = setTimeout(() => {
			chars.forEach((_char, i) => {
				setTimeout(() => {
					setDisplayed(text.slice(0, i + 1));
				}, i * 30); // 30ms per character — slightly faster
			});

			// Stop cursor after typing completes
			setTimeout(() => setShowCursor(false), chars.length * 30 + 800);
		}, delay);

		return () => clearTimeout(timeout);
	}, [text, delay]);

	return (
		<span className="inline">
			{displayed}
			{showCursor && (
				<span
					className="inline-block w-[2px] h-[1em] bg-accent ml-0.5 align-baseline"
					style={{ animation: "oma-blink-caret 1.1s steps(1) infinite" }}
				/>
			)}
		</span>
	);
}

export function WelcomeBanner({
	onSelectExample,
	onGetStarted,
}: WelcomeBannerProps) {
	const toast = useToast();
	// SSR-safe: default to hidden, then read localStorage after mount
	const [visible, setVisible] = useState(false);
	const [dismissed, setDismissed] = useState(true);
	const [showTips, setShowTips] = useState(false);
	useEffect(() => {
		try {
			const notDismissed = localStorage.getItem(STORAGE_KEY) !== "1";
			setVisible(notDismissed);
			setDismissed(!notDismissed);
			setShowTips(localStorage.getItem(TIPS_KEY) !== "1");
		} catch {
			// localStorage unavailable (SSR) — keep defaults
		}
	}, []);

	// Track whether this dismissal was user-initiated (X button / CTA) vs.
	// auto-dismissed by the timer. We only fire the corner toast on auto-dismiss;
	// a user who explicitly closes the banner has already seen it.
	const userInitiatedDismissRef = useRef(false);

	const handleDismiss = useCallback(() => {
		try {
			localStorage.setItem(STORAGE_KEY, "1");
		} catch {}
		setDismissed(true);
		setVisible(false);
		if (!userInitiatedDismissRef.current) {
			toast.info("Press ? anytime for keyboard shortcuts");
		}
		userInitiatedDismissRef.current = false;
	}, [toast]);

	// Auto-dismiss after AUTO_DISMISS_MS so the banner doesn't crowd the empty
	// chat. User can still read it during the typewriter animation; this just
	// gets it out of the way once they've had a moment to orient.
	// (The first-message path already hides us via the parent's
	// `deferredMessages.length === 0` guard in MessagesList.tsx, so we only
	// need to handle the "user never sent anything" case here.)
	useEffect(() => {
		if (!visible || dismissed) return;
		const t = setTimeout(() => {
			// Auto-dismiss: fire corner toast as a lighter-weight reminder.
			// Don't mark this as user-initiated, so handleDismiss will toast.
			handleDismiss();
		}, AUTO_DISMISS_MS);
		return () => clearTimeout(t);
	}, [visible, dismissed, handleDismiss]);

	const handleGetStarted = () => {
		userInitiatedDismissRef.current = true;
		handleDismiss();
		onGetStarted();
	};

	const handleViewExamples = () => {
		userInitiatedDismissRef.current = true;
		handleDismiss();
		onSelectExample();
	};

	const dismissTips = () => {
		try {
			localStorage.setItem(TIPS_KEY, "1");
		} catch {}
		setShowTips(false);
	};

	return (
		<AnimatePresence>
			{visible && !dismissed && (
				<m.div
					initial={{ opacity: 0, y: -12 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -12, scale: 0.98 }}
					transition={{ type: "spring", stiffness: 300, damping: 30 }}
					role="region"
					aria-label="Welcome to OMA chat"
					className="flex-none border-b border-border relative overflow-hidden"
				>
					{/* ─── Ambient background glow ─── */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							background: `
                radial-gradient(ellipse 60% 80% at 10% 50%, var(--color-accent-dim) 0%, transparent 50%),
                radial-gradient(ellipse 40% 60% at 90% 30%, var(--color-tertiary-dim) 0%, transparent 40%)
              `,
						}}
					/>

					{/* ─── Animated gradient border at top ─── */}
					<div
						className="absolute top-0 left-0 right-0 h-px"
						style={{
							background:
								"linear-gradient(90deg, transparent, var(--color-accent), var(--color-tertiary), transparent)",
							backgroundSize: "200% 100%",
							animation: "oma-gradient-shift 4s ease infinite",
						}}
					/>

					<div className="relative max-w-4xl mx-auto px-4 md:px-8 py-5">
						{/* ─── Header ─── */}
						<div className="flex items-start justify-between gap-3 mb-4">
							<div>
								<h2 className="text-sm font-mono font-bold text-text uppercase tracking-widest">
									<TypewriterText
										text="> WELCOME TO OMA AI PLAYGROUND"
										delay={100}
									/>
								</h2>
								<m.p
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.6 }}
									className="text-xs text-text-muted font-mono mt-1.5"
								>
									YOUR AI ASSISTANT · ONE KEY TO EVERY MODEL · SMART PRICING
								</m.p>
							</div>
							<button
								type="button"
								onClick={() => {
									userInitiatedDismissRef.current = true;
									handleDismiss();
								}}
								aria-label="Dismiss welcome banner"
								className="
                  p-2 text-text-muted hover:text-text-secondary transition-colors
                  min-h-[44px] min-w-[44px] flex items-center justify-center
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                "
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						{/* ─── Steps — Staggered reveal with descriptions ─── */}
						<m.ol
							variants={containerVariants}
							initial="hidden"
							animate="visible"
							className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-5"
						>
							{STEPS.map((step) => {
								const Icon = step.icon;
								return (
									<m.li
										key={step.id}
										variants={stepVariants}
										className="
                      flex items-start gap-2.5 px-3 py-3
                      border border-border/60 bg-void/60 backdrop-blur-sm
                      hover:border-accent/30 transition-colors duration-200
                    "
									>
										<span
											className="
                        flex items-center justify-center w-6 h-6 shrink-0 mt-0.5
                        text-[10px] font-mono font-bold
                      "
											style={{
												border: `1px solid ${step.accent}30`,
												color: step.accent,
											}}
										>
											{step.id}
										</span>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5">
												<Icon className="w-3 h-3 text-text-muted shrink-0" />
												<span className="text-xs font-mono font-bold text-text-secondary">
													{step.label}
												</span>
											</div>
											<p className="text-[10px] font-mono text-text-muted mt-0.5 leading-relaxed hidden sm:block">
												{step.description}
											</p>
										</div>
									</m.li>
								);
							})}
						</m.ol>

						{/* ─── Quick model recommendation ─── */}
						<m.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.5 }}
							className="mb-4 px-3 py-2 border border-accent/20 bg-accent/5 text-[10px] font-mono text-accent/80"
						>
							<span className="font-bold text-accent">TIP:</span> Not sure where
							to start? Try{" "}
							<span className="text-accent font-bold">Claude Sonnet 4</span> for
							balanced quality and speed, or{" "}
							<span className="text-accent font-bold">GPT-4o mini</span> for
							fast, affordable responses.
						</m.div>

						{/* ─── Pro Tips (first visit only) ─── */}
						<AnimatePresence>
							{showTips && (
								<m.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.2 }}
									className="overflow-hidden mb-4"
								>
									<div className="flex items-center justify-between mb-2">
										<span className="text-[10px] font-mono text-text-muted uppercase tracking-widest font-bold">
											PRO TIPS
										</span>
										<button
											type="button"
											onClick={dismissTips}
											className="text-[9px] font-mono text-text-muted hover:text-text-secondary transition-colors"
										>
											GOT IT
										</button>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
										{PRO_TIPS.map((tip, i) => (
											<m.div
												key={i}
												initial={{ opacity: 0, x: -8 }}
												animate={{ opacity: 1, x: 0 }}
												transition={{ delay: 0.6 + i * 0.1 }}
												className="flex items-start gap-2 px-2.5 py-2 bg-surface/50 border border-border/40 text-[10px] font-mono text-text-muted"
											>
												<tip.icon className="w-3 h-3 shrink-0 mt-0.5 text-text-muted/60" />
												<span className="leading-relaxed">{tip.text}</span>
											</m.div>
										))}
									</div>
								</m.div>
							)}
						</AnimatePresence>

						{/* ─── CTAs ─── */}
						<m.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								delay: 0.4,
								type: "spring",
								stiffness: 300,
								damping: 24,
							}}
							className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
						>
							<button
								type="button"
								onClick={handleGetStarted}
								className="
                  inline-flex items-center justify-center gap-1.5 px-5 py-2.5
                  bg-accent text-text-inverse text-[11px] font-mono font-bold
                  uppercase tracking-widest hover:bg-accent-hover
                  transition-all duration-200 hover:shadow-[0_0_20px_var(--color-accent-glow)]
                  min-h-[44px]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                "
							>
								GET STARTED
								<ArrowRight className="w-3 h-3" />
							</button>
							<button
								type="button"
								onClick={handleViewExamples}
								className="
                  inline-flex items-center justify-center gap-1.5 px-5 py-2.5
                  border border-border text-text-secondary text-[11px] font-mono
                  font-bold uppercase tracking-widest
                  hover:bg-surface hover:border-success/30 hover:text-success
                  transition-all duration-200 min-h-[44px]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                "
							>
								VIEW EXAMPLES
							</button>
						</m.div>
					</div>
				</m.div>
			)}
		</AnimatePresence>
	);
}
