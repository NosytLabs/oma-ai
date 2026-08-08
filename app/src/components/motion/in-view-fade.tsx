"use client";

/**
 * InViewFade — small client-side entrance animation for server components.
 *
 * Wraps any block with a fade-up reveal the first time it scrolls into
 * view. Uses framer-motion's `useInView` (so reduced-motion users get an
 * instant render with no transform), and exposes a `delay` prop for
 * staging child sections.
 *
 * Includes a short safety timeout: if IntersectionObserver doesn't fire
 * quickly (SSR, headless, restricted containers), the content paints
 * anyway so it is never blank for long.
 *
 * Set `eager` for above-the-fold primary content (model catalog, hero
 * grids) that must never start at opacity:0.
 *
 * Usage from a server component:
 * import { InViewFade } from "@/components/motion/in-view-fade";
 * <InViewFade><h1>…</h1></InViewFade>
 * <InViewFade delay={0.1}><p>…</p></InViewFade>
 * <InViewFade eager><ModelGrid /></InViewFade>
 */

import { m, useInView, useReducedMotion } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface InViewFadeProps {
	children: ReactNode;
	className?: string;
	/** Seconds to wait before animating in. Default 0. */
	delay?: number;
	/** Trigger only once. Default true. */
	once?: boolean;
	/**
	 * How much of the element needs to be in view. Default 0 so any
	 * pixel of intersection counts (above-fold content lights up immediately).
	 */
	amount?: number;
	/** Vertical travel in px. Default 16. */
	y?: number;
	/**
	 * Skip entrance animation and render at full opacity immediately.
	 * Use for primary catalogs / above-the-fold grids.
	 */
	eager?: boolean;
	/**
	 * Use the Kinetics spring (card) curve for the entrance instead of the
	 * fixed 0.5s ease-out — bouncier reveals for grids of cards.
	 */
	spring?: boolean;
}

/** Headless / slow-IO fallback before permanent blank (ms). */
const IN_VIEW_FADE_SAFETY_MS = 250;

export function InViewFade({
	children,
	className,
	delay = 0,
	once = true,
	amount = 0,
	y = 16,
	eager = false,
	spring = false,
}: InViewFadeProps) {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, {
		once,
		amount,
		// Treat near-viewport content as visible so first paint isn't blank.
		margin: "120px 0px 0px 0px",
	});
	const reduced = useReducedMotion();
	const [fallbackVisible, setFallbackVisible] = useState(eager);

	// Safety: if IntersectionObserver hasn't fired soon, show anyway.
	useEffect(() => {
		if (eager || inView || reduced) return;
		const timer = setTimeout(() => setFallbackVisible(true), IN_VIEW_FADE_SAFETY_MS);
		return () => clearTimeout(timer);
	}, [eager, inView, reduced]);

	const shouldAnimate = eager || inView || fallbackVisible;

	if (reduced || eager) {
		return <div className={className}>{children}</div>;
	}

	return (
		<m.div
			ref={ref}
			className={className}
			initial={{ opacity: 0, y }}
			animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y }}
transition={
			spring
				? { ...springs.card, delay }
				: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }
		}
		>
			{children}
		</m.div>
	);
}
