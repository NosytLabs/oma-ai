"use client";

/**
 * Reveal — scroll-triggered viewport entry animation.
 * Framer-free implementation built on useRevealInView (native IntersectionObserver)
 * so no framer-motion runtime is pulled into the marketing bundle.
 *
 * SEO safety (preserved from the previous framer version): content starts at
 * FULL OPACITY and only gains a reveal animation class once it is in view.
 * Even if the observer never fires (headless screenshots, OG scrapers, print,
 * JS-disabled crawlers), the hard-ceiling timer in useRevealInView forces the
 * revealed state — so a document is NEVER render-blocked by opacity:0.
 *
 * `delay` is honoured only for human visitors via a CSS animation-delay; the
 * element is still visible before the animation starts because content is
 * opacity:1 by default.
 */

import { useRevealInView } from "@/lib/use-reveal-in-view";
import { cn } from "@/components/ui/utils";
import type { ReactNode } from "react";

export interface RevealProps {
	children: ReactNode;
	className?: string;
	delay?: number;
	amount?: number;
	once?: boolean;
	as?: "div" | "section" | "article" | "ul" | "ol" | "li";
}

/**
 * RevealStaggerProps — children are expected to opt into the reveal animation
 * individually (each item can carry the `reveal-child` class directly). The
 * container itself just triggers on entering view and staggers via CSS
 * transition-delay set by consumers. For grid items that used framer
 * variants, the `reveal-child` class is applied to each item to animate them
 * staggered.
 */
export interface RevealStaggerProps {
	children: ReactNode;
	className?: string;
	amount?: number;
	once?: boolean;
	as?: "div" | "ul" | "ol" | "section";
}

export function Reveal({
	children,
	className,
	delay = 0,
	as = "div",
	amount = 0.2,
	once = true,
}: RevealProps) {
	const { ref, show } = useRevealInView({ amount, once });
	const Tag = as;

	return (
		<Tag
			ref={ref as never}
			className={cn(className, "reveal-target")}
			data-revealed={show}
			style={delay ? { ["--reveal-delay" as string]: `${delay}s` } : undefined}
		>
			{children}
		</Tag>
	);
}

export function RevealStagger({
	children,
	className,
	amount = 0.15,
	once = true,
	as = "div",
}: RevealStaggerProps) {
	const { ref, show } = useRevealInView({ amount, once });
	const Tag = as;

	return (
		<Tag
			ref={ref as never}
			className={cn(className, "reveal-target")}
			data-revealed={show}
		>
			{children}
		</Tag>
	);
}
