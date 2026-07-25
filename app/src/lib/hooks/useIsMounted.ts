"use client";

import { useEffect, useState } from "react";

/**
 * useIsMounted
 * ------------
 * Returns `true` only after the component has mounted in the browser.
 *
 * Used as a hydration gate: render a server-safe placeholder on the first
 * (SSR + initial client) pass, then swap in browser-only content once
 * `mounted` flips to `true` in a post-mount effect. This avoids hydration
 * mismatches for anything that reads `window`, `document`, `localStorage`,
 * cookies, or color-scheme at render time (wagmi connectors, BorderBeam,
 * connect buttons, etc.).
 *
 * Consolidated here so every wallet/connect surface gates on one identical
 * implementation instead of copy-pasting the `useState` + `useEffect` dance.
 *
 * NOTE: This intentionally sets state inside an effect — it is the canonical
 * "sync with the external browser environment" pattern, NOT the derive-state
 * anti-pattern. Do not "fix" it by deriving during render.
 */
export function useIsMounted(): boolean {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	return mounted;
}
