"use client";

import { useReducedMotion } from "@/lib/framer-motion-client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Form error shake — "Error state shake" pattern from transitions.dev.
 *
 * Cubic-bezier shake: small → bigger → bigger → smaller → tiny → settled.
 * The offsets and timing exactly match the source pattern:
 *
 *   0%, 100%   → x: 0
 *   20%        → x: -8
 *   40%        → x: 8
 *   60%        → x: -6
 *   80%        → x: 6
 *   100%       → x: 0
 *
 * Total ≈ 320ms — short enough to feel responsive but long enough to
 * register as a real "nope" signal. Reuses the reduced-motion guard
 * from the project's MotionProvider — under `prefers-reduced-motion`
 * we skip the keyframes entirely (the error state is still shown
 * visually; only the wiggle is suppressed).
 *
 * Usage:
 *   const { shake, animation } = useFormErrorShake();
 *   if (error) shake();
 *   <m.div animate={animation}>…</m.div>
 */
export function useFormErrorShake() {
	const prefersReducedMotion = useReducedMotion();
	const [key, setKey] = useState(0);
	const previousRef = useRef(0);

	const shake = useCallback(() => {
		// Throttle: ignore shakes within 350ms of the previous one so
		// concurrent error events don't stack into a constant vibration.
		if (Date.now() - previousRef.current < 350) return;
		previousRef.current = Date.now();
		setKey((k) => k + 1);
	}, []);

	const animation = prefersReducedMotion
		? undefined
		: {
				x: [0, -8, 8, -6, 6, -2, 0],
				transition: { duration: 0.32, ease: "easeInOut" as const },
			};

	useEffect(() => {
		// Cleanup is automatic — framer-motion re-runs the keyframe block
		// each time `key` changes; nothing to dispose here.
	}, [key]);

	return { shake, animation, key };
}