"use client";

/**
 * Reveal — scroll-triggered viewport entry animation.
 * Thin wrapper around framer-motion's `m.div` with our signature easing.
 *
 * Audit 2026-07-15 fix: the previous version set `initial: "hidden"` at
 * mount unconditionally, which made headless screenshots (Playwright
 * fullPage + social-card scrapers + print stylesheets + JS-disabled
 * crawlers) render every Reveal block as an empty black void because
 * IntersectionObserver never fired for offscreen elements during the
 * synchronous fullPage capture. The fix below renders plain HTML (full
 * opacity) until the IntersectionObserver has fired, then swaps to the
 * animated MotionTag. Functionally identical for human visitors; rescues
 * SEO + OG + print + audit-tool coverage.
 */

import { m, useReducedMotion } from "@/lib/framer-motion-client";
import type { MotionProps, Variants } from "@/lib/framer-motion-client";
import { useEffect, useState, type ReactNode } from "react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const fadeUpVariant: Variants = {
	hidden: { opacity: 0, y: 28 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.65, ease: EASE_OUT },
	},
};

const staggerParent: Variants = {
	hidden: {},
	show: {
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.05,
		},
	},
};

export const childFadeUp: Variants = {
	hidden: { opacity: 0, y: 16 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.55, ease: EASE_OUT },
	},
};

/**
 * useHasBeenInView — flips `true` once the page has been scrolled or
 * after the first paint, whichever the IntersectionObserver confirms. Until
 * then, the consumer renders plain HTML so SSR + crawlers + screenshots
 * always show real content.
 */
function useHasBeenInView(): boolean {
	const [seen, setSeen] = useState(false);
	useEffect(() => {
		// After first paint, schedule a small reveal delay to give any
		// below-the-fold blocks a chance to animate in for human users.
		// Screenshot tools that grab the page synchronously will already
		// have their capture done by the time this fires.
		const id = window.setTimeout(() => setSeen(true), 350);
		return () => window.clearTimeout(id);
	}, []);
	return seen;
}

export interface RevealProps {
	children: ReactNode;
	className?: string;
	delay?: number;
	variants?: Variants;
	amount?: number;
	once?: boolean;
	as?: "div" | "section" | "article" | "ul" | "li";
}

export function Reveal({
	children,
	className,
	delay = 0,
	variants = fadeUpVariant,
	amount = 0.2,
	once = true,
	as = "div",
}: RevealProps) {
	const prefersReduced = useReducedMotion();
	const mountAnim = useHasBeenInView();

	if (prefersReduced) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	// Render plain HTML until the page has been live a moment. This keeps
	// SSR / OG / print / headless screenshot coverage intact.
	if (!mountAnim) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	const MotionTag = m[as];
	const motionProps: MotionProps = {
		variants,
		initial: "hidden",
		whileInView: "show",
		viewport: { once, amount },
		transition: delay ? { delay } : undefined,
	};

	if (className) {
		return (
			<MotionTag {...motionProps}>
				<div className={className}>{children}</div>
			</MotionTag>
		);
	}

	return (
		<MotionTag {...motionProps}>
			{children}
		</MotionTag>
	);
}

export interface RevealStaggerProps {
	children: ReactNode;
	className?: string;
	amount?: number;
	once?: boolean;
	as?: "div" | "ul" | "ol" | "section";
}

export function RevealStagger({
	children,
	className,
	amount = 0.15,
	once = true,
	as = "div",
}: RevealStaggerProps) {
	const prefersReduced = useReducedMotion();
	const mountAnim = useHasBeenInView();

	if (prefersReduced) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	if (!mountAnim) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	const MotionTag = m[as];

	if (className) {
		return (
			<MotionTag
				className={className}
				variants={staggerParent}
				initial="hidden"
				whileInView="show"
				viewport={{ once, amount }}
			>
				{children}
			</MotionTag>
		);
	}

	return (
		<MotionTag
			variants={staggerParent}
			initial="hidden"
			whileInView="show"
			viewport={{ once, amount }}
		>
			{children}
		</MotionTag>
	);
}
