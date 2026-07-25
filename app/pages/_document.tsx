/**
 * Minimal pages-router _document — required by Next.js 15 for the static
 * `/404` + `/500` HTML export. The app router handles all real routes.
 * Kept lean so Sentry's pages-router instrumentation (no longer installed)
 * has nothing to auto-inject into.
 */
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
	return (
		<Html lang="en">
			<Head />
			<body className="bg-void text-text-secondary font-mono antialiased">
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
