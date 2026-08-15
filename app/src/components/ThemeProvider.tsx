"use client";

/**
	* ThemeProvider — 4 accent themes on a locked dark void.
	*
	* emerald — default OMA brand (terminal emerald)
	* amber — warm CRT / mainframe
	* mono — grayscale austere
	* synth — violet network-op
	*
	* Persistence: localStorage `oma-theme`
	* DOM: `data-theme` on <html> (emerald removes attribute so :root wins)
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

export type Theme = "emerald" | "amber" | "mono" | "synth";

/** Canonical accent hex per theme — keep in sync with globals.css */
export const THEME_ACCENTS: Readonly<Record<Theme, string>> = {
	emerald: "#46d39a",
	amber: "#f0b429",
	mono: "#e8e8e6",
	synth: "#a78bfa",
};

export const THEME_LIST: ReadonlyArray<{
	id: Theme;
	name: string;
	hint: string;
}> = [
	{ id: "emerald", name: "Emerald", hint: "default · brand" },
	{ id: "amber", name: "Amber", hint: "retro · CRT" },
	{ id: "mono", name: "Mono", hint: "grayscale · austere" },
	{ id: "synth", name: "Synth", hint: "violet · network" },
];

const STORAGE_KEY = "oma-theme";
const DEFAULT_THEME: Theme = "emerald";

function isValidTheme(value: string | null): value is Theme {
	return (
		value === "emerald" ||
		value === "amber" ||
		value === "mono" ||
		value === "synth"
	);
}

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
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute("content", BRAND_COLORS.void);
	}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

	useEffect(() => {
		const current = readStoredTheme();
		setThemeState(current);
		applyTheme(current);
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
