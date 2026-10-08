"use client";

/** Shared motion tokens and variants used across the app. */

import { springs } from "./springs";
import type { Variants } from "@/lib/framer-motion-client";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
// Reuse the canonical spring token across animation entry points.
export const EASE_SPRING = springs.tab;

export const blurIn: Variants = {
	hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
	show: {
		opacity: 1,
		y: 0,
		filter: "blur(0px)",
		transition: { duration: 0.7, ease: EASE_OUT },
	},
};
