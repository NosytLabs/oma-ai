"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
	'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab / Shift+Tab focus inside the container ref when `enabled` is true.
 * Restores focus to the previously-active element on unmount / disable.
 *
 * Usage:
 * ```tsx
 * const trapRef = useFocusTrap(isOpen);
 * return <div ref={trapRef}>{children}</div>;
 * ```
 */
export function useFocusTrap(enabled: boolean) {
	const containerRef = useRef<HTMLDivElement>(null);
	const previousFocus = useRef<Element | null>(null);

	useEffect(() => {
		if (!enabled) return;

		previousFocus.current = document.activeElement;

		// Focus the first focusable element on open (deferred so the DOM is ready)
		const frame = requestAnimationFrame(() => {
			const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
			first?.focus();
		});

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const el = containerRef.current;
			if (!el) return;

			const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", handleKeyDown);
			// Restore focus to the trigger element
			if (previousFocus.current instanceof HTMLElement) {
				previousFocus.current.focus();
			}
		};
	}, [enabled]);

	return containerRef;
}
