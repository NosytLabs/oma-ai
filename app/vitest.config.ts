import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

// Hermetic tests: pin NODE_ENV=test BEFORE any module (react, RTL, config)
// loads, so a leaked `NODE_ENV=production` from the shell (deploy tooling)
// can't flip react/react-dom into production builds — where react 19.3 does
// not export `act`, breaking every @testing-library/react test with
// "React.act is not a function". Also clear deploy-only env so the local test
// process can't be mistaken for a Neon Function or live facilitator.
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
delete (process.env as Record<string, string | undefined>).NEON_FUNCTION;
delete (process.env as Record<string, string | undefined>).ALLOW_DEV_MODE_DEPLOY;
delete (process.env as Record<string, string | undefined>).FACILITATOR_MODE;

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		globals: true,
		include: ["src/**/*.test.{ts,tsx}"],
		exclude: ["e2e/**", "tests/**", "node_modules/**", ".next/**"],
		// PGlite cold-start can take >5s when the WASM blob hasn't been
		// loaded yet. The default 5s timeout flakes under vitest's pool;
		// 30s gives it headroom without slowing the rest of the suite.
		testTimeout: 30_000,
		onConsoleLog(log: string, type: string) {
			// Suppress framer-motion React.Fragment className warnings in jsdom
			if (
				type === "stderr" &&
				log.includes("Invalid prop `className` supplied to `React.Fragment`")
			) {
				return false;
			}
		},
	},

	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
});
