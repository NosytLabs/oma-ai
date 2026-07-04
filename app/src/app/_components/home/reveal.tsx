"use client";

/**
 * Reveal — scroll-triggered viewport entry animation.
 * Thin wrapper around framer-motion's `m.div` with our signature
 * easing. Respects `prefers-reduced-motion` (handled by MotionConfig
 * in layout.tsx). Use as the outermost animated element of a section.
 */

import { m, useReducedMotion } from "@/lib/framer-motion-client";
import type { MotionProps, Variants } from "@/lib/framer-motion-client";
import type { ReactNode } from "react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const fadeUpVariant: Variants = {
	hidden: { opacity: 0, y: 28 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.65, ease: EASE_OUT },
	},
};

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
	const MotionTag = m[as];

	if (prefersReduced) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	const motionProps: MotionProps = {
		variants,
		initial: "hidden",
		whileInView: "show",
		viewport: { once, amount },
		transition: delay ? { delay } : undefined,
	};

	// framer-motion v12 can internally render as Fragment when animation
	// state is active, which breaks `className` (Fragments only accept `key`
	// and `children`). Keep className off the motion tag; wrap in a div when
	// one is needed.
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

/**
 * RevealStagger — container that staggers its direct motion children.
 * Pair with child items using variants={childFadeUp}.
 */
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
	const MotionTag = m[as];

	if (prefersReduced) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	if (className) {
		return (
			<MotionTag
				variants={staggerParent}
				initial="hidden"
				whileInView="show"
				viewport={{ once, amount }}
			>
				<div className={className}>{children}</div>
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