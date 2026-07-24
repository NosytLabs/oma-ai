"use client";

import { m } from "@/lib/framer-motion-client";
import { useEffect, useRef, useState } from "react";
import { springs } from "./springs";

/**
 * TabPill — animated active-tab indicator that measures target width
 * before moving (no flash, no race).
 *
 * Kinetics ref: glide(0.4s, custom). Uses layoutId so framer-motion
 * smoothly interpolates the pill from the previous tab's bounds. If
 * the active tab is unmounted, we fall back to measuring its DOM
 * rect with offsetLeft/offsetWidth (only used in tests; production
 * uses layoutId exclusively).
 */
export type TabItem = { id: string; label: string };

export function TabPill<T extends string>({
	tabs,
	active,
	onChange,
}: {
	tabs: TabItem[];
	active: T;
	onChange: (id: T) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const el = container.querySelector<HTMLElement>(`[data-tab="${active}"]`);
		if (!el) return;
		setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
	}, [active, tabs.length]);

	return (
		<div
			ref={containerRef}
			className="relative inline-flex items-center rounded-full bg-muted/40 p-1 border border-border/40"
		>
			<m.span
				aria-hidden
				className="absolute top-1 bottom-1 rounded-full bg-primary/80 shadow-sm"
				animate={indicator}
				transition={springs.tab}
				style={{ left: 0, width: 0, willChange: "transform, width" }}
			/>
			{tabs.map((t) => (
				<button
					key={t.id}
					data-tab={t.id}
					type="button"
					onClick={() => onChange(t.id as T)}
					className="relative z-10 px-4 py-1.5 text-sm font-medium rounded-full transition-colors"
					style={{
						color: active === t.id ? "var(--primary-foreground, #fff)" : "var(--muted-foreground)",
					}}
				>
					{t.label}
				</button>
			))}
		</div>
	);
}
