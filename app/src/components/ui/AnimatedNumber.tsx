"use client";

import {
	animate,
	m,
	motionValue,
	useReducedMotion,
	useTransform,
} from "framer-motion";
import { useEffect, useRef } from "react";

export function AnimatedNumber({
	value,
	prefix = "$",
}: {
	value: number;
	prefix?: string;
}) {
	const prefersReducedMotion = useReducedMotion();
	const count = useRef(motionValue(0));
	const display = useTransform(count.current, (latest) => {
		return `${prefix}${latest.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})}`;
	});

	useEffect(() => {
		if (prefersReducedMotion) {
			count.current.set(value);
			return;
		}
		const controls = animate(count.current, value, {
			type: "spring",
			stiffness: 120,
			damping: 24,
			mass: 0.9,
			restSpeed: 0.5,
		});
		return () => controls.stop();
	}, [value, prefersReducedMotion]);

	return (
		<m.span
			initial={
				prefersReducedMotion
					? { opacity: 1, scale: 1 }
					: { opacity: 0, scale: 0.92 }
			}
			animate={
				prefersReducedMotion
					? { opacity: 1, scale: 1 }
					: { opacity: 1, scale: 1 }
			}
			transition={
				prefersReducedMotion
					? { duration: 0 }
					: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
			}
		>
			{display}
		</m.span>
	);
}
