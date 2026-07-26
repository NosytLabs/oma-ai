"use client";

import {
	m,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "@/lib/framer-motion-client";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

/**
 * Magnetic — element follows the cursor with a spring, snapping back on
 * leave. Kinetics ref: magnet.
 *
 * This is the merged magnetic primitive (formerly duplicated as
 * `Magnetic` in `@/lib/motion` and `MagneticButton` here). This
 * implementation won because:
 *   - Real spring physics (useMotionValue + useSpring) — interruptible,
 *     GPU-composited, no fixed-duration snap.
 *   - Explicit `useReducedMotion` guard — renders a static span for
 *     users who opt out. (The old CSS-var version bypassed framer, so
 *     `MotionConfig reducedMotion="user"` could not no-op it.)
 *   - Listener cleanup on unmount.
 *
 * The wrap is `display: inline-block` and does not capture pointer
 * events — the child stays clickable.
 */

interface MagneticProps {
	children: ReactNode;
	className?: string;
	/** max px displacement (default 12) */
	strength?: number;
}

export function Magnetic({
	children,
	className,
	strength = 12,
}: MagneticProps) {
	const prefersReduced = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	// LazyMotion-friendly: use the `m` component for both the static span and
	// the inner motion-target so we don't need the full `motion` import.
	// We use plain DOM refs + framer-motion hooks here, which work in LazyMotion.
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
	const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

	useEffect(() => {
		if (prefersReduced) return;
		const el = ref.current;
		if (!el) return;

		const handleMove = (e: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			const relX = e.clientX - (rect.left + rect.width / 2);
			const relY = e.clientY - (rect.top + rect.height / 2);
			// Normalize to [-1, 1] and scale by strength.
			const nx = (relX / Math.max(rect.width, 1)) * strength;
			const ny = (relY / Math.max(rect.height, 1)) * strength;
			x.set(nx);
			y.set(ny);
		};
		const handleLeave = () => {
			x.set(0);
			y.set(0);
		};

		el.addEventListener("mousemove", handleMove);
		el.addEventListener("mouseleave", handleLeave);
		return () => {
			el.removeEventListener("mousemove", handleMove);
			el.removeEventListener("mouseleave", handleLeave);
		};
	}, [prefersReduced, strength, x, y]);

	if (prefersReduced) {
		return <span className={className}>{children}</span>;
	}

	return (
		<m.span
			ref={ref}
			className={`inline-block ${className ?? ""}`}
			style={{ x: sx, y: sy }}
			whileTap={{ scale: 0.97 }}
		>
			{children}
		</m.span>
	);
}
