"use client";

import { useEffect, useRef } from "react";

/**
	* useDialog - Shared a11y primitive for modal dialogs.
	*
	* Handles:
	* - Escape key to close
	* - Focus trap (Tab cycles inside the panel)
	* - Initial focus on the first focusable element (or `initialFocusRef`)
	* - Focus restoration to the previously focused element on close
	* - Background scroll lock while open
	*
	* Returns a `panelRef` to attach to the panel element. The component
	* is responsible for `role="dialog"` / `aria-modal` / `aria-labelledby`
	* on its own root.
	*/
export function useDialog({
	open,
	onClose,
	initialFocusRef,
}: {
	open: boolean;
	onClose: () => void;
	initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
	const panelRef = useRef<HTMLDivElement>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);
	const onCloseRef = useRef(onClose);
	useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

	useEffect(() => {
		if (!open) return;

		// Remember what was focused so we can restore it on close.
		previouslyFocusedRef.current =
			(typeof document !== "undefined"
				? (document.activeElement as HTMLElement | null)
				: null) ?? null;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		// Defer initial focus until after the panel paints.
		const focusTimer = window.setTimeout(() => {
			const target =
				initialFocusRef?.current ??
				getFirstFocusable(panelRef.current) ??
				panelRef.current;
			target?.focus();
		}, 0);

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.stopPropagation();
				onCloseRef.current();
				return;
			}
			if (e.key === "Tab" && panelRef.current) {
				const focusables = getFocusables(panelRef.current);
				if (focusables.length === 0) {
					e.preventDefault();
					return;
				}
				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				const active = document.activeElement as HTMLElement | null;
				if (e.shiftKey && active === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && active === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}

		document.addEventListener("keydown", onKeyDown);

		return () => {
			document.removeEventListener("keydown", onKeyDown);
			window.clearTimeout(focusTimer);
			document.body.style.overflow = previousOverflow;
			// Restore focus to the element that opened the dialog.
			previouslyFocusedRef.current?.focus?.();
		};
	}, [open, initialFocusRef]);

	return { panelRef };
}

function getFocusables(root: HTMLElement | null): HTMLElement[] {
	if (!root) return [];
	const selector =
		'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
	return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
		(el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
	);
}

function getFirstFocusable(root: HTMLElement | null): HTMLElement | null {
	const focusables = getFocusables(root);
	return focusables[0] ?? null;
}
