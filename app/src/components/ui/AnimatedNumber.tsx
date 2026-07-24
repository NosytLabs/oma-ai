"use client";

import {
	animate,
	m,
	motionValue,
	useReducedMotion,
	useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({
	value,
	prefix = "$",
}: {
	value: number;
	prefix?: string;
}) {
	const prefersReducedMotion = useReducedMotion();
	// Start at the real value so first paint never shows $0.00 → mid-tween
	// garbage (e.g. $44.40 while settling on $50.00).
	const [count] = useState(() => motionValue(value));
	const prev = useRef(value);
	const display = useTransform(count, (latest) => {
		return `${prefix}${latest.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})}`;
	});

	useEffect(() => {
		if (prefersReducedMotion || prev.current === value) {
			count.set(value);
			prev.current = value;
			return;
		}
		const controls = animate(count, value, {
			type: "spring",
			stiffness: 120,
			damping: 24,
			mass: 0.9,
			restSpeed: 0.5,
		});
		prev.current = value;
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
