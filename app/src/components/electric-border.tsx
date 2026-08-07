"use client";

/**
 * ElectricBorder — Originkit-inspired animated gradient border.
 *
 * Wraps children in a container with a running-light conic-gradient border.
 * Uses two nested divs (border layer + content layer) for reliable cross-
 * browser support without pseudo-element hacks.
 *
 * Use sparingly to draw attention to a single primary element (CTA button,
 * featured card, etc.). Respects reduced-motion.
 *
 * API:
 * - active: animate when true, static when false (default true)
 * - borderRadius: CSS border-radius (default "0.75rem")
 * - borderWidth: px (default 1)
 * - color: accent color (default var(--color-accent))
 * - children
 * - className: pass-through
 * - style: pass-through
 */

import { useReducedMotion } from "@/lib/framer-motion-client";
import type { CSSProperties, ReactNode } from "react";

interface ElectricBorderProps {
	active?: boolean;
	borderRadius?: string;
	borderWidth?: number;
	color?: string;
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
}

export function ElectricBorder({
	active = true,
	borderRadius = "var(--radius-lg)",
	borderWidth = 1,
	color = "var(--color-accent)",
	children,
	className,
	style,
}: ElectricBorderProps) {
	const prefersReduced = useReducedMotion();
	const shouldAnimate = active && !prefersReduced;

	return (
		<div
			className={className}
			style={{
				position: "relative",
				display: "inline-flex",
				borderRadius,
				overflow: "hidden",
				transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
				...style,
			}}
		>
			{/* Border animation layer — sits behind content */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: shouldAnimate ? `-${borderWidth * 3}px` : 0,
					borderRadius: `calc(${borderRadius} + ${borderWidth}px)`,
					background: shouldAnimate
						? `conic-gradient(from var(--eb-angle, 0deg), ${color} 0deg, transparent 50deg, transparent 310deg, ${color} 360deg)`
						: "var(--color-border)",
					animation: shouldAnimate
						? "electric-spin 3s linear infinite"
						: "none",
					zIndex: 0,
				}}
			/>
			{/* Inner mask — punches hole so only the border ring shows */}
			<div
				style={{
					position: "absolute",
					inset: `${borderWidth}px`,
					borderRadius: `calc(${borderRadius} - ${borderWidth}px)`,
					background: "var(--color-panel, var(--color-surface-elevated))",
					zIndex: 1,
				}}
			/>
			{/* Content layer */}
			<div
				style={{
					position: "relative",
					zIndex: 2,
					borderRadius,
				}}
			>
				{children}
			</div>
		</div>
	);
}
