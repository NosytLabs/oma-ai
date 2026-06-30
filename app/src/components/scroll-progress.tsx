"use client";

import { m, useReducedMotion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
	const prefersReduced = useReducedMotion();
	const { scrollYProgress } = useScroll();
	const scaleX = useSpring(scrollYProgress, {
		stiffness: 200,
		damping: 30,
		mass: 0.4,
	});

	if (prefersReduced) return null;

	return (
		<m.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />
	);
}
