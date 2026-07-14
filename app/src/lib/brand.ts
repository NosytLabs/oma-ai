/**
 * Brand color constants for OMA.
 *
 * These MUST be kept in sync with the CSS custom properties in `globals.css`:
 *   --color-void:    #07090a
 *   --color-accent:  #46d39a
 *   --color-border-hi (panel): #1c2822
 *
 * Use these in places where CSS variables can't reach (Next.js `ImageResponse`,
 * static `manifest.json`, PWA `theme_color`, HTML `<meta>` tags, generated SVGs).
 *
 * If the brand color changes, update BOTH this file AND globals.css.
 */

export const BRAND_COLORS = {
	/** Deep near-black background. Matches `--color-void`. */
	void: "#07090a",
	/** Primary accent (acid green). Matches `--color-accent`. */
	accent: "#46d39a",
	/** Mid-dark panel/border. Matches the panel-hi token. */
	panel: "#1c2822",
} as const;

export type BrandColor = (typeof BRAND_COLORS)[keyof typeof BRAND_COLORS];