"use client";

import { domAnimation, LazyMotion, MotionConfig } from "@/lib/framer-motion-client";
import type { ReactNode } from "react";

/**
 * MotionProvider wraps the app tree with framer-motion's LazyMotion.
 *
 * We suppress hydration warnings on the LazyMotion wrapper because
 * it renders a <div style={{}} ref={...}> on the client but <Suspense>
 * during SSR — a known framer-motion behavior that is harmless.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
	return (
		<MotionConfig reducedMotion="user">
			<LazyMotion features={domAnimation} strict>
				<div suppressHydrationWarning>{children}</div>
			</LazyMotion>
		</MotionConfig>
	);
}
