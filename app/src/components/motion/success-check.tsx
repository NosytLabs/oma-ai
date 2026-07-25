"use client";

import { m, useReducedMotion } from "@/lib/framer-motion-client";
import { useEffect, useState } from "react";

/**
 * Success check — "Success check" pattern from transitions.dev.
 *
 * The check draws on with a stroke path animation, with a small blur +
 * rotate snap on entry so it feels physical rather than inert.
 *
 *   - Circle: scale 0 → 1 with spring, settles with overshoot
 *   - Stroke: dashoffset 1 → 0 to "draw" the check on
 *   - Wrapper: 8° rotation entrance that settles to 0
 *
 * Reduced-motion: scale/rotate disabled, but the static check still
 * draws in (just no entrance wobble).
 */

const SPRING = {
	type: "spring" as const,
	stiffness: 380,
	damping: 24,
	mass: 0.7,
};

const STROKE_DURATION = 0.35;
const STROKE_DELAY = 0.18;

interface SuccessCheckProps {
	/** Inline size in pixels. Default 24. */
	size?: number;
	className?: string;
	/** Accessible label for the check icon. Default "Success". */
	label?: string;
}

export function SuccessCheck({
	size = 24,
	className = "",
	label = "Success",
}: SuccessCheckProps) {
	const prefersReducedMotion = useReducedMotion();
	// Mount-only flag — we don't want the entrance animation to re-fire
	// if the parent re-renders for unrelated reasons.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<m.div
			role="status"
			aria-label={label}
			initial={
				prefersReducedMotion
					? { opacity: 1, scale: 1, rotate: 0 }
					: { opacity: 0, scale: 0.4, rotate: 8 }
			}
			animate={
				mounted
					? { opacity: 1, scale: 1, rotate: 0 }
					: { opacity: 0, scale: 0.4, rotate: 8 }
			}
			transition={SPRING}
			className={`inline-flex ${className}`}
			style={{ width: size, height: size }}
		>
			<svg
				viewBox="0 0 24 24"
				width={size}
				height={size}
				fill="none"
				stroke="currentColor"
				strokeWidth="2.4"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<title>{label}</title>
				<m.circle
					cx="12"
					cy="12"
					r="11"
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					transition={{ ...SPRING }}
					style={{ transformOrigin: "12px 12px" }}
				/>
				<m.path
					d="M7 12l3 3 7-7"
					initial={{ pathLength: 0, opacity: 0 }}
					animate={{ pathLength: 1, opacity: 1 }}
					transition={{
						pathLength: {
							duration: prefersReducedMotion ? 0 : STROKE_DURATION,
							delay: STROKE_DELAY,
							ease: [0.65, 0, 0.35, 1],
						},
						opacity: {
							duration: 0.1,
							delay: STROKE_DELAY,
						},
					}}
					style={{ strokeDasharray: 24 }}
				/>
			</svg>
		</m.div>
	);
}