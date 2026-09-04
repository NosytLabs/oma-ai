import { dirname } from "path";
import { fileURLToPath } from "url";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Next 16's `recommended` / `core-web-vitals` presets are flat configs with
// a top-level `name` field. FlatCompat rejects `name` in strict mode and
// the field is purely informational — we just pull `.rules` out and let
// the plugin handle the rest. The plugin instance is also registered in
// the `plugins` map below so Next 15's build-time plugin detector picks
// it up (without that registration `next build` emits "The Next.js
// plugin was not detected in your ESLint configuration.").
const nextRecommendedRules =
	nextPlugin.configs.recommended?.rules ?? {};
const nextCoreWebVitalsRules =
	nextPlugin.configs["core-web-vitals"]?.rules ?? {};

const eslintConfig = [
		{
			ignores: [
				".next/**",
				"node_modules/**",
				"dist/**",
				"out/**",
				"coverage/**",
				"next-env.d.ts",
				"**/*.js",
				"**/*.cjs",
				"!*.test.js",
				"!*.config.js",
				"scripts/**",
			],
		},
		{
			// Bare config block (no `files` filter) so Next 15's build-time
			// detector finds the `@next/next` plugin when it asks ESLint
			// for the resolved config of `eslint.config.mjs` itself — the
			// file-scoped block below would otherwise return an empty
			// config for that path, and the build emits "The Next.js
			// plugin was not detected in your ESLint configuration."
			// Rules below are re-applied under the file-scoped block so
			// they only run against TypeScript sources.
			plugins: {
				"@next/next": nextPlugin,
				"@typescript-eslint": tsPlugin,
				// Required for the next/core-web-vitals rules below to resolve:
				// `react-hooks/exhaustive-deps` + `react-hooks/purity` have
				// to be registered or eslint fails with "Definition for
				// rule not found".
				"react-hooks": reactHooks,
			},
		},
		{
			// files must be explicit: eslint 9.39+ (new config loader) silently
			// drops config elements without a `files` key, which previously
			// made every source file report "no matching configuration" and
			// `pnpm lint` pass while linting ZERO files.
files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
		},
		rules: {
			...nextRecommendedRules,
			...nextCoreWebVitalsRules,
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-unused-expressions": "off",
			// Discourage console.log for ad-hoc logging in production code.
			// warn/error/info/debug are allowed (legitimate error-boundary, logger,
			// and proxy error calls; the logger wraps these and adds a tag prefix).
			"no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
			// React Compiler strictness — disabled project-wide. This codebase
			// intentionally uses the patterns these rules flag:
			//   • useMounted hydration gates (avoid SSR/client mismatch),
			//   • effects that sync external systems (localStorage, cookies, RAF,
			//     timers, image src), and
			//   • transient-state resets on route/prop change.
			// None are the "derive state in an effect" anti-pattern; the React
			// Compiler handles memoization, so the warnings are pure noise.
			"react-hooks/set-state-in-effect": "off",
			"react-hooks/immutability": "off",
		},
	},
	{
		files: [
			"**/__tests__/**/*",
			"**/*.test.ts",
			"**/*.test.tsx",
			"**/*.spec.ts",
			"**/*.spec.tsx",
		],
		rules: {
			// Tests frequently assert on console output.
			"no-console": "off",
		},
	},
];

export default eslintConfig;

