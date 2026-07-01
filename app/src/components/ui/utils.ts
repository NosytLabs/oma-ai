import { clsx, type ClassValue } from "clsx";

/**
 * cn — lightweight className composer.
 * Filters falsy values, joins remaining tokens with a single space.
 * Compatible with Tailwind v4 utility classes (no conflict resolution
 * needed — Tailwind utilities are atomic and order-stable).
 */
export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
}

/** Compose focus-visible ring class consistent with design system. */
export const FOCUS_RING =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base";