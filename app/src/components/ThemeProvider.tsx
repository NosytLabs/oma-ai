"use client";

/**
	* ThemeProvider — one theme: "ledger" (The Numbered Account).
	*
	* The 4-theme accent picker was retired in the 2026-11 revamp; the
	* ink-green + brass palette in globals.css is the only theme. The
	* provider shape is unchanged so existing consumers keep working;
	* stored legacy theme ids fail isValidTheme and fall back to ledger.
	*
	* Persistence: localStorage `oma-theme`
	* DOM: `data-theme` on <html> (the default removes the attribute)
	* FOUC: layout.tsx inline script applies stored theme before paint
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

import { BRAND_COLORS } from "@/lib/brand";
import {
	DEFAULT_THEME,
	isValidTheme,
	THEME_STORAGE_KEY as STORAGE_KEY,
	type Theme,
} from "@/lib/themes";

export type { Theme } from "@/lib/themes";

/** Canonical accent hex per theme — keep in sync with globals.css */
export const THEME_ACCENTS: Readonly<Record<Theme, string>> = {
	ledger: "#dfa63c",
};

/** Browser chrome color for each accent, kept dark enough for readable icons. */
const THEME_CHROME: Readonly<Record<Theme, string>> = {
	ledger: "#0d1512",
};

export const THEME_LIST: ReadonlyArray<{
	id: Theme;
	name: string;
	hint: string;
}> = [
	{ id: "ledger", name: "Ledger", hint: "the numbered account" },
];

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	cycleTheme: () => void;
	accent: string;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(): Theme {
	if (typeof window === "undefined") return DEFAULT_THEME;
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (isValidTheme(stored)) return stored;
	} catch {
		// private mode / sandboxed — ignore
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
	// Keep browser chrome (mobile address bar) in sync
	const chromeColor = THEME_CHROME[theme] ?? BRAND_COLORS.void;
	document
		.querySelectorAll('meta[name="theme-color"]')
		.forEach((meta) => meta.setAttribute("content", chromeColor));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

	useEffect(() => {
		const current = readStoredTheme();
		setThemeState(current);
		applyTheme(current);
		const onStorage = (event: StorageEvent) => {
			if (event.key !== STORAGE_KEY) return;
			const next = isValidTheme(event.newValue) ? event.newValue : DEFAULT_THEME;
			setThemeState(next);
			applyTheme(next);
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	const setTheme = useCallback((next: Theme) => {
		setThemeState(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// best-effort
		}
		applyTheme(next);
	}, []);

	const cycleTheme = useCallback(() => {
		setThemeState((prev) => {
			const idx = THEME_LIST.findIndex((t) => t.id === prev);
			const next =
				THEME_LIST[(idx + 1) % THEME_LIST.length]?.id ?? DEFAULT_THEME;
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
		() => ({
			theme,
			setTheme,
			cycleTheme,
			accent: THEME_ACCENTS[theme],
		}),
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
