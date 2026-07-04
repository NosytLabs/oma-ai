"use client";

import { domAnimation, LazyMotion, MotionConfig, m } from "@/lib/framer-motion-client";
import type { ReactNode } from "react";

export function MotionProvider({ children }: { children: ReactNode }) {
	return (
		<MotionConfig reducedMotion="user">
			<LazyMotion features={domAnimation}>
				<m.div>{children}</m.div>
			</LazyMotion>
		</MotionConfig>
	);
}
