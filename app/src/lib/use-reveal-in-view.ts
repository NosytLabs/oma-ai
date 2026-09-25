"use client";

/**
 * useRevealInView — robust scroll-reveal trigger.
 * -----------------------------------------------
 * Framer-free implementation of the scroll-reveal intersection trigger.
 *
 * Replaces the previous version which relied on framer-motion's `useInView`.
 * Uses a native IntersectionObserver + passive-scroll safety net so the reveal
 * works without pulling framer-motion into the route bundle.
 *
 * Three-layer safety so content is never stranded invisible (matches the
 * previous behaviour — content must NEVER start at opacity 0 for SEO/OG/print):
 *   1. IntersectionObserver — fast path (fires on enter).
 *   2. "scrolled past" passive scroll listener — covers Page-Down / End /
 *      anchor jumps / find-in-page where IO may never report intersection.
 *   3. hard ceiling: after a short delay, force revealed regardless of
 *      position — covers OG-image / link-unfurl / print / screenshot and any
 *      rendering path where the user (or bot) doesn't scroll.
 */

import { useEffect, useRef, useState } from "react";

export interface UseRevealInViewOptions {
	/** Fraction of the element that must be visible to trigger (0-1). */
	amount?: number;
	/** Keep revealed after first trigger (default true). */
	once?: boolean;
	/** ms until we force-reveal regardless of position (default 1500). */
	ceilingMs?: number;
}

export function useRevealInView<T extends HTMLElement = HTMLDivElement>(
	options?: UseRevealInViewOptions,
) {
	const { amount = 0.2, once = true, ceilingMs = 1500 } = options ?? {};
	const ref = useRef<T | null>(null);
	const [revealed, setRevealed] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		let io: IntersectionObserver | null = null;
		let raf = 0;
		let ceiling = 0;

		const trigger = () => {
			setRevealed(true);
			cleanup();
		};

		const checkPosition = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				const node = ref.current;
				if (!node) return;
				const r = node.getBoundingClientRect();
				// 1. fully above the viewport -> user scrolled past it
				// 2. bottom is inside the viewport -> any part is on screen
				if (r.bottom < 0 || r.bottom <= window.innerHeight) trigger();
			});
		};

		function cleanup() {
			if (io) io.disconnect();
			io = null;
			window.removeEventListener("scroll", checkPosition);
			window.removeEventListener("resize", checkPosition);
			if (ceiling) window.clearTimeout(ceiling);
			if (raf) cancelAnimationFrame(raf);
		}

		io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) trigger();
				}
			},
			{
				threshold: Math.min(Math.max(amount, 0), 1),
				// Treat near-viewport content as visible so above-fold never waits.
				rootMargin: "120px 0px 0px 0px",
			},
		);
		io.observe(el);

		if (once) {
			checkPosition();
			window.addEventListener("scroll", checkPosition, { passive: true });
			window.addEventListener("resize", checkPosition);
		}

		// Hard ceiling — never strand content invisible.
		ceiling = window.setTimeout(trigger, ceilingMs);

		return cleanup;
	}, [amount, once, ceilingMs]);

	return { ref, show: revealed };
}
