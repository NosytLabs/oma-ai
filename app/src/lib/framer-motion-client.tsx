"use client";

/**
 * framer-motion-client.tsx
 * ------------------------
 * Thin 'use client' wrapper around framer-motion.
 *
 * The 'use client' directive is at the top of this file. That makes
 * every export a client reference when imported from a server component.
 *
 * The previous version of this file used a *static re-export* of framer-motion's
 * dist entry (`export { m, motion } from '.../framer-motion/dist/es/index.mjs'`).
 * That approach loses the Proxy behavior of `m` and `motion` during RSC
 * serialization — the spans that use these proxies get their initial `hidden`
 * variant applied on the server, but the client never receives the trigger
 * to transition to `show`, leaving the content invisible (opacity: 0) until
 * the user manually removes the inline style. This was the source of the
 * "1 Error — BailoutToCSR" symptom plus visually empty home/login/pricing
 * pages even when SSR succeeded.
 *
 * Fix: import each binding and re-export it as a *named* client export.
 * Static re-exports of proxies through a 'use client' module are treated as
 * a single value reference; named re-exports through `export const` are
 * treated as separate client references that the React flight protocol can
 * resolve independently. Each motion component then gets a real
 * serialization round-trip.
 *
 * The wrapper cannot import from the bare specifier `'framer-motion'`
 * (webpack re-routes that back to this file → infinite recursion). We
 * import from a *relative path* which bypasses the alias and the package's
 * `exports` field restriction.
 *
 * If this file is moved, update the relative path accordingly.
 */

import * as FM from "../../node_modules/framer-motion/dist/es/index.mjs";

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
} from "../../node_modules/framer-motion/dist/es/index.mjs";
