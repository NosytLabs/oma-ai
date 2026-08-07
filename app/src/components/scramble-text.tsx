"use client";

/**
 * ScrambleText — Originkit-inspired scramble reveal for React.
 *
 * Cycles each character through a glyph set until the source string is
 * fully resolved. Triggerable on mount, on viewport entry, or on hover.
 * Honors `prefers-reduced-motion` — when set, renders the final text immediately.
 *
 * API mirrors the public Originkit component (subset):
 * - text: string to reveal
 * - duration: ms for the full resolve (default 900)
 * - trigger: "mount" | "viewport" | "hover"
 * - as: element tag (default "span")
 * - glyphs: override the glitch character set
 * - className: pass-through
 *
 * Implementation notes:
 * - requestAnimationFrame-driven; cancels on unmount.
 * - Resolved characters lock in place so the final frame matches `text` byte-for-byte.
 * - Spaces and unmaskable chars (`text[i] === " "`) skip the swap.
 * - Per-frame output is written straight to `textContent` via a ref —
 * NOT React state. The previous setState-per-frame version re-rendered
 * ~54× per instance on the hero/LCP headline.
 */

import {
	m,
	useReducedMotion,
} from "@/lib/framer-motion-client";
import { useRevealInView } from "@/lib/use-reveal-in-view";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ElementType,
} from "react";

const DEFAULT_GLYPHS =
	"!<>-_/[]{}—=+*^?#01┌┐└┘├┤┬┴┼─│┄┆┈┉▀▁▂▃▄▅▆▇█▉▊▋▌▍▎▏▐░▒▓";

interface ScrambleTextProps {
	text: string;
	className?: string;
	duration?: number;
	trigger?: "mount" | "viewport" | "hover";
	as?: ElementType;
	glyphs?: string;
	delay?: number;
}

function pickGlyph(glyphs: string): string {
	return glyphs[Math.floor(Math.random() * glyphs.length)];
}

export function ScrambleText({
	text,
	className,
	duration = 900,
	trigger = "mount",
	as: Tag = "span",
	glyphs = DEFAULT_GLYPHS,
	delay = 0,
}: ScrambleTextProps) {
	const prefersReduced = useReducedMotion();
	const [shouldRun, setShouldRun] = useState(trigger === "mount");
	const nodeRef = useRef<HTMLElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const frameRef = useRef<number>(0);
	const firedRef = useRef<boolean>(trigger === "mount");

	// Viewport reveal hook (no-op when trigger !== "viewport")
	const { ref, show } = useRevealInView({
		amount: 0.2,
		once: true,
	});

	useEffect(() => {
		if (trigger === "viewport" && show && !firedRef.current) {
			firedRef.current = true;
			setShouldRun(true);
		}
	}, [trigger, show]);

	const scramble = useCallback(() => {
		const node = nodeRef.current;
		if (prefersReduced || !node) {
			if (node) node.textContent = text;
			return;
		}
		const start = performance.now() + delay;
		const tick = (now: number) => {
			const elapsed = now - start;
			if (elapsed < 0) {
				rafRef.current = requestAnimationFrame(tick);
				return;
			}
			frameRef.current += 1;
			const progress = Math.min(elapsed / duration, 1);
			// Settled character count grows monotonically; small jitter on the
			// last character for a satisfying "click into place" feel.
			const jitter = frameRef.current % 3 === 0 ? 0 : -1;
			const settled = Math.max(
				0,
				Math.floor(text.length * progress) + jitter,
			);
			let out = "";
			for (let i = 0; i < text.length; i++) {
				const ch = text[i];
				if (ch === " " || ch === "\n" || ch === "\t") {
					out += ch;
				} else if (i < settled) {
					out += ch;
				} else {
					out += pickGlyph(glyphs);
				}
			}
			// Direct DOM write — zero React re-renders during the animation.
			node.textContent = progress < 1 ? out : text;
			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick);
			}
		};
		rafRef.current = requestAnimationFrame(tick);
	}, [text, duration, glyphs, delay, prefersReduced]);

	useEffect(() => {
		if (!shouldRun) return;
		scramble();
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [shouldRun, scramble]);

	const handleMouseEnter = useCallback(() => {
		if (trigger !== "hover") return;
		setShouldRun(true);
	}, [trigger]);

	// Use m.span to stay LazyMotion-friendly (matches the existing
	// lib/motion.tsx conventions); fall back to plain Tag if needed.
	const Component = Tag as typeof m.span;

	// Attach both the DOM node (for textContent writes) and, when the trigger
	// is viewport-based, the reveal hook's ref.
	const setRefs = useCallback(
		(el: HTMLElement | null) => {
			nodeRef.current = el;
			if (trigger === "viewport" && typeof ref === "function") {
				(ref as (el: HTMLElement | null) => void)(el);
			} else if (trigger === "viewport" && ref && "current" in ref) {
				(ref as React.MutableRefObject<HTMLElement | null>).current = el;
			}
		},
		[trigger, ref],
	);

	if (prefersReduced) {
		return <Tag className={className}>{text}</Tag>;
	}

	return (
		<Component
			ref={setRefs as never}
			className={className}
			onMouseEnter={handleMouseEnter}
			aria-label={text}
		>
			{text}
		</Component>
	);
}