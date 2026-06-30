"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

export function CopyButton({ text }: { text: string }) {
	const [state, setState] = useState<"idle" | "success" | "error">("idle");
	const prefersReducedMotion = useReducedMotion();

	const handleClick = useCallback(async () => {
		if (typeof navigator === "undefined" || !navigator.clipboard) {
			setState("error");
			setTimeout(() => setState("idle"), 1500);
			return;
		}
		try {
			await navigator.clipboard.writeText(text);
			setState("success");
		} catch {
			setState("error");
		}
		setTimeout(() => setState("idle"), 1500);
	}, [text]);

	const label =
		state === "success" ? "copied" : state === "error" ? "failed" : "copy";
	// WCAG 2.5.3: the accessible name (aria-label) must START with the visible label
	// so voice-control users ("click copy") and screen-reader users agree on the name.
	const ariaLabel =
		state === "success"
			? "Copied to clipboard"
			: state === "error"
				? "Failed to copy; try again"
				: "Copy snippet to clipboard";
	const colorClass =
		state === "success"
			? "text-success"
			: state === "error"
				? "text-error"
				: "text-text-muted";

	const Icon =
		state === "success" ? Check : state === "error" ? AlertCircle : Copy;

	return (
		<m.button
			type="button"
			aria-label={ariaLabel}
			onClick={handleClick}
			whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
			animate={
				prefersReducedMotion
					? undefined
					: state === "success"
						? { scale: [1, 1.12, 1] }
						: { scale: 1 }
			}
			transition={
				prefersReducedMotion
					? { duration: 0 }
					: { type: "spring", stiffness: 500, damping: 18, mass: 0.6 }
			}
			className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1.5 py-0.5 transition-colors ${
				state === "success" ? "glow-accent-sm" : ""
			} ${colorClass}`}
		>
			<span className="sr-only">{label}</span>
			<span aria-hidden="true" className="inline-flex items-center gap-1">
				<AnimatePresence mode="wait" initial={false}>
					<m.span
						key={state}
						initial={
							prefersReducedMotion
								? false
								: { opacity: 0, scale: 0.5, rotate: -30 }
						}
						animate={{ opacity: 1, scale: 1, rotate: 0 }}
						exit={
							prefersReducedMotion
								? { opacity: 0 }
								: { opacity: 0, scale: 0.5, rotate: 30 }
						}
						transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
						className="inline-flex"
					>
						<Icon className="h-3 w-3" strokeWidth={2.25} />
					</m.span>
				</AnimatePresence>
				<span>{label}</span>
			</span>
		</m.button>
	);
}
