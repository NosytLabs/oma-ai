"use client";

/**
 * FloatingIcons — Originkit-inspired floating currency symbols background.
 *
 * Renders a scatter of semi-transparent crypto/currency symbols that drift
 * slowly upward with a subtle wobble. Uses CSS transform animations for GPU
 * compositing — zero JS animation cost after mount.
 *
 * Each icon gets a random position, size, and speed via inline CSS custom
 * properties. The `count` prop controls density. Respects reduced-motion.
 *
 * API:
 *   - count:       number of floating symbols (default 8)
 *   - opacity:     base opacity 0-1 (default 0.07)
 *   - symbols:     string[] of chars to scatter (default crypto-themed)
 *   - speed:       base drift seconds (default 18)
 *   - className:   pass-through
 */

import { useReducedMotion } from "@/lib/framer-motion-client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const DEFAULT_SYMBOLS = ["✦", "⬡", "◈", "⟐", "◉", "⊕", "◇", "△", "₿", "Ξ", "◎"];

interface FloatingIconsProps {
	count?: number;
	opacity?: number;
	symbols?: string[];
	speed?: number;
	className?: string;
}

export function FloatingIcons({
	count = 8,
	opacity = 0.07,
	symbols = DEFAULT_SYMBOLS,
	speed = 18,
	className,
}: FloatingIconsProps) {
	const prefersReduced = useReducedMotion();
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	// Generate deterministic-but-distinct seeds per icon
	const items = Array.from({ length: count }, (_, i) => {
		const sym = symbols[i % symbols.length];
		const seed = (i * 137.5 + 42) % 360;
		const x = ((i * 31 + 7) % 100);
		const y = ((i * 17 + 13) % 100);
		const sz = 16 + (i % 3) * 8;
		const spd = speed + (i % 4) * 4;
		const delay = (i * 1.7) % 6;
		const wobble = 4 + (i % 3) * 2;
		return { sym, seed, x, y, sz, spd, delay, wobble };
	});

	// CRITICAL: render only on the client. The container itself is fine on the
	// server, but the floating icons carry pure-decoration Math.random-free
	// coordinates that still mismatch the SSR snapshot because of how
	// `useReducedMotion` resolves differently between SSR (null) and the
	// browser (boolean). Rendering an empty placeholder on the server and
	// populating on `useEffect` avoids the hydration mismatch entirely.
	return (
		<div
			aria-hidden="true"
			className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
		>
			{isClient &&
				items.map((item, i) => {
					const style: CSSProperties = {
						position: "absolute",
						left: `${item.x}%`,
						top: `${item.y}%`,
						fontSize: `${item.sz}px`,
						opacity,
						color: "var(--color-accent)",
						["--float-wobble" as string]: `${item.wobble}px`,
						transform: `rotate(${item.seed}deg)`,
						...(prefersReduced
							? {}
							: {
									animation: `float-icon ${item.spd}s ease-in-out ${item.delay}s infinite`,
									willChange: "transform" as const,
								}),
					};
					return (
						<span key={i} style={style}>
							{item.sym}
						</span>
					);
				})}
		</div>
	);
}
