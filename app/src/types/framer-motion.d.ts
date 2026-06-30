/**
 * Type declaration for the direct .mjs import path used by
 * src/lib/framer-motion-client.tsx.
 *
 * The wrapper imports from a relative path to bypass webpack's
 * bare-specifier alias back to itself. TypeScript can't resolve
 * types for a .mjs file directly, so we redirect the module
 * declaration to framer-motion's published types.
 */
declare module "*/node_modules/framer-motion/dist/es/index.mjs" {
	export * from "framer-motion";
}
