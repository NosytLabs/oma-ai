/**
 * Theme catalog — the single source of truth for the OMA accent themes.
 *
 * The id list lives here (rather than only inside ThemeProvider) because
 * THREE places need it:
 *  - ThemeProvider.isValidTheme()  — runtime validation + the picker UI.
 *  - layout.tsx's pre-paint inline script — applied before React hydrates so
 *    a stored non-default theme never flashes the emerald accent.
 *  - ThemeProvider's persistence helpers.
 *
 * Previously the ids were hardcoded twice (the inline `==='emerald'||...`
 * chain and the isValidTheme chain), so adding a theme to the picker without
 * updating the inline script silently dropped the visitor's choice on the
 * next full page load. Both consumers interpolate from the list below.
 *
 * `emerald` is the default and therefore stores NO `data-theme` attribute
 * (:root already carries the emerald accent).
 */

export type Theme = "emerald" | "amber" | "mono" | "synth";

/** Every theme id, in picker order. Single source of truth. */
export const THEME_IDS = ["emerald", "amber", "mono", "synth"] as const satisfies readonly Theme[];

/** The theme applied when nothing is stored — `:root`, no data-theme attr. */
export const DEFAULT_THEME: Theme = "emerald";

/** localStorage key shared by the inline script and ThemeProvider. */
export const THEME_STORAGE_KEY = "oma-theme";

export function isValidTheme(value: string | null): value is Theme {
	return value != null && (THEME_IDS as readonly string[]).includes(value);
}

/**
 * JS snippet (no ES features beyond what a pre-paint inline script needs)
 * that applies the persisted theme to <html> before first paint. Interpolated
 * from THEME_IDS / DEFAULT_THEME so it can never drift from the picker.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var d=document.documentElement;d.style.backgroundColor='#07090a';d.style.colorScheme='dark';var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(${JSON.stringify(THEME_IDS)}.indexOf(t)>-1){if(t==='${DEFAULT_THEME}'){d.removeAttribute('data-theme');}else{d.setAttribute('data-theme',t);}}}catch(e){}})();`;