"use client";

import { domAnimation, LazyMotion, MotionConfig } from "@/lib/framer-motion-client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * MotionProvider wraps the app tree with framer-motion's LazyMotion.
 *
 * We suppress hydration warnings on the LazyMotion wrapper because
 * it renders a <div style={{}} ref={...}> on the client but <Suspense>
 * during SSR — a known framer-motion behavior that is harmless.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
	// Syncing frame animation to avoid early visual jump during React hydration
	const [isMounted, setIsMounted] = useState(false);
	
	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Only apply full motion config on the client to avoid hydration mismatch
	// on animated elements that have dynamic start states.
	return (
		<MotionConfig reducedMotion="user" transition={isMounted ? undefined : { duration: 0 }}>
			<LazyMotion features={domAnimation} strict>
				<div suppressHydrationWarning>{children}</div>
			</LazyMotion>
		</MotionConfig>
	);
}
