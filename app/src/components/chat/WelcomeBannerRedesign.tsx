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

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	ArrowRight,
	Coins,
	GitCompare,
	Keyboard,
	MessageSquare,
	Send,
	Sparkles,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { springs } from "@/lib/animation";
import { MODEL_COUNT } from "@/lib/models-data";

const STORAGE_KEY = "oma-chat-welcome-dismissed";
const TIPS_KEY = "oma-chat-tips-seen";

interface WelcomeBannerProps {
	onSelectExample: () => void;
	onGetStarted: () => void;
}

const STEPS = [
	{
	id: 1,
	label: "Choose your model",
	description: `Pick from ${MODEL_COUNT}+ models — frontier, budget, or specialized`,
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
	icon: Sparkles,
	text: "Start with a free OMA-AI model — no card required for guest chats",
	},
	{
	icon: GitCompare,
	text: "Compare two models side-by-side with the COMPARE button",
	},
	{
	icon: Keyboard,
	text: "Press ? for shortcuts — Cmd+K models · Cmd+/ params",
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
		transition: springs.soft,
	},
};

// Typewriter headline — respects reduced-motion; full string always in a11y tree.
function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
	const [displayed, setDisplayed] = useState("");
	const [showCursor, setShowCursor] = useState(true);
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
	const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
	const sync = () => setReduceMotion(mq.matches);
	sync();
	mq.addEventListener("change", sync);
	return () => mq.removeEventListener("change", sync);
	}, []);

	useEffect(() => {
	if (reduceMotion) {
	setDisplayed(text);
	setShowCursor(false);
	return;
	}
	const chars = text.split("");
	const timeout = setTimeout(() => {
	chars.forEach((_char, i) => {
	setTimeout(() => {
	setDisplayed(text.slice(0, i + 1));
	}, i * 18);
	});
	setTimeout(() => setShowCursor(false), chars.length * 18 + 400);
	}, delay);
	return () => clearTimeout(timeout);
	}, [text, delay, reduceMotion]);

	return (
	<span className="inline">
	<span className="sr-only">{text}</span>
	<span aria-hidden="true">
	{displayed}
	{showCursor && (
	<span
	className="inline-block w-[2px] h-[1em] bg-accent ml-0.5 align-baseline"
	style={{ animation: "caret-blink 1.1s steps(1) infinite" }}
	/>
	)}
	</span>
	</span>
	);
}

export function WelcomeBanner({
	onSelectExample,
	onGetStarted,
}: WelcomeBannerProps) {
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

	const handleDismiss = useCallback(() => {
	try {
	localStorage.setItem(STORAGE_KEY, "1");
	} catch {
	/* private mode / quota */
	}
	setDismissed(true);
	setVisible(false);
	}, []);

	const handleGetStarted = () => {
	handleDismiss();
	onGetStarted();
	};

		const handleViewExamples = () => {
		handleDismiss();
		onSelectExample();
		};

		const dismissTips = () => {
		try {
		localStorage.setItem(TIPS_KEY, "1");
	} catch {
	/* private mode / quota */
	}
		setShowTips(false);
		};

		return (
		<AnimatePresence>
		{visible && !dismissed && (
		<m.div
		initial={{ opacity: 0, y: -12 }}
		animate={{ opacity: 1, y: 0 }}
		exit={{ opacity: 0, y: -12, scale: 0.98 }}
			transition={springs.card}
		role="region"
		aria-label="Welcome to OMA chat"
		className="flex-none border-b border-[var(--color-border)] relative overflow-hidden bg-[var(--color-surface)]/20"
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
	animation: "gradient-shift 4s ease infinite",
	}}
	/>

	<div className="relative max-w-4xl mx-auto px-4 md:px-8 py-4">
	{/* ─── Compact header — collapses the previous 4-step grid into
						 a single, scannable row. Less overwhelming for first-time
						 users while still answering "what is this?" in one line. ─── */}
	<div className="flex items-center justify-between gap-3 mb-3">
	<div className="min-w-0 flex-1">
	<h2 className="truncate text-[13px] font-mono font-bold text-text uppercase tracking-widest">
	<TypewriterText
	text="> WELCOME TO OMA PLAYGROUND"
	delay={40}
	/>
	</h2>
	<m.p
	initial={{ opacity: 0 }}
	animate={{ opacity: 1 }}
	transition={{ delay: 0.6 }}
	className="text-[11px] text-text-muted font-mono mt-1"
	>
	YOUR AI ASSISTANT · ONE KEY TO EVERY MODEL · SMART PRICING
	</m.p>
	</div>
	<button
	type="button"
	onClick={handleDismiss}
	aria-label="Dismiss welcome banner"
	className="
	p-2 text-text-muted hover:text-text-secondary transition-[color,background-color,transform] duration-200 ease-out rounded-full hover:bg-[var(--color-surface)] active:scale-[0.97]
	min-h-[44px] min-w-[44px] flex items-center justify-center
	focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]
	focus-visible:ring-offset-2 focus-visible:ring-offset-surface
	"
	>
	<X className="w-4 h-4" />
	</button>
	</div>

	{/* ─── Steps — collapsed to inline pills so the row stays under 80px tall ─── */}
	<m.ol
	variants={containerVariants}
	initial="hidden"
	animate="visible"
	className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-[11px] font-mono"
	>
	{STEPS.map((step) => {
	const Icon = step.icon;
	return (
	<m.li
	key={step.id}
	variants={stepVariants}
	className="inline-flex items-center gap-1.5 text-text-secondary"
	>
	<span
	aria-hidden="true"
	className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-mono font-bold"
	style={{
	backgroundColor: `${step.accent}1F`,
	border: `1px solid ${step.accent}55`,
	color: step.accent,
	}}
	>
	{step.id}
	</span>
	<Icon
	className="h-3 w-3 shrink-0 opacity-80"
	style={{ color: step.accent }}
	aria-hidden="true"
	/>
	<span className="whitespace-nowrap">{step.label}</span>
	</m.li>
	);
	})}
	</m.ol>

		{/* ─── Compact recommendation — single line, no fill ─── */}
		<m.div
		initial={{ opacity: 0, y: 8 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ delay: 0.55 }}
		className="text-[11px] text-text-secondary font-mono"
		>
		<span className="text-accent font-bold">TIP:</span>{" "}
		<TypewriterText
		text="Guest chat is free on Gonka models like Gemini 3 Flash, Kimi K2.6, MiniMax M2.7, and DeepSeek V4 Flash."
		delay={900}
		/>
		</m.div>

	{/* ─── Pro Tips (first visit only) — collapsed to a single inline row ─── */}
	<AnimatePresence>
	{showTips && (
	<m.div
	initial={{ height: 0, opacity: 0 }}
	animate={{ height: "auto", opacity: 1 }}
	exit={{ height: 0, opacity: 0 }}
	transition={springs.soft}
	className="overflow-hidden mt-3 mb-3"
	>
	<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono text-text-muted">
	<span className="font-bold uppercase tracking-widest text-text-secondary">
	PRO TIPS
	</span>
	{PRO_TIPS.map((tip, i) => (
	<m.span
	key={i}
	initial={{ opacity: 0, x: -6 }}
	animate={{ opacity: 1, x: 0 }}
	transition={{ delay: 0.6 + i * 0.08 }}
	className="inline-flex items-center gap-1.5"
	>
	<tip.icon
	className="h-3 w-3 shrink-0 opacity-70"
	aria-hidden="true"
	/>
	<span>{tip.text}</span>
	</m.span>
	))}
	<button
	type="button"
	onClick={dismissTips}
	className="ml-auto text-[9px] font-mono uppercase tracking-widest text-text-tertiary hover:text-text-secondary transition-colors duration-200 ease-out active:scale-[0.97] focus-ring"
	>
	Got it ✕
	</button>
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
						...springs.card,
					}}
	className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
	>
	<button
	type="button"
	onClick={handleGetStarted}
	className="
	inline-flex items-center justify-center gap-1.5 px-4 py-2
	bg-[var(--color-accent)] text-text-inverse text-[11px] font-mono font-bold
	uppercase tracking-widest hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-lg)]
	transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] hover:shadow-[0_0_20px_var(--color-accent-glow)] hover:brightness-105
	min-h-11
	focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]
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
	inline-flex items-center justify-center gap-1.5 px-4 py-2
	border border-[var(--color-border)] text-text-secondary text-[11px] font-mono
	font-bold uppercase tracking-widest rounded-[var(--radius-lg)]
	hover:bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] hover:border-[var(--color-success)]/30 hover:text-[var(--color-success)]
	transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.97] min-h-11
	focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]
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
