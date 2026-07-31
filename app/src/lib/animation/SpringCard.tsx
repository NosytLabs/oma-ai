"use client";

import { m, AnimatePresence } from "@/lib/framer-motion-client";
import { useState, type ReactNode } from "react";
import { springs } from "./springs";

/**
 * SpringCard — height transitions with no JS layout thrash.
 *
 * Kinetics ref: spring(320, 24). Uses grid-template-rows trick (1fr /
 * 0fr) so the inner content collapses without measuring height in JS.
 * AnimatePresence handles the in/out swap with the spring config from
 * ./springs (so prefers-reduced-motion no-ops via MotionProvider).
 */
export function SpringCard({
	title,
	children,
	defaultOpen = false,
}: {
	title: ReactNode;
	children: ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div className="rounded-lg border border-border/40 bg-card/40 overflow-hidden">
			<m.button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between px-4 py-3 text-left font-medium hover:bg-accent/30"
				whileTap={{ scale: 0.97 }}
				transition={{ type: "spring", stiffness: 400, damping: 28 }}
			>
				<span>{title}</span>
				<m.span
					aria-hidden
					className="text-muted-foreground"
					animate={{ rotate: open ? 180 : 0 }}
					transition={springs.card}
					style={{ display: "inline-block", willChange: "transform" }}
				>
					▾
				</m.span>
			</m.button>
			{/* Grid trick: animate grid-template-rows between 0fr (collapsed)
			    and 1fr (full). Browser handles the layout — no JS measurement. */}
			<m.div
				initial={false}
				animate={{ gridTemplateRows: open ? "1fr" : "0fr" }}
				transition={springs.card}
				style={{ display: "grid" }}
			>
				<div style={{ overflow: "hidden", minHeight: 0 }}>
					<AnimatePresence initial={false}>
						{open && (
							<m.div
								key="content"
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="px-4 py-3 text-sm text-muted-foreground"
							>
								{children}
							</m.div>
						)}
					</AnimatePresence>
				</div>
			</m.div>
		</div>
	);
}
