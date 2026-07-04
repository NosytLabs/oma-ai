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
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
