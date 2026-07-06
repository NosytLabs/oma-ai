/**
 * Type declarations for framer-motion.
 *
 * Since v3 of the client wrapper (see src/lib/framer-motion-client.tsx),
 * all imports use the bare 'framer-motion' specifier. This file is kept
 * as a safety net in case any transitive import resolves through the
 * dist/es path.
 */
declare module "*/node_modules/framer-motion/dist/es/index.mjs" {
	export * from "framer-motion";
}
