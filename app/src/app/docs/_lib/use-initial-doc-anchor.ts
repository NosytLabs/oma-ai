"use client";

import { useEffect } from "react";

export function revealDocAnchor(id: string, behavior: ScrollBehavior = "instant") {
	const target = document.getElementById(id);
	if (!target) return;
	let details = target.closest("details");
	while (details) {
		details.open = true;
		details = details.parentElement?.closest("details") ?? null;
	}
	target.scrollIntoView({ behavior, block: "start" });
}

/** The streamed page can mount after the browser's native fragment lookup. */
export function useInitialDocAnchor() {
	useEffect(() => {
		let frame: number | undefined;
		function jump() {
			if (frame !== undefined) cancelAnimationFrame(frame);
			const hash = window.location.hash;
			if (!hash) return;
			let id: string;
			try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
			frame = requestAnimationFrame(() => {
				if (window.location.hash === hash) revealDocAnchor(id);
			});
		}
		jump();
		window.addEventListener("hashchange", jump);
		return () => {
			if (frame !== undefined) cancelAnimationFrame(frame);
			window.removeEventListener("hashchange", jump);
		};
	}, []);
}
