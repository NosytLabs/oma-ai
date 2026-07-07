"use client";

/**
 * ThemeProvider — 4 distinct themes (dark by default).
 *
 * Provides a `useTheme()` hook and persists the user's choice to localStorage.
 * The companion inline `<script>` in `app/src/app/layout.tsx` (see HeadScript)
 * handles the synchronous, pre-hydration `data-theme` attribute set so we
 * never get a flash of the wrong theme on first paint.
 *
 * Themes:
 *   - "emerald"  — default, terminal-emerald accent on graphite (current OMA palette)
 *   - "amber"    — warm CRT amber accent on deep navy (retro mainframe)
 *   - "mono"     — pure grayscale, no accent (engineering austere)
 *   - "synth"    — cyber violet on near-black (synthwave / network op)
 *
 * Design constraints:
 *   - No system preference detection (OMA is dark-by-default).
 *   - "emerald" is the default for fresh users / cleared storage.
 *   - Setting is persisted under localStorage key `oma-theme`.
 *   - `data-theme="<name>"` is set on `<html>`. The default "emerald" sets nothing
 *     (so base palette wins). Other themes set their own attribute.
 */

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type Theme = "emerald" | "amber" | "mono" | "synth";

export const THEME_LIST: ReadonlyArray<{ id: Theme; name: string; hint: string }> =
	[
		{ id: "emerald", name: "Emerald", hint: "default · terminal" },
		{ id: "amber", name: "Amber", hint: "retro · CRT" },
		{ id: "mono", name: "Mono", hint: "grayscale · austere" },
		{ id: "synth", name: "Synth", hint: "violet · network op" },
	];

const STORAGE_KEY = "oma-theme";
const DEFAULT_THEME: Theme = "emerald";

function isValidTheme(value: string | null): value is Theme {
	return value === "emerald" || value === "amber" || value === "mono" || value === "synth";
}

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(): Theme {
	if (typeof window === "undefined") return DEFAULT_THEME;
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (isValidTheme(stored)) return stored;
	} catch {
		// localStorage can throw in private mode / sandboxed iframes — fall through
	}
	return DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
	if (typeof document === "undefined") return;
	if (theme === DEFAULT_THEME) {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", theme);
	}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	// Start as default on both server and client first render so SSR markup is stable.
	const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

	// On mount, reconcile React state with whatever the inline script applied.
	useEffect(() => {
		const current = readStoredTheme();
		setThemeState(current);
	}, []);

	const setTheme = useCallback((next: Theme) => {
		setThemeState(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// best-effort persistence
		}
		applyTheme(next);
	}, []);

	const cycleTheme = useCallback(() => {
		setThemeState((prev) => {
			const idx = THEME_LIST.findIndex((t) => t.id === prev);
			const next = THEME_LIST[(idx + 1) % THEME_LIST.length]?.id ?? DEFAULT_THEME;
			try {
				window.localStorage.setItem(STORAGE_KEY, next);
			} catch {
				// best-effort
			}
			applyTheme(next);
			return next;
		});
	}, []);

	const value = useMemo<ThemeContextValue>(
		() => ({ theme, setTheme, cycleTheme }),
		[theme, setTheme, cycleTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) {
		throw new Error("useTheme must be used within a <ThemeProvider>");
	}
	return ctx;
}

/**
 * HeadScript — exported as a raw HTML string for use inside `<head>`.
 *
 * Runs synchronously BEFORE React hydrates, so it can set
 * `<html data-theme="...">` before the first paint. Without it, non-default
 * theme users would see a flash of the default theme on every page load (FOUC).
 */
export const THEME_HEAD_SCRIPT = `(function(){try{var t=localStorage.getItem('oma-theme');if(t==='emerald'||t==='amber'||t==='mono'||t==='synth'){if(t==='emerald'){document.documentElement.removeAttribute('data-theme');}else{document.documentElement.setAttribute('data-theme',t);}}}catch(e){}})();`;