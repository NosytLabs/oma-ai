"use client";

/**
	* InViewFade — small client-side entrance animation for server components.
	*
	* Wraps any block with a fade-up reveal the first time it scrolls into
	* view. Uses a framer-free IntersectionObserver-based hook, and exposes a
	* `delay` prop for staging child sections.
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

import { useRevealInView } from "@/lib/use-reveal-in-view";
import { cn } from "@/components/ui/utils";
import type { ReactNode } from "react";

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
	/** Vertical travel in px before reveal. Default 16. */
	y?: number;
	/**
	 * Skip entrance animation and render at full opacity immediately.
	 * Use for primary catalogs / above-the-fold grids.
	 */
	eager?: boolean;
}

export function InViewFade({
	children,
	className,
	delay = 0,
	once = true,
	amount = 0,
	y = 16,
	eager = false,
}: InViewFadeProps) {
	const { ref, show } = useRevealInView<HTMLDivElement>({ amount, once, ceilingMs: 250 });

	if (eager || show) {
		return <div ref={ref} className={className}>{children}</div>;
	}

	return (
		<div
			ref={ref}
			className={cn(className, "reveal-target")}
			data-revealed={show}
			style={{
				["--reveal-delay" as string]: delay ? `${delay}s` : "0s",
				["--reveal-y" as string]: `${y}px`,
			}}
		>
			{children}
		</div>
	);
}
