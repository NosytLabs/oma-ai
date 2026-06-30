"use client";

import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

export function MotionProvider({ children }: { children: ReactNode }) {
	return (
		<MotionConfig reducedMotion="user">
			<LazyMotion features={domAnimation}>{children}</LazyMotion>
		</MotionConfig>
	);
}
