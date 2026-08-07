"use client";

/**
 * PulseLines — Originkit-inspired animated grid background for React.
 *
 * Renders a static grid of low-opacity vertical lines with a bright accent
 * pulse that sweeps horizontally across the container. The pulse is a
 * GPU-composited linear-gradient mask animated with CSS, so the cost is
 * one transform per frame regardless of grid density.
 *
 * API mirrors the public Originkit component (subset):
 * - color: base line + sweep color (default --color-accent)
 * - gap: px between lines (default 36)
 * - speed: seconds per sweep (default 7)
 * - lineOpacity: base line opacity 0-1 (default 0.08)
 * - sweepOpacity: pulse peak opacity 0-1 (default 0.45)
 * - vertical: when false, lines run horizontally (default true)
 * - className: pass-through
 *
 * When `prefers-reduced-motion: reduce` is set, the sweep animation is
 * suppressed and only the static grid is shown (lower opacity for calm).
 */

import { useReducedMotion } from "@/lib/framer-motion-client";
import type { CSSProperties } from "react";

interface PulseLinesProps {
	color?: string;
	gap?: number;
	speed?: number;
	lineOpacity?: number;
	sweepOpacity?: number;
	vertical?: boolean;
	className?: string;
	style?: CSSProperties;
}

export function PulseLines({
	color = "var(--color-accent)",
	gap = 36,
	speed = 7,
	lineOpacity = 0.08,
	sweepOpacity = 0.45,
	vertical = true,
	className,
	style,
}: PulseLinesProps) {
	const prefersReduced = useReducedMotion();

	// CSS variables consumed by the .pulse-lines-bg keyframes. React's
	// CSSProperties type accepts `--*` custom properties, so no directive
	// suppression is needed. Names are prefixed to avoid clashing with
	// globals.css tokens.
	const baseStyle: CSSProperties = {
		["--pl-color" as string]: color,
		["--pl-gap" as string]: `${gap}px`,
		["--pl-speed" as string]: `${speed}s`,
		["--pl-line-opacity" as string]: String(lineOpacity),
		["--pl-sweep-opacity" as string]: String(sweepOpacity),
		["--pl-axis" as string]: vertical ? "to right" : "to bottom",
		["--pl-sweep-axis" as string]: vertical ? "110deg" : "200deg",
		position: "absolute",
		inset: 0,
		pointerEvents: "none",
		zIndex: 0,
		...style,
	};

	if (prefersReduced) {
		// Static grid, no sweep — calmer fallback.
		return (
			<div
				aria-hidden="true"
				className={`pulse-lines-bg pulse-lines-bg--static ${className ?? ""}`}
				style={{ ...baseStyle, opacity: 0.5 }}
			/>
		);
	}

	return (
		<div
			aria-hidden="true"
			className={`pulse-lines-bg ${className ?? ""}`}
			style={baseStyle}
		/>
	);
}