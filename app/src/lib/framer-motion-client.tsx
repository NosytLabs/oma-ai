"use client";

/**
 * framer-motion-client.tsx
 * ------------------------
 * Thin 'use client' wrapper around framer-motion.
 *
 * The 'use client' directive is at the top of this file. That makes
 * every export a client reference when imported from a server component.
 *
 * Each binding is imported and re-exported explicitly so that every export
 * becomes an independent client reference that the React flight protocol
 * can resolve separately. Static `export { m } from 'framer-motion'`
 * forwards the value reference, which loses the Proxy through RSC.
 *
 * Bug history:
 *   - Version 1: Static re-export from a relative path to framer-motion/dist
 *     → Proxy behavior lost during RSC serialization → invisible content.
 *   - Version 2: Named re-export from relative path + webpack alias
 *     → alias caused dual module registration → `options.factory` undefined.
 *   - Version 3 (current): Named re-export from bare 'framer-motion' specifier.
 *     No alias, no transpilePackages. All app imports go through this wrapper.
 */

// Re-export motion components explicitly so each becomes an independent
// client reference. Static `export { m }` does not do this — it forwards
// the value reference, which loses the Proxy through RSC.
// SECURITY (perf): Import only what we use. `import * as FM` prevents
// tree-shaking and loads the full framer-motion bundle (~150KB waste).
import {
	m,
	AnimatePresence,
	LazyMotion,
	MotionConfig,
	domAnimation,
	useMotionValue,
	useSpring,
	useReducedMotion,
	useInView,
	animate,
	motionValue,
	useTransform,
} from "framer-motion";

export {
	m,
	AnimatePresence,
	LazyMotion,
	MotionConfig,
	domAnimation,
	useMotionValue,
	useSpring,
	useReducedMotion,
	useInView,
	animate,
	motionValue,
	useTransform,
};

// Type re-export: types resolved via src/types/framer-motion.d.ts module declaration
export type {
	Easing,
	MotionProps,
	Transition,
	Variants,
} from "framer-motion";
