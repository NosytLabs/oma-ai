/**
 * Brand color constants for OMA.
 *
 * These MUST be kept in sync with the CSS custom properties in `globals.css`:
 *   --color-void:    #07090a
 *   --color-accent:  #46d39a
 *
 * Use these in places where CSS variables can't reach (Next.js `ImageResponse`,
 * static `manifest.json`, PWA `theme_color`, HTML `<meta>` tags, generated SVGs).
 *
 * If the brand color changes, update BOTH this file AND globals.css.
 */

export const BRAND_COLORS = {
	/** Deep near-black background. Matches `--color-void`. */
	void: "#07090a",
	/** Elevated panel / card surface. Matches `--color-panel`. */
	panel: "#0d1110",
	/** Primary accent (emerald). Matches `--color-accent`. */
	accent: "#46d39a",
	/** Hover / glow accent. Matches `--color-accent-bright`. */
	accentBright: "#6ee7b7",
	/** Headlines. Matches `--color-text-bright`. */
	textBright: "#f5f7f3",
	/** Body text. Matches `--color-text`. */
	text: "#d8dcd6",
	/** Meta / captions. Matches `--color-text-muted`. */
	textMuted: "#9aa394",
} as const;

export type BrandColor = (typeof BRAND_COLORS)[keyof typeof BRAND_COLORS];