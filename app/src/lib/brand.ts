/**
	* Brand color constants for OMA.
	*
	* These MUST be kept in sync with the CSS custom properties in `globals.css`:
	*   --color-void:    oklch(0.155 0.012 168)
	*   --color-accent:  oklch(0.780 0.125 84)
	*
	* Use these in places where CSS variables can't reach (Next.js `ImageResponse`,
	* static `manifest.json`, PWA `theme_color`, HTML `<meta>` tags, generated SVGs).
	*
	* If the brand color changes, update BOTH this file AND globals.css.
	*/

export const BRAND_COLORS = {
	/** Deep ink-green background. Matches `--color-void`. */
	void: "#0d1512",
	/** Elevated panel / card surface. Matches `--color-panel`. */
	panel: "#141d19",
	/** Primary accent (brass). Matches `--color-accent`. */
	accent: "#dfa63c",
	/** Hover / glow accent. Matches `--color-accent-bright`. */
	accentBright: "#eebd55",
	/** Headlines. Matches `--color-text-bright`. */
	textBright: "#ede9db",
	/** Body text. Matches `--color-text`. */
	text: "#dcd8c9",
	/** Meta / captions. Matches `--color-text-muted`. */
	textMuted: "#a8ad9d",
} as const;