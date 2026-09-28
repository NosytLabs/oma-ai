"use client";

import { type FocusEvent, type KeyboardEvent, useEffect, useRef } from "react";
import { useClickOutside } from "./useClickOutside";

/** Native link disclosure: Tab follows the page, arrows are a convenience. */
export function useNavDisclosure(open: boolean, onOpenChange: (open: boolean) => void) {
	const containerRef = useRef<HTMLDivElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const pendingFocus = useRef<"first" | "last" | null>(null);

	useClickOutside(containerRef, open, () => onOpenChange(false));

	useEffect(() => {
		if (!open || !pendingFocus.current) return;
		const items = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
		const target = pendingFocus.current === "last" ? items?.[items.length - 1] : items?.[0];
		pendingFocus.current = null;
		target?.focus();
	}, [open]);

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Escape" && open) {
			event.preventDefault();
			event.stopPropagation();
			onOpenChange(false);
			toggleRef.current?.focus();
			return;
		}
		const fromToggle = event.target === toggleRef.current;
		const arrows = event.key === "ArrowDown" || event.key === "ArrowUp";
		if (!arrows && (fromToggle || !["Home", "End"].includes(event.key))) return;
		event.preventDefault();
		if (!open) {
			pendingFocus.current = event.key === "ArrowUp" ? "last" : "first";
			onOpenChange(true);
			return;
		}
		const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
		const current = items.indexOf(document.activeElement as HTMLElement);
		let next = current + (event.key === "ArrowUp" ? -1 : 1);
		if (event.key === "Home" || (fromToggle && event.key === "ArrowDown")) next = 0;
		if (event.key === "End" || (fromToggle && event.key === "ArrowUp")) next = items.length - 1;
		items[(next + items.length) % items.length]?.focus();
	}

	function onBlur(event: FocusEvent<HTMLDivElement>) {
		// Replacing or disabling the focused control, and some pointer focus
		// transitions, blur briefly to body with no relatedTarget. Keep the
		// disclosure until focus actually reaches another control; outside
		// pointer presses are already handled by useClickOutside.
		if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
			onOpenChange(false);
		}
	}

	return { containerRef, toggleRef, panelRef, onKeyDown, onBlur };
}
