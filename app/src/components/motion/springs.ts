// Re-export of the canonical springs module so this folder is a valid
// secondary entry point documented in `components/motion/README.md`.
//
// Do NOT add per-surface variants here — keep `springs.ts` as the single
// source of truth and update this file only if the canonical path moves.
export { springs, type SpringName } from "@/lib/animation/springs";
