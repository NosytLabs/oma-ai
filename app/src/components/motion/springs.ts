"use client";

/**
 * Kinetics spring curves — copy-pasted from kinetics.colorion.co and
 * tuned for OMA's UI. Two-number springs (stiffness/damping) instead
 * of fixed-duration easings so they integrate from interrupted
 * positions without snapping.
 *
 * Use these in framer-motion's `transition` block:
 *   <motion.div transition={spring("card")} />
 *
 * `MotionConfig reducedMotion="user"` in motion-provider.tsx already
 * no-ops these for users with prefers-reduced-motion: reduce.
 */
export type SpringName = "card" | "counter" | "tab" | "toast" | "magnet";

export const springs: Record<SpringName, { type: "spring"; stiffness: number; damping: number; mass?: number }> = {
	// spring(320, 24) — Card Resize. Height/width transitions that overshoot
	// then settle. Critically-damped feel with a tiny bounce.
	card: { type: "spring", stiffness: 320, damping: 24, mass: 1.0 },
	// spring(280, 18) — Elastic Counter. Digit bumps with a slightly
	// softer return for the small visual element.
	counter: { type: "spring", stiffness: 280, damping: 18, mass: 1.0 },
	// glide(0.4s, custom) — Tab Pill. Indicator slides between tabs
	// measuring target width; slightly stiffer so it doesn't lag taps.
	tab: { type: "spring", stiffness: 380, damping: 30, mass: 0.9 },
	// overshoot(1.08) — Toast. Slides past rest position then settles.
	toast: { type: "spring", stiffness: 260, damping: 16, mass: 1.0 },
	// magnetic button — fast follow, instant reset
	magnet: { type: "spring", stiffness: 400, damping: 28, mass: 0.6 },
};

/**
 * One-shot CSS cubic-bezier approximations for cases where you can't
 * use framer-motion (raw CSS, third-party components). These mirror
 * the most common kinetics presets.
 */
export const easings = {
	spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
	springTight: "cubic-bezier(0.34, 1.4, 0.64, 1)",
	springSoft: "cubic-bezier(0.18, 1.25, 0.4, 1)",
	easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export function spring(name: SpringName) {
	return springs[name];
}
