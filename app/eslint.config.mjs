import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

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
			"!*.test.js",
			"!*.config.js",
			"scripts/**",
		],
	},
	...compat.extends("next/core-web-vitals", "next/typescript"),
	{
		rules: {
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
