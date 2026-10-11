"use client";

import { useEffect } from "react";

/** The streamed page can mount after the browser's native fragment lookup. */
export function useInitialDocAnchor() {
	useEffect(() => {
		const hash = window.location.hash;
		if (!hash) return;
		let id: string;
		try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
		const frame = requestAnimationFrame(() => {
			if (window.location.hash !== hash) return;
			document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
		});
		return () => cancelAnimationFrame(frame);
	}, []);
}
