"use client";

/**
 * JuiceButton — Originkit-inspired liquid-button hover effect.
 *
 * On hover, a radial-gradient "blob" follows the cursor across the button
 * surface, creating a liquid / jelly feel. The blob is a pure CSS radial
 * gradient positioned via CSS custom properties that update on mousemove.
 *
 * Wraps any clickable element (Link, button) with the juice effect.
 *
 * API:
 *   - children
 *   - className
 *   - color:      blob color (default var(--color-accent))
 *   - size:       blob size in px (default 120)
 *   - opacity:    blob opacity (default 0.12)
 */

import { useReducedMotion } from "@/lib/framer-motion-client";
import {
	useCallback,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";

interface JuiceButtonProps {
	children: ReactNode;
	className?: string;
	color?: string;
	size?: number;
	opacity?: number;
}

export function JuiceButton({
	children,
	className,
	color = "var(--color-accent)",
	size = 120,
	opacity = 0.12,
}: JuiceButtonProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ x: 50, y: 50 });
	const prefReduced = useReducedMotion();

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (prefReduced) return;
			const el = ref.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			setPos({
				x: ((e.clientX - rect.left) / rect.width) * 100,
				y: ((e.clientY - rect.top) / rect.height) * 100,
			});
		},
		[prefReduced],
	);

	const bgStyle: CSSProperties = prefReduced
		? {}
		: {
				background: `radial-gradient(circle ${size}px at ${pos.x}% ${pos.y}%, ${color} 0%, transparent 100%)`,
				opacity,
				transition: "background 0.08s ease-out",
		  };

	return (
		<div
			ref={ref}
			onMouseMove={handleMouseMove}
			className={`relative inline-flex overflow-hidden ${className ?? ""}`}
		>
			{/* Juice blob layer */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={bgStyle}
			/>
			{/* Content layer */}
			<div className="relative z-10">{children}</div>
		</div>
	);
}
