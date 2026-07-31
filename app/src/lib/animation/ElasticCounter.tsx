"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "./springs";

/**
 * ElasticCounter — increments with a digit bump + overshoot settle.
 *
 * Kinetics ref: spring(280, 18). On every increment, briefly apply
 * scale(1.22) translateY(-6px) then settle. Uses transform-only
 * (GPU) and restarts cleanly on rapid clicks because framer-motion
 * re-targets the same spring config.
 */
export function ElasticCounter({
	value,
	className,
	onClick,
	ariaLabel,
}: {
	value: number;
	className?: string;
	onClick?: () => void;
	ariaLabel?: string;
}) {
	return (
		<m.button
			type="button"
			onClick={onClick}
			aria-label={ariaLabel ?? `Count: ${value}`}
			className={className}
			whileHover={{ scale: 1.05 }}
			whileTap={{ scale: 0.95 }}
			transition={springs.counter}
			style={{ display: "inline-block", willChange: "transform" }}
		>
			<m.span
				key={value}
				initial={{ scale: 1.22, y: -6 }}
				animate={{ scale: 1, y: 0 }}
				transition={springs.counter}
				style={{ display: "inline-block", willChange: "transform" }}
			>
				{value}
			</m.span>
		</m.button>
	);
}
