"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Calls `onOutside` when a `mousedown` or `touchstart` occurs outside the given `ref`.
 * Also closes when scrolling (to prevent tooltips from remaining stuck during scroll).
 * Strictly click-outside — does not handle Escape. Consumers that need
 * Escape-close (with or without focus restore) should add their own keydown
 * listener; this keeps `useClickOutside` single-purpose and lets asymmetric
 * behaviors (e.g. "restore focus on Escape" for one menu but not another)
 * live in the consumer, not in the hook.
 *
 * `onOutside` is read via a ref so it is always the latest closure without
 * forcing the effect to re-subscribe on every render.
 */
export function useClickOutside(
	ref: RefObject<HTMLElement | null>,
	active: boolean,
	onOutside: () => void,
): void {
	const handlerRef = useRef(onOutside);
	useEffect(() => {
		handlerRef.current = onOutside;
	}, [onOutside]);

	useEffect(() => {
		if (!active) return;

		function onDocClick(e: MouseEvent | TouchEvent) {
			// Ignore clicks inside the ref element or its children
			if (ref.current && !ref.current.contains(e.target as Node)) {
				handlerRef.current();
			}
		}

		function onScroll() {
			handlerRef.current();
		}

		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("touchstart", onDocClick, { passive: true });
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("touchstart", onDocClick);
			window.removeEventListener("scroll", onScroll);
		};
	}, [active, ref]);
}
