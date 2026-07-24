"use client";

import { m } from "@/lib/framer-motion-client";
import type { ReactNode } from "react";

/**
 * MagneticButton — cursor pulls the button toward it inside a dead zone.
 *
 * Kinetics ref: magnet(0.35). Translate by 35% of pointer offset from
 * the button center; reset on leave. Uses transform-only (GPU) and a
 * short spring so it glides rather than snaps.
 *
 * Children must accept className/style for positioning. Wrap a `<button>`
 * or `<a>` and we forward the magnet transform onto it.
 */
export function MagneticButton({
	children,
	strength = 0.35,
	maxOffset = 60,
	className,
	asChild = false,
}: {
	children: ReactNode;
	strength?: number;
	maxOffset?: number;
	className?: string;
	asChild?: boolean;
}) {
	const handleMove = (e: React.MouseEvent<HTMLElement>) => {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const x = e.clientX - rect.left - rect.width / 2;
		const y = e.clientY - rect.top - rect.height / 2;
		const clamp = (n: number) => Math.max(-maxOffset, Math.min(maxOffset, n));
		target.style.setProperty("--magnet-x", `${clamp(x * strength)}px`);
		target.style.setProperty("--magnet-y", `${clamp(y * strength)}px`);
	};

	const handleLeave = (e: React.MouseEvent<HTMLElement>) => {
		const target = e.currentTarget as HTMLElement;
		target.style.setProperty("--magnet-x", "0px");
		target.style.setProperty("--magnet-y", "0px");
	};

	return (
		<m.span
			onMouseMove={handleMove}
			onMouseLeave={handleLeave}
			className={className}
			style={{
				display: "inline-block",
				transform: "translate(var(--magnet-x, 0), var(--magnet-y, 0))",
				transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
				willChange: "transform",
			}}
			whileTap={asChild ? undefined : { scale: 0.97 }}
			transition={{ type: "spring", stiffness: 400, damping: 28 }}
		>
			{children}
		</m.span>
	);
}
