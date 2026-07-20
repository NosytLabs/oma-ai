"use client";

/**
 * ScrambleText — Originkit-inspired scramble reveal for React.
 *
 * Cycles each character through a glyph set until the source string is
 * fully resolved. Triggerable on mount, on viewport entry, or on hover.
 * Honors `prefers-reduced-motion` — when set, renders the final text immediately.
 *
 * API mirrors the public Originkit component (subset):
 *   - text:        string to reveal
 *   - duration:    ms for the full resolve (default 900)
 *   - trigger:     "mount" | "viewport" | "hover"
 *   - as:          element tag (default "span")
 *   - glyphs:      override the glitch character set
 *   - className:   pass-through
 *
 * Implementation notes:
 *   - requestAnimationFrame-driven; cancels on unmount.
 *   - Resolved characters lock in place so the final frame matches `text` byte-for-byte.
 *   - Spaces and unmaskable chars (`text[i] === " "`) skip the swap.
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
	const [display, setDisplay] = useState(text);
	const [shouldRun, setShouldRun] = useState(trigger === "mount");
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
		if (prefersReduced) {
			setDisplay(text);
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
			setDisplay(out);
			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				setDisplay(text);
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

	if (prefersReduced) {
		return <Tag className={className}>{text}</Tag>;
	}

	return (
		<Component
			ref={trigger === "viewport" ? (ref as never) : undefined}
			className={className}
			onMouseEnter={handleMouseEnter}
			aria-label={text}
		>
			{display}
		</Component>
	);
}