"use client";

/**
 * InViewFade — small client-side entrance animation for server components.
 *
 * Wraps any block with a fade-up reveal the first time it scrolls into
 * view. Uses framer-motion's `useInView` (so reduced-motion users get an
 * instant render with no transform), and exposes a `delay` prop for
 * staging child sections.
 *
 * Usage from a server component:
 *   import { InViewFade } from "@/components/motion/in-view-fade";
 *   <InViewFade><h1>…</h1></InViewFade>
 *   <InViewFade delay={0.1}><p>…</p></InViewFade>
 */

import { m, useInView, useReducedMotion } from "@/lib/framer-motion-client";
import type { ReactNode } from "react";
import { useRef } from "react";

interface InViewFadeProps {
	children: ReactNode;
	className?: string;
	/** Seconds to wait before animating in. Default 0. */
	delay?: number;
	/** Trigger only once. Default true. */
	once?: boolean;
	/** How much of the element needs to be in view. Default 0.2. */
	amount?: number;
	/** Vertical travel in px. Default 16. */
	y?: number;
}

export function InViewFade({
	children,
	className,
	delay = 0,
	once = true,
	amount = 0.2,
	y = 16,
}: InViewFadeProps) {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once, amount });
	const reduced = useReducedMotion();

	if (reduced) {
		return <div className={className}>{children}</div>;
	}

	return (
		<m.div
			ref={ref}
			className={className}
			initial={{ opacity: 0, y }}
			animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
			transition={{
				duration: 0.5,
				ease: [0.16, 1, 0.3, 1],
				delay,
			}}
		>
			{children}
		</m.div>
	);
}
