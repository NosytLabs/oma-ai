import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

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
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov", "json-summary"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts", "src/test/**"],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
});
