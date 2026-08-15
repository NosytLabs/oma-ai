"use client";

/**
	* useRevealInView — robust scroll-reveal trigger.
	* -----------------------------------------------
	* framer-motion's `whileInView` with `once: true` has a known blind spot:
	* if the user jumps PAST an element (End key, Page Down, anchor navigation,
	* find-in-page, deep-link with a large scroll restoration), the
	* IntersectionObserver may never report it as intersecting — so the content
	* stays at `opacity: 0` forever and the page shows a black void.
	*
	* Three-layer safety so this never strands content invisible:
	*   1. inView (framer-motion's IntersectionObserver) — fast path
	*   2. "scrolled past" passive listener — covers Page-Down / End / anchor
	*   3. hard ceiling: after 1500ms, force revealed regardless of position
	*      — covers OG-image / link-unfurl / print / screenshot / never-scrolled
	*      deep-page content. The 1.5s delay is invisible to real users
	*      (above-fold reveals happen within ~100ms via the IO path) but
	*      guarantees full-page screenshots, search-engine crawlers, and OG
	*      previews never see a half-rendered page.
	* One passive scroll listener per instance, rAF-throttled.
	*/

import { useInView } from "@/lib/framer-motion-client";
import { useEffect, useRef, useState } from "react";

export interface UseRevealInViewOptions {
	/** Fraction of the element that must be visible to trigger (0-1). */
	amount?: number;
	/** Keep revealed after first trigger (default true). */
	once?: boolean;
}

export function useRevealInView<T extends HTMLElement = HTMLDivElement>(
	options?: UseRevealInViewOptions,
) {
	const { amount = 0.2, once = true } = options ?? {};
	const ref = useRef<T | null>(null);
	const inView = useInView(ref, { once, amount });
	const [passed, setPassed] = useState(false);

	useEffect(() => {
		if (!once) return;
		if (inView || passed) return;
		let raf = 0;

		const check = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				const el = ref.current;
				if (!el) return;
				const r = el.getBoundingClientRect();
				// Two fast-path triggers:
				//   1. fully above the viewport → user scrolled past it
				//   2. bottom is inside the viewport → any part is on screen
				if (r.bottom < 0 || r.bottom <= window.innerHeight) setPassed(true);
			});
		};

		check();
		window.addEventListener("scroll", check, { passive: true });
		window.addEventListener("resize", check);

		// Hard ceiling: after 1500ms, force revealed regardless of position.
		// This is the "fourth safety" — guarantees that below-fold content
		// never stays stuck at opacity 0 in full-page screenshots, OG-image
		// scrapes, print styles, or any rendering path where the user (or
		// bot) doesn't actually scroll. Above-fold content already revealed
		// by the IO + fast-path listeners before this fires.
		const ceiling = window.setTimeout(() => {
			setPassed(true);
		}, 1500);

		return () => {
			window.removeEventListener("scroll", check);
			window.removeEventListener("resize", check);
			window.clearTimeout(ceiling);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [inView, passed, once]);

	return { ref, show: inView || passed };
}
