"use client";

/**
 * Magnetic — element follows the cursor with a spring, snapping back on
 * leave. Kinetics ref: magnet.
 *
 * Framer-free implementation using a native rAF-driven transform toward the
 * cursor target (eased), so no framer-motion runtime is pulled into the
 * bundle. Honors prefers-reduced-motion (static span), does not capture
 * pointer events, and cleans up listeners on unmount.
 *
 * The wrap is `display: inline-block` and does not capture pointer events —
 * the child stays clickable.
 */

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface MagneticProps {
	children: ReactNode;
	className?: string;
	/** max px displacement (default 12) */
	strength?: number;
}

export function Magnetic({ children, className, strength = 12 }: MagneticProps) {
	const ref = useRef<HTMLSpanElement>(null);
	const [reduced, setReduced] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mq.matches);
		const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	useEffect(() => {
		if (reduced) return;
		const el = ref.current;
		if (!el) return;

		// Current animated position.
		let cx = 0;
		let cy = 0;
		// Target from the cursor.
		let tx = 0;
		let ty = 0;
		let raf = 0;
		let active = false;

		const ease = 0.16; // spring-ish follow; interruptible.

		const step = () => {
			cx += (tx - cx) * ease;
			cy += (ty - cy) * ease;
			if (Math.abs(tx - cx) < 0.05 && Math.abs(ty - cy) < 0.05) {
				cx = tx;
				cy = ty;
				active = false;
				raf = 0;
			} else {
				raf = requestAnimationFrame(step);
			}
			el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
		};

		const handleMove = (e: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			const relX = e.clientX - (rect.left + rect.width / 2);
			const relY = e.clientY - (rect.top + rect.height / 2);
			const nx = (relX / Math.max(rect.width, 1)) * strength;
			const ny = (relY / Math.max(rect.height, 1)) * strength;
			tx = nx;
			ty = ny;
			if (!active) {
				active = true;
				raf = requestAnimationFrame(step);
			}
		};
		const handleLeave = () => {
			tx = 0;
			ty = 0;
			if (!active) {
				active = true;
				raf = requestAnimationFrame(step);
			}
		};

		el.addEventListener("mousemove", handleMove);
		el.addEventListener("mouseleave", handleLeave);
		return () => {
			el.removeEventListener("mousemove", handleMove);
			el.removeEventListener("mouseleave", handleLeave);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [reduced, strength]);

	if (reduced) {
		return <span className={className}>{children}</span>;
	}

	return (
		<span
			ref={ref}
			className={`inline-block ${className ?? ""}`}
			style={{ willChange: "transform" }}
		>
			{children}
		</span>
	);
}
