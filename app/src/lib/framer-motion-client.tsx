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

import * as FM from "framer-motion";

// Re-export motion components explicitly so each becomes an independent
// client reference. Static `export { m }` does not do this — it forwards
// the value reference, which loses the Proxy through RSC.
export const motion = FM.motion;
export const m = FM.m;
export const AnimatePresence = FM.AnimatePresence;
export const LazyMotion = FM.LazyMotion;
export const MotionConfig = FM.MotionConfig;
export const LayoutGroup = FM.LayoutGroup;
export const PopChild = FM.PopChild;

// Features
export const domAnimation = FM.domAnimation;
export const domMax = FM.domMax;
export const domMin = FM.domMin;

// Hooks
export const useMotionValue = FM.useMotionValue;
export const useMotionTemplate = FM.useMotionTemplate;
export const useTransform = FM.useTransform;
export const useSpring = FM.useSpring;
export const useScroll = FM.useScroll;
export const useReducedMotion = FM.useReducedMotion;
export const useMotionValueEvent = FM.useMotionValueEvent;

// Animation utilities
export const animate = FM.animate;
export const animations = FM.animations;
export const motionValue = FM.motionValue;

// Internal utilities (re-exported for compatibility)
export const isBrowser = FM.isBrowser;
export const useIsomorphicLayoutEffect = FM.useIsomorphicLayoutEffect;
export const useComposedRefs = FM.useComposedRefs;
export const useUnmountEffect = FM.useUnmountEffect;
export const useForceUpdate = FM.useForceUpdate;

// Type re-export: types resolved via src/types/framer-motion.d.ts module declaration
export type {
	Easing,
	MotionProps,
	Transition,
	Variants,
} from "framer-motion";
