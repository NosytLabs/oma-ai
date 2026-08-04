"use client";

/**
 * OMA AI — Shared motion primitives
 * ---------------------------------
 * Used across all pages for consistent, premium animation.
 * Built on framer-motion's `m` (LazyMotion-compatible) so it stays
 * tree-shakeable with the MotionProvider in layout.tsx.
 *
 * Usage:
 *   import { staggerContainer, fadeUp } from '@/lib/animation'
 *   <m.ul variants={staggerContainer} initial="hidden" whileInView="show">
 *     <m.li variants={fadeUp}>…</m.li>
 *   </m.ul>
 *
 * Interactive primitives like Magnetic live in `@/lib/animation`.
 * Scroll helpers like InViewFade live in `@/components/motion`.
 */

import { springs } from "./springs";
import { m, useReducedMotion } from "@/lib/framer-motion-client";
import type { Variants } from "@/lib/framer-motion-client";
import { useRevealInView } from "@/lib/use-reveal-in-view";

import type { ReactNode } from "react";

/* ============================================================
   EASING & SPRING PRESETS
   Consistent feel across the whole app.
   ============================================================ */

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
// Canonical spring values live in components/motion/springs.ts — these are
// aliases so both entry points share one token set (they previously drifted
// by a mass typo: 0.8 here vs 0.9 there).
export const EASE_SPRING = springs.tab;
export const EASE_SPRING_SOFT = springs.soft;

/* ============================================================
   VARIANT PRESETS — plain objects, work with `m` + `variants`
   ============================================================ */

/** Container that staggers its children as they enter. */
export const staggerContainer = (
	stagger = 0.06,
	delayChildren = 0,
): Variants => ({
	hidden: {},
	show: {
		transition: { staggerChildren: stagger, delayChildren },
	},
});

export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 24 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: EASE_OUT },
	},
};

export const blurIn: Variants = {
	hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
	show: {
		opacity: 1,
		y: 0,
		filter: "blur(0px)",
		transition: { duration: 0.7, ease: EASE_OUT },
	},
};

/* ============================================================
   StaggerReveal — container + item helper
   ============================================================ */

interface StaggerRevealProps {
	children: ReactNode;
	className?: string;
	stagger?: number;
	delayChildren?: number;
	as?: "div" | "ul" | "section";
	once?: boolean;
}

export function StaggerReveal({
	children,
	className,
	stagger = 0.06,
	delayChildren = 0,
	as = "div",
	once = true,
}: StaggerRevealProps) {
	const prefersReduced = useReducedMotion();
	const { ref, show } = useRevealInView({ amount: 0.15, once });
	const MotionTag = m[as];

	if (prefersReduced) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	return (
		<MotionTag
			ref={ref as never}
			className={className}
			variants={staggerContainer(stagger, delayChildren)}
			initial="hidden"
			animate={show ? "show" : "hidden"}
		>
			{children}
		</MotionTag>
	);
}
