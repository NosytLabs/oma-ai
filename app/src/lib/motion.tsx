"use client";

/**
 * OMA AI — Shared motion primitives
 * ---------------------------------
 * Used across all pages for consistent, premium animation.
 * Built on framer-motion's `m` (LazyMotion-compatible) so it stays
 * tree-shakeable with the MotionProvider in layout.tsx.
 *
 * Usage:
 *   import { Reveal, staggerContainer, fadeUp } from '@/lib/motion'
 *   <m.ul variants={staggerContainer} initial="hidden" whileInView="show">
 *     <m.li variants={fadeUp}>…</m.li>
 *   </m.ul>
 *   <Reveal><Card /></Reveal>
 *   <Magnetic><CTA /></Magnetic>
 */

import {
	m,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "@/lib/framer-motion-client";
import type { Variants } from "@/lib/framer-motion-client";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

/* ============================================================
   EASING & SPRING PRESETS
   Consistent feel across the whole app.
   ============================================================ */

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_SPRING = {
	type: "spring",
	stiffness: 380,
	damping: 30,
	mass: 0.8,
} as const;
export const EASE_SPRING_SOFT = {
	type: "spring",
	stiffness: 220,
	damping: 26,
	mass: 1,
} as const;

/* ============================================================
   VIEWPORT
   ============================================================ */

const VIEWPORT_ONCE = { once: true, margin: "-60px 0px -60px 0px" } as const;

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

export const fadeRight: Variants = {
	hidden: { opacity: 0, x: 28 },
	show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
	hidden: { opacity: 0, scale: 0.94 },
	show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE_OUT } },
};

export const scaleInSpring: Variants = {
	hidden: { opacity: 0, scale: 0.92 },
	show: { opacity: 1, scale: 1, transition: EASE_SPRING_SOFT },
};

/** Blur-in for headlines — adds a premium focus effect. */
export const blurIn: Variants = {
	hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
	show: {
		opacity: 1,
		y: 0,
		filter: "blur(0px)",
		transition: { duration: 0.7, ease: EASE_OUT },
	},
};

/** "Safe" variant aliases — identical to the base variants but available
 *  under the *Safe name so existing imports resolve. The "Safe" name was
 *  introduced during an earlier refactor; the variants are functionally
 *  the same. */
export const blurInSafe: Variants = blurIn;
export const scaleInSafe: Variants = scaleIn;
export const scaleInSpringSafe: Variants = scaleInSpring;
export const fadeUpSafe: Variants = fadeUp;
export const fadeRightSafe: Variants = fadeRight;

/* ============================================================
   CONVENIENCE: legacy fadeUp props (drop-in replacement for
   the old `fadeUp(delay)` helper used across the codebase).
   ============================================================ */

export function fadeUpProps(delay = 0) {
	return {
		initial: { opacity: 0, y: 20 },
		whileInView: { opacity: 1, y: 0 },
		viewport: VIEWPORT_ONCE,
		transition: { duration: 0.5, delay, ease: EASE_OUT },
	};
}

/* ============================================================
   FadeIn — convenience wrapper, works like Reveal
   ============================================================ */

interface FadeInProps {
	children: ReactNode;
	delay?: number;
	y?: number;
	className?: string;
	as?: "div" | "section" | "li" | "span";
	once?: boolean;
}

export function FadeIn({
	children,
	delay = 0,
	y = 20,
	className,
	as = "div",
	once = true,
}: FadeInProps) {
	return (
		<Reveal delay={delay} y={y} className={className} as={as} once={once}>
			{children}
		</Reveal>
	);
}

/* ============================================================
   Reveal — scroll-triggered wrapper, respects reduced motion
   ============================================================ */

interface RevealProps {
	children: ReactNode;
	/** delay in seconds */
	delay?: number;
	/** y-offset to animate from (px) */
	y?: number;
	className?: string;
	as?: "div" | "section" | "li" | "span";
	once?: boolean;
}

export function Reveal({
	children,
	delay = 0,
	y = 24,
	className,
	as = "div",
	once = true,
}: RevealProps) {
	const prefersReduced = useReducedMotion();
	const MotionTag = m[as];

	if (prefersReduced) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	return (
		<MotionTag
			className={className}
			initial={{ opacity: 0, y }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once, margin: "-60px 0px -60px 0px" }}
			transition={{ duration: 0.6, delay, ease: EASE_OUT }}
		>
			{children}
		</MotionTag>
	);
}

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
	const MotionTag = m[as];

	if (prefersReduced) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	return (
		<MotionTag
			className={className}
			variants={staggerContainer(stagger, delayChildren)}
			initial="hidden"
			whileInView="show"
			viewport={{ once, margin: "-60px 0px -60px 0px" }}
		>
			{children}
		</MotionTag>
	);
}

/* ============================================================
   MagneticButton — cursor-following micro-interaction
   ============================================================ */

interface MagneticProps {
	children: ReactNode;
	className?: string;
	/** max px displacement (default 12) */
	strength?: number;
}

/**
 * Magnetic — element follows the cursor with a spring, snapping back on leave.
 * Pointer-tracking via useMotionValue + useSpring so updates are GPU-composited.
 * The wrap is `display: inline-block` and does not capture pointer events — the
 * child should remain clickable.
 */
export function Magnetic({
	children,
	className,
	strength = 12,
}: MagneticProps) {
	const prefersReduced = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	// LazyMotion-friendly: use the `m` component for both the static span and
	// the inner motion-target so we don't need the full `motion` import.
	// We use plain DOM refs + framer-motion hooks here, which work in LazyMotion.
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
	const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

	useEffect(() => {
		if (prefersReduced) return;
		const el = ref.current;
		if (!el) return;

		const handleMove = (e: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			const relX = e.clientX - (rect.left + rect.width / 2);
			const relY = e.clientY - (rect.top + rect.height / 2);
			// Normalize to [-1, 1] and scale by strength.
			const nx = (relX / Math.max(rect.width, 1)) * strength;
			const ny = (relY / Math.max(rect.height, 1)) * strength;
			x.set(nx);
			y.set(ny);
		};
		const handleLeave = () => {
			x.set(0);
			y.set(0);
		};

		el.addEventListener("mousemove", handleMove);
		el.addEventListener("mouseleave", handleLeave);
		return () => {
			el.removeEventListener("mousemove", handleMove);
			el.removeEventListener("mouseleave", handleLeave);
		};
	}, [prefersReduced, strength, x, y]);

	if (prefersReduced) {
		return <span className={className}>{children}</span>;
	}

	return (
		<m.span
			ref={ref}
			className={`inline-block ${className ?? ""}`}
			style={{ x: sx, y: sy }}
			whileTap={{ scale: 0.97 }}
		>
			{children}
		</m.span>
	);
}
