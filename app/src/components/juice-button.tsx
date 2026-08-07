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
 * - children
 * - className
 * - color: blob color (default var(--color-accent))
 * - size: blob size in px (default 120)
 * - opacity: blob opacity (default 0.12)
 */

import { useReducedMotion } from "@/lib/framer-motion-client";
import {
 useCallback,
 useEffect,
 useRef,
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
 const blobRef = useRef<HTMLDivElement>(null);
 const frame = useRef<number | null>(null);
 const prefReduced = useReducedMotion();

 // rAF-throttled direct CSS-var write — no React re-render per mousemove
 // (the previous setState version re-rendered ~60×/s while hovering).
 const handleMouseMove = useCallback(
 (e: React.MouseEvent) => {
 if (prefReduced) return;
 const el = ref.current;
 if (!el || frame.current !== null) return;
 const { clientX, clientY } = e;
 frame.current = requestAnimationFrame(() => {
 frame.current = null;
 const blob = blobRef.current;
 if (!blob) return;
 const rect = el.getBoundingClientRect();
 blob.style.setProperty(
 "--jx",
 `${((clientX - rect.left) / rect.width) * 100}%`,
 );
 blob.style.setProperty(
 "--jy",
 `${((clientY - rect.top) / rect.height) * 100}%`,
 );
 });
 },
 [prefReduced],
 );

 useEffect(
 () => () => {
 if (frame.current !== null) cancelAnimationFrame(frame.current);
 },
 [],
 );

 const bgStyle: CSSProperties = prefReduced
 ? {}
 : {
 background: `radial-gradient(circle ${size}px at var(--jx, 50%) var(--jy, 50%), ${color} 0%, transparent 100%)`,
 opacity,
 };

 return (
 <div
 ref={ref}
 onMouseMove={handleMouseMove}
 className={`relative inline-flex overflow-hidden transition-[transform] duration-200 ease-out active:scale-[0.97] ${className ?? ""}`}
 >
 {/* Juice blob layer */}
 <div
 ref={blobRef}
 aria-hidden="true"
 className="pointer-events-none absolute inset-0 transition-opacity duration-200 ease-out"
 style={bgStyle}
 />
 {/* Content layer */}
 <div className="relative z-10 w-full h-full">{children}</div>
 </div>
 );
}
