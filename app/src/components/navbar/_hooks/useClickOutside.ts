"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
	* Calls `onOutside` when a `mousedown` occurs outside the given `ref`.
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

		function onDocClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				handlerRef.current();
			}
		}

		document.addEventListener("mousedown", onDocClick);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
		};
	}, [active, ref]);
}
