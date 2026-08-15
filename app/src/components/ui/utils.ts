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